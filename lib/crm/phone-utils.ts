/**
 * 📱 Утилиты для работы с телефонами
 * Определение типа номера, форматирование, валидация
 */

// Мобильные коды Узбекистана
const UZ_MOBILE_PREFIXES = [
  '90', '91',        // Beeline
  '93', '94',        // Ucell
  '88', '97', '98', '99', // Mobiuz
  '33',              // Humans
  '95',              // Uztelecom Mobile
];

// Стационарные коды Узбекистана (по городам)
const UZ_LANDLINE_PREFIXES = [
  '71',  // Ташкент
  '62',  // Андижан
  '65',  // Бухара
  '76',  // Джизак
  '75',  // Наманган
  '72',  // Навои
  '73',  // Кашкадарья
  '79',  // Сурхандарья
  '74',  // Самарканд
  '69',  // Сырдарья
  '67',  // Ташкентская область
  '61',  // Фергана
  '66',  // Хорезм
];

// Мобильные коды других стран
const OTHER_MOBILE_PATTERNS = [
  // Казахстан
  { country: 'KZ', prefix: '77', mobilePrefixes: ['0', '1', '2', '5', '6', '7', '8'] },
  // Россия
  { country: 'RU', prefix: '7', mobilePrefixes: ['9'] },
  // Таджикистан
  { country: 'TJ', prefix: '992', mobilePrefixes: ['9', '5', '88'] },
  // Кыргызстан
  { country: 'KG', prefix: '996', mobilePrefixes: ['5', '7', '22'] },
];

export type PhoneType = 'mobile' | 'landline' | 'unknown';

export interface PhoneInfo {
  original: string;
  normalized: string;
  type: PhoneType;
  country: string | null;
  operator: string | null;
  isValid: boolean;
  canReceiveSMS: boolean;
}

/**
 * Нормализовать номер телефона
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  
  // Убираем всё кроме цифр и +
  let normalized = phone.replace(/[^\d+]/g, '');
  
  // Убираем лишние +
  if (normalized.startsWith('+')) {
    normalized = '+' + normalized.slice(1).replace(/\+/g, '');
  }
  
  // Если начинается с 8 и длина подходит - меняем на +7 (Россия/Казахстан)
  if (normalized.startsWith('8') && normalized.length === 11) {
    normalized = '+7' + normalized.slice(1);
  }
  
  // Добавляем + если нет
  if (!normalized.startsWith('+') && normalized.length >= 10) {
    // Узбекистан
    if (normalized.startsWith('998')) {
      normalized = '+' + normalized;
    }
    // Россия/Казахстан
    else if (normalized.startsWith('7')) {
      normalized = '+' + normalized;
    }
  }
  
  return normalized;
}

/**
 * Определить тип телефона
 */
export function detectPhoneType(phone: string): PhoneType {
  const normalized = normalizePhone(phone);
  
  if (!normalized || normalized.length < 10) {
    return 'unknown';
  }
  
  // Убираем + для анализа
  const digits = normalized.replace('+', '');
  
  // Узбекистан (+998)
  if (digits.startsWith('998') && digits.length === 12) {
    const prefix = digits.substring(3, 5);
    
    if (UZ_MOBILE_PREFIXES.includes(prefix)) {
      return 'mobile';
    }
    if (UZ_LANDLINE_PREFIXES.includes(prefix)) {
      return 'landline';
    }
  }
  
  // Казахстан (+77)
  if (digits.startsWith('77') && digits.length === 11) {
    const third = digits[2];
    if (['0', '1', '2', '5', '6', '7', '8'].includes(third)) {
      return 'mobile';
    }
    return 'landline';
  }
  
  // Россия (+7)
  if (digits.startsWith('7') && digits.length === 11) {
    if (digits[1] === '9') {
      return 'mobile';
    }
    return 'landline';
  }
  
  // Таджикистан (+992)
  if (digits.startsWith('992') && digits.length === 12) {
    const prefix = digits.substring(3, 4);
    if (['9', '5'].includes(prefix) || digits.substring(3, 5) === '88') {
      return 'mobile';
    }
    return 'landline';
  }
  
  // По умолчанию предполагаем мобильный для коротких номеров
  if (digits.length <= 10) {
    return 'mobile';
  }
  
  return 'unknown';
}

/**
 * Получить полную информацию о телефоне
 */
export function analyzePhone(phone: string): PhoneInfo {
  const normalized = normalizePhone(phone);
  const type = detectPhoneType(normalized);
  const digits = normalized.replace('+', '');
  
  let country: string | null = null;
  let operator: string | null = null;
  
  // Определяем страну и оператора
  if (digits.startsWith('998') && digits.length === 12) {
    country = 'UZ';
    const prefix = digits.substring(3, 5);
    
    if (['90', '91'].includes(prefix)) operator = 'Beeline';
    else if (['93', '94'].includes(prefix)) operator = 'Ucell';
    else if (['88', '97', '98', '99'].includes(prefix)) operator = 'Mobiuz';
    else if (prefix === '33') operator = 'Humans';
    else if (prefix === '95') operator = 'Uztelecom';
  } else if (digits.startsWith('77')) {
    country = 'KZ';
  } else if (digits.startsWith('7') && digits.length === 11) {
    country = 'RU';
  } else if (digits.startsWith('992')) {
    country = 'TJ';
  } else if (digits.startsWith('996')) {
    country = 'KG';
  }
  
  return {
    original: phone,
    normalized,
    type,
    country,
    operator,
    isValid: normalized.length >= 10,
    canReceiveSMS: type === 'mobile',
  };
}

/**
 * Фильтровать только мобильные номера
 */
export function filterMobilePhones(phones: string[]): string[] {
  return phones.filter(phone => detectPhoneType(phone) === 'mobile');
}

/**
 * Форматировать номер для отображения
 */
export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhone(phone);
  const digits = normalized.replace('+', '');
  
  // Узбекистан: +998 90 123 45 67
  if (digits.startsWith('998') && digits.length === 12) {
    return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`;
  }
  
  // Россия/Казахстан: +7 (9XX) XXX-XX-XX
  if (digits.startsWith('7') && digits.length === 11) {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
  }
  
  return normalized;
}

/**
 * Иконка для типа телефона
 */
export function getPhoneTypeIcon(type: PhoneType): string {
  switch (type) {
    case 'mobile': return '📱';
    case 'landline': return '☎️';
    default: return '📞';
  }
}

/**
 * Название типа телефона
 */
export function getPhoneTypeName(type: PhoneType): string {
  switch (type) {
    case 'mobile': return 'Мобильный';
    case 'landline': return 'Стационарный';
    default: return 'Неизвестно';
  }
}

