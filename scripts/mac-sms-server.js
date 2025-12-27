#!/usr/bin/env node

/**
 * 📱 Mac SMS Server
 * 
 * Запускается на Mac, принимает HTTP запросы и отправляет SMS через Messages.app
 * iPhone должен быть подключен к тому же iCloud аккаунту
 * 
 * Запуск: node mac-sms-server.js
 * Или:    ./mac-sms-server.js (после chmod +x)
 */

const http = require('http');
const { exec } = require('child_process');
const url = require('url');

const PORT = 8765;
const API_KEY = process.env.SMS_API_KEY || 'your-secret-key-here';

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(type, message) {
  const timestamp = new Date().toLocaleTimeString('ru-RU');
  const color = {
    info: colors.blue,
    success: colors.green,
    error: colors.red,
    warning: colors.yellow,
  }[type] || colors.reset;
  
  console.log(`${colors.cyan}[${timestamp}]${colors.reset} ${color}${message}${colors.reset}`);
}

/**
 * Отправить SMS через AppleScript
 */
function sendSMS(phone, message) {
  return new Promise((resolve, reject) => {
    // Экранируем кавычки в сообщении
    const escapedMessage = message.replace(/"/g, '\\"').replace(/'/g, "'\\''");
    const escapedPhone = phone.replace(/"/g, '');
    
    // AppleScript для отправки через Messages.app
    const appleScript = `
      tell application "Messages"
        set targetService to 1st service whose service type = SMS
        set targetBuddy to buddy "${escapedPhone}" of targetService
        send "${escapedMessage}" to targetBuddy
      end tell
    `;
    
    exec(`osascript -e '${appleScript.replace(/'/g, "'\\''")}'`, (error, stdout, stderr) => {
      if (error) {
        // Попробуем альтернативный способ
        const altScript = `
          tell application "Messages"
            send "${escapedMessage}" to buddy "${escapedPhone}" of service 1
          end tell
        `;
        
        exec(`osascript -e '${altScript.replace(/'/g, "'\\''")}'`, (err2, out2, stderr2) => {
          if (err2) {
            reject(new Error(stderr2 || stderr || err2.message));
          } else {
            resolve({ success: true, method: 'alt' });
          }
        });
      } else {
        resolve({ success: true, method: 'sms' });
      }
    });
  });
}

/**
 * HTTP сервер
 */
const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const parsedUrl = url.parse(req.url, true);
  
  // Health check
  if (parsedUrl.pathname === '/status' || parsedUrl.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      service: 'Mac SMS Server',
      version: '1.0.0',
      uptime: process.uptime(),
    }));
    return;
  }
  
  // Send SMS
  if (parsedUrl.pathname === '/send' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => { body += chunk; });
    
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { phone, message, phone_number, text } = data;
        
        const targetPhone = phone || phone_number;
        const targetMessage = message || text;
        
        if (!targetPhone || !targetMessage) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'phone and message required' }));
          return;
        }
        
        // Проверяем API ключ если установлен
        const authHeader = req.headers.authorization;
        if (API_KEY !== 'your-secret-key-here' && authHeader !== API_KEY) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
          return;
        }
        
        log('info', `📤 Отправка SMS на ${targetPhone}`);
        log('info', `   Сообщение: ${targetMessage.substring(0, 50)}...`);
        
        const result = await sendSMS(targetPhone, targetMessage);
        
        log('success', `✅ SMS отправлено!`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          messageId: Date.now().toString(),
          method: result.method,
        }));
        
      } catch (error) {
        log('error', `❌ Ошибка: ${error.message}`);
        
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: error.message,
        }));
      }
    });
    
    return;
  }
  
  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║   📱  Mac SMS Server                                       ║');
  console.log('║                                                            ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║                                                            ║');
  console.log(`║   🌐  Сервер запущен: http://localhost:${PORT}               ║`);
  console.log('║                                                            ║');
  console.log('║   📋  Endpoints:                                           ║');
  console.log('║       GET  /status  - проверка статуса                     ║');
  console.log('║       POST /send    - отправка SMS                         ║');
  console.log('║                                                            ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║                                                            ║');
  console.log('║   💡  Для CRM используй URL:                               ║');
  console.log(`║       http://YOUR_MAC_IP:${PORT}/send                        ║`);
  console.log('║                                                            ║');
  console.log('║   🔍  Узнать IP Mac:                                       ║');
  console.log('║       System Preferences → Network → Wi-Fi → IP Address   ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Показать локальный IP
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        log('info', `🔗 Локальный IP: http://${net.address}:${PORT}`);
      }
    }
  }
  
  console.log('');
  log('info', '⏳ Ожидание запросов...');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  log('warning', '\n👋 Остановка сервера...');
  server.close(() => {
    process.exit(0);
  });
});

