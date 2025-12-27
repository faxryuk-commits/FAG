/**
 * База знаний о продукте Delever для AI агентов
 * Источник: PRODUCT_GUIDE.md
 */

export const PRODUCT_KNOWLEDGE = {
  // Основная информация
  name: 'Delever',
  description: 'Единая операционная платформа для управления доставкой и всеми каналами продаж ресторанов, кафе, магазинов',
  
  // Ключевые цифры
  stats: {
    orders: '13M+',
    businesses: '1000+',
    countries: 7,
    integrations: '40+',
    uptime: '99.9%',
  },
  
  // Страны
  countries: ['Узбекистан', 'Казахстан', 'Грузия', 'ОАЭ', 'Кипр'],
  
  // Целевая аудитория
  targetAudience: [
    'Рестораны и кафе',
    'Фастфуд сети',
    'Магазины и ритейл',
    'Dark kitchen',
    'Аптеки',
    'Цветочные магазины',
    'Доставка воды',
  ],
  
  // Модули продукта
  modules: {
    channels: {
      name: 'Каналы продаж',
      items: ['Мобильное приложение', 'Веб-сайт', 'Telegram мини-апп', 'QR-меню'],
      benefits: ['0% комиссии', 'Полный контроль данных', 'Push-уведомления', 'Запуск за 1 день'],
    },
    aggregators: {
      name: 'Интеграция с агрегаторами',
      items: ['Wolt', 'Glovo', 'Yandex Eats', 'Uzum Tezkor', 'Chocofood', 'Talabat', 'Deliveroo'],
      benefits: ['Единое окно заказов', 'Авто-синхронизация с кассой', 'Единое меню', 'Управление стопами'],
    },
    operations: {
      name: 'Операции доставки',
      items: ['Диспетчеризация', 'Курьерский модуль', 'GPS-трекинг', 'Кухонный дисплей'],
      benefits: ['-30% время доставки', '-25% ошибок', '-20% затрат'],
    },
    analytics: {
      name: 'Аналитика',
      items: ['Дашборды', 'Отчёты', 'ABC-XYZ анализ', 'AI-прогнозы'],
      benefits: ['+24% выручка', '+18% средний чек', '+45% повторные заказы'],
    },
    marketing: {
      name: 'Маркетинг и CRM',
      items: ['RFM-анализ', 'Push и SMS', 'Программа лояльности', 'Промокоды'],
      benefits: ['+25% средний чек', '+40% повторные заказы', '+60% LTV'],
    },
  },
  
  // Интеграции
  integrations: {
    pos: ['iiko', 'R-Keeper', 'Jowi', 'Poster', 'Paloma', 'Syrve'],
    payments: ['Payme', 'Click', 'Uzum Bank', 'Kaspi'],
    delivery: ['Yandex Delivery', 'Wolt Drive', 'Taxi Millennium'],
    sms: ['Eskiz', 'PlayMobile', 'SMS.UZ'],
  },
  
  // Цены
  pricing: {
    base: 'от $99/мес',
    whiteLabel: '$1,000 единоразово',
    discounts: {
      '6 месяцев': '10%',
      '12 месяцев': '15%',
    },
  },
  
  // Боли клиентов и решения
  painPoints: [
    {
      problem: 'Теряете 5-15 млн сум/мес на комиссиях агрегаторов',
      solution: 'Свой сайт + Telegram бот с 0% комиссии',
      result: 'Экономия 7 млн сум/мес',
    },
    {
      problem: '3 из 10 заказов доставляются с опозданием',
      solution: 'GPS-трекинг + авто-назначение курьеров',
      result: 'Время доставки: 48 мин → 28 мин',
    },
    {
      problem: '85% клиентов покупают один раз и уходят',
      solution: 'Push + SMS + кешбэк программа лояльности',
      result: 'Повторные заказы: 15% → 42%',
    },
    {
      problem: 'Хаос: заказы в 5 местах, нет единой картины',
      solution: 'Единый экран для всех заказов и аналитики',
      result: 'Количество систем: 5+ → 1',
    },
    {
      problem: 'Принимаете решения "на глаз"',
      solution: 'Аналитика в реальном времени',
      result: 'Прозрачность данных: 0% → 100%',
    },
    {
      problem: 'Рейтинг ниже 4.5 = меньше заказов',
      solution: 'Автоответы + контроль качества',
      result: 'Рейтинг: 3.8 → 4.8',
    },
  ],
  
  // Кейсы
  cases: [
    { name: 'GIPPO', type: 'Гипермаркет', result: 'Единая платформа для 42 точек' },
    { name: 'Yaponamama', type: 'Японская кухня', result: 'Полная автоматизация от колл-центра до курьеров' },
    { name: 'MAXWAY', type: 'Фаст-фуд', result: 'Интеграция с агрегаторами и своими каналами' },
  ],
  
  // Преимущества
  advantages: [
    'Единая платформа — всё в одном месте',
    'Быстрый запуск — от заявки до первых заказов за 1 день',
    'Без комиссий — свои каналы = 0%',
    'Автоматизация — 95% процессов без ручной работы',
    'Поддержка 24/7',
    '40+ интеграций',
    '99.9% uptime',
  ],
  
  // Контакты
  contacts: {
    telegram: '@deleverme',
    address: 'Ташкент, Амира Темура 129Б',
    website: 'delever.io',
  },
};

// Генерация контекста для AI на основе типа бизнеса
export function getProductContextForLead(lead: {
  company?: string | null;
  segment?: string | null;
  tags?: string[];
  source?: string;
}): string {
  const knowledge = PRODUCT_KNOWLEDGE;
  
  // Определяем релевантные боли по сегменту
  const relevantPains = knowledge.painPoints.slice(0, 3);
  
  // Формируем контекст
  return `
ИНФОРМАЦИЯ О ПРОДУКТЕ DELEVER:

${knowledge.description}

КЛЮЧЕВЫЕ ЦИФРЫ:
- ${knowledge.stats.orders} обработанных заказов
- ${knowledge.stats.businesses} активных бизнесов
- ${knowledge.stats.countries} стран присутствия
- ${knowledge.stats.integrations} готовых интеграций

ГЛАВНЫЕ ПРЕИМУЩЕСТВА:
${knowledge.advantages.map(a => `• ${a}`).join('\n')}

РЕШАЕМ ПРОБЛЕМЫ:
${relevantPains.map(p => `• ${p.problem} → ${p.solution} = ${p.result}`).join('\n')}

ЦЕНЫ:
- Базовый тариф: ${knowledge.pricing.base}
- White Label приложение: ${knowledge.pricing.whiteLabel}

КЛИЕНТЫ: ${knowledge.cases.map(c => c.name).join(', ')} и другие

КОНТАКТ: ${knowledge.contacts.telegram}
`;
}

// Короткая версия для SMS/Telegram
export function getShortProductPitch(): string {
  return `Delever — платформа для ресторанов: онлайн-заказы, управление доставкой, интеграции с агрегаторами. 
1000+ бизнесов, запуск за 1 день, 0% комиссии на своих каналах.`;
}

// Генерация релевантного кейса
export function getRelevantCase(businessType?: string): string {
  const cases = PRODUCT_KNOWLEDGE.cases;
  
  if (businessType?.toLowerCase().includes('японск') || businessType?.toLowerCase().includes('суши')) {
    return `Например, ${cases[1].name} (${cases[1].type}) — ${cases[1].result}`;
  }
  
  if (businessType?.toLowerCase().includes('фастфуд') || businessType?.toLowerCase().includes('бургер')) {
    return `Например, ${cases[2].name} (${cases[2].type}) — ${cases[2].result}`;
  }
  
  if (businessType?.toLowerCase().includes('магазин') || businessType?.toLowerCase().includes('маркет')) {
    return `Например, ${cases[0].name} (${cases[0].type}) — ${cases[0].result}`;
  }
  
  // Случайный кейс
  const randomCase = cases[Math.floor(Math.random() * cases.length)];
  return `Например, ${randomCase.name} (${randomCase.type}) — ${randomCase.result}`;
}

// Генерация релевантной боли
export function getRelevantPainPoint(context?: string): typeof PRODUCT_KNOWLEDGE.painPoints[0] {
  const pains = PRODUCT_KNOWLEDGE.painPoints;
  
  if (context?.toLowerCase().includes('комисси') || context?.toLowerCase().includes('агрегатор')) {
    return pains[0]; // Комиссии
  }
  
  if (context?.toLowerCase().includes('доставк') || context?.toLowerCase().includes('курьер')) {
    return pains[1]; // Время доставки
  }
  
  if (context?.toLowerCase().includes('клиент') || context?.toLowerCase().includes('повторн')) {
    return pains[2]; // Повторные заказы
  }
  
  // Случайная боль
  return pains[Math.floor(Math.random() * pains.length)];
}

