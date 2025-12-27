/**
 * 📱 SMS Gateway - отправка SMS через мобильный телефон
 * 
 * Поддерживаемые приложения:
 * 1. SMS Gateway (Android) - https://smsgateway.me/
 * 2. SMS Forwarder - https://github.com/pndurette/SMS-Forwarder
 * 3. Tasker HTTP Server
 * 4. Любой HTTP SMS Gateway
 */

import { prisma } from '@/lib/prisma';

export interface SMSDevice {
  id: string;
  name: string;          // "Корпоративный Beeline", "Личный Ucell"
  phone: string;         // +998901234567
  operator: string;      // beeline, ucell, mobiuz, uztelecom, humans
  gatewayType: 'sms_gateway_app' | 'http_api' | 'tasker';
  apiUrl: string;        // http://192.168.1.100:8080/send
  apiKey?: string;       // Если нужен
  isActive: boolean;
  dailyLimit: number;    // Лимит SMS в день
  sentToday: number;     // Отправлено сегодня
  lastUsed?: Date;
}

export interface SendSMSResult {
  success: boolean;
  messageId?: string;
  device?: string;
  error?: string;
  cost?: number;         // Примерная стоимость
}

// Операторы Узбекистана
export const UZ_OPERATORS = {
  beeline: {
    name: 'Beeline',
    prefixes: ['90', '91'],
    smsCost: 65, // сум
    color: '#FFB900',
  },
  ucell: {
    name: 'Ucell', 
    prefixes: ['93', '94'],
    smsCost: 60,
    color: '#7B2D8E',
  },
  mobiuz: {
    name: 'Mobiuz',
    prefixes: ['88', '97', '98', '99'],
    smsCost: 55,
    color: '#00A651',
  },
  uztelecom: {
    name: 'Uztelecom',
    prefixes: ['95', '71', '75'],
    smsCost: 50,
    color: '#0066B3',
  },
  humans: {
    name: 'Humans',
    prefixes: ['33'],
    smsCost: 50,
    color: '#FF6B00',
  },
};

/**
 * Определить оператора по номеру телефона
 */
export function detectOperator(phone: string): string | null {
  // Убираем всё кроме цифр
  const digits = phone.replace(/\D/g, '');
  
  // Берём код после +998
  let code = '';
  if (digits.startsWith('998') && digits.length >= 5) {
    code = digits.substring(3, 5);
  } else if (digits.length >= 2) {
    code = digits.substring(0, 2);
  }
  
  for (const [operator, info] of Object.entries(UZ_OPERATORS)) {
    if (info.prefixes.includes(code)) {
      return operator;
    }
  }
  
  return null;
}

/**
 * Получить настройки SMS Gateway из БД
 */
async function getSMSGatewaySettings() {
  const settings = await prisma.cRMSettings.findFirst();
  
  if (!settings) return null;
  
  // Парсим JSON с устройствами
  const rawDevices = (settings as any).smsDevices;
  if (!rawDevices) return null;
  
  try {
    return JSON.parse(rawDevices) as SMSDevice[];
  } catch {
    return null;
  }
}

/**
 * Выбрать лучшее устройство для отправки
 */
function selectDevice(devices: SMSDevice[], recipientPhone: string): SMSDevice | null {
  const recipientOperator = detectOperator(recipientPhone);
  
  // Фильтруем активные устройства с лимитом
  const available = devices.filter(d => d.isActive && d.sentToday < d.dailyLimit);
  
  if (available.length === 0) return null;
  
  // Приоритет: тот же оператор (дешевле/бесплатно)
  if (recipientOperator) {
    const sameOperator = available.find(d => d.operator === recipientOperator);
    if (sameOperator) return sameOperator;
  }
  
  // Иначе - наименее использованный
  return available.sort((a, b) => a.sentToday - b.sentToday)[0];
}

/**
 * Отправить SMS через SMS Gateway App
 * https://smsgateway.me/
 */
async function sendViaSMSGatewayApp(
  device: SMSDevice, 
  phone: string, 
  message: string
): Promise<SendSMSResult> {
  try {
    const response = await fetch(`${device.apiUrl}/v4/message/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(device.apiKey && { 'Authorization': device.apiKey }),
      },
      body: JSON.stringify({
        phone_number: phone,
        message: message,
        device_id: device.id,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${error}` };
    }
    
    const data = await response.json();
    return {
      success: true,
      messageId: data.id || data.message_id,
      device: device.name,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Отправить через простой HTTP API
 * Для кастомных решений и Tasker
 */
async function sendViaHTTPAPI(
  device: SMSDevice,
  phone: string,
  message: string
): Promise<SendSMSResult> {
  try {
    // Поддержка разных форматов URL
    let url = device.apiUrl;
    
    // Заменяем плейсхолдеры если есть
    url = url.replace('{phone}', encodeURIComponent(phone));
    url = url.replace('{message}', encodeURIComponent(message));
    
    // Если нет плейсхолдеров - POST запрос
    const isGetRequest = url.includes(encodeURIComponent(phone));
    
    const response = isGetRequest 
      ? await fetch(url)
      : await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(device.apiKey && { 'Authorization': device.apiKey }),
          },
          body: JSON.stringify({
            phone,
            to: phone,
            number: phone,
            message,
            text: message,
          }),
        });
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    return {
      success: true,
      messageId: Date.now().toString(),
      device: device.name,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Главная функция отправки SMS
 */
export async function sendSMSViaGateway(
  phone: string,
  message: string,
  preferredDeviceId?: string
): Promise<SendSMSResult> {
  const devices = await getSMSGatewaySettings();
  
  if (!devices || devices.length === 0) {
    return {
      success: false,
      error: 'SMS Gateway не настроен. Добавьте устройство в настройках.',
    };
  }
  
  // Выбираем устройство
  let device: SMSDevice | null = null;
  
  if (preferredDeviceId) {
    device = devices.find(d => d.id === preferredDeviceId && d.isActive) || null;
  }
  
  if (!device) {
    device = selectDevice(devices, phone);
  }
  
  if (!device) {
    return {
      success: false,
      error: 'Нет доступных устройств. Все достигли лимита.',
    };
  }
  
  // Отправляем в зависимости от типа gateway
  let result: SendSMSResult;
  
  switch (device.gatewayType) {
    case 'sms_gateway_app':
      result = await sendViaSMSGatewayApp(device, phone, message);
      break;
    case 'http_api':
    case 'tasker':
    default:
      result = await sendViaHTTPAPI(device, phone, message);
  }
  
  // Обновляем счётчик если успешно
  if (result.success) {
    // TODO: обновить sentToday в БД
    const recipientOperator = detectOperator(phone);
    const deviceOperator = device.operator;
    
    // Считаем стоимость
    if (recipientOperator === deviceOperator) {
      result.cost = 0; // Внутри сети бесплатно
    } else if (recipientOperator) {
      result.cost = UZ_OPERATORS[recipientOperator as keyof typeof UZ_OPERATORS]?.smsCost || 65;
    }
  }
  
  return result;
}

/**
 * Проверить соединение с устройством
 */
export async function testSMSDevice(device: SMSDevice): Promise<{
  success: boolean;
  latency?: number;
  error?: string;
}> {
  const start = Date.now();
  
  try {
    const response = await fetch(device.apiUrl.replace(/\/send$/, '/status'), {
      method: 'GET',
      headers: device.apiKey ? { 'Authorization': device.apiKey } : {},
      signal: AbortSignal.timeout(5000),
    });
    
    const latency = Date.now() - start;
    
    if (response.ok) {
      return { success: true, latency };
    } else {
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Инструкция по настройке
 */
export const SMS_GATEWAY_INSTRUCTIONS = {
  sms_gateway_app: {
    name: 'SMS Gateway (Android)',
    url: 'https://play.google.com/store/apps/details?id=eu.apksoft.android.smsgateway',
    steps: [
      '1. Установите приложение SMS Gateway на Android телефон',
      '2. Откройте приложение и включите сервер',
      '3. Запишите IP адрес и порт (например: http://192.168.1.100:8080)',
      '4. Убедитесь что телефон и сервер в одной сети или настройте port forwarding',
      '5. Добавьте устройство в настройках CRM',
    ],
    apiUrlExample: 'http://192.168.1.100:8080',
  },
  http_api: {
    name: 'Кастомный HTTP API',
    url: '',
    steps: [
      '1. Настройте свой SMS сервер или используйте Tasker',
      '2. Создайте эндпоинт который принимает phone и message',
      '3. Добавьте URL в настройках CRM',
    ],
    apiUrlExample: 'http://your-server.com/api/sms',
  },
  tasker: {
    name: 'Tasker (Android)',
    url: 'https://play.google.com/store/apps/details?id=net.dinglisch.android.taskerm',
    steps: [
      '1. Установите Tasker и AutoRemote/HTTP Server плагин',
      '2. Создайте Profile с HTTP Request триггером',
      '3. Создайте Task с Send SMS действием',
      '4. Добавьте URL в настройках CRM',
    ],
    apiUrlExample: 'http://192.168.1.100:1821/sms?phone={phone}&message={message}',
  },
};

