/**
 * Скрипт для генерации Telegram Session String
 * 
 * Запуск: node scripts/telegram-auth.cjs
 */

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const readline = require('readline');

// Твои данные
const API_ID = 25623389;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log('\n🔐 Telegram Session Generator\n');
  
  // Запрашиваем API Hash
  const apiHash = await question('🔑 Введи API Hash (с my.telegram.org): ');
  
  if (!apiHash) {
    console.error('❌ API Hash обязателен!');
    process.exit(1);
  }

  console.log(`\n📱 API ID: ${API_ID}`);
  console.log(`🔑 API Hash: ${apiHash.slice(0, 4)}...${apiHash.slice(-4)}`);
  
  // Создаём клиент с пустой сессией
  const stringSession = new StringSession('');
  
  const client = new TelegramClient(stringSession, API_ID, apiHash, {
    connectionRetries: 5,
  });

  try {
    console.log('\n⏳ Подключаемся к Telegram...\n');
    
    await client.start({
      phoneNumber: async () => {
        return await question('📱 Введи номер телефона (с +): ');
      },
      password: async () => {
        return await question('🔒 Введи пароль 2FA (если есть, иначе Enter): ');
      },
      phoneCode: async () => {
        return await question('💬 Введи код из Telegram: ');
      },
      onError: (err) => {
        console.error('❌ Ошибка:', err.message);
      },
    });

    console.log('\n✅ Авторизация успешна!\n');
    
    // Получаем Session String
    const session = client.session.save();
    
    console.log('═'.repeat(60));
    console.log('\n🎉 ВОТ ТВОЙ SESSION STRING:\n');
    console.log('═'.repeat(60));
    console.log(session);
    console.log('═'.repeat(60));
    
    console.log('\n📋 Скопируй эту строку и вставь в настройки CRM!\n');
    
    // Тестируем что работает
    const me = await client.getMe();
    console.log(`\n👤 Авторизован как: ${me.firstName} (@${me.username})\n`);
    
  } catch (error) {
    console.error('\n❌ Ошибка авторизации:', error.message);
  } finally {
    await client.disconnect();
    rl.close();
  }
}

main();

