/**
 * Конфигурация доступных скреперов
 */

// Популярные города СНГ
export const CITIES = [
  // Россия
  { value: 'Москва', label: '🇷🇺 Москва', country: 'RU' },
  { value: 'Санкт-Петербург', label: '🇷🇺 Санкт-Петербург', country: 'RU' },
  { value: 'Казань', label: '🇷🇺 Казань', country: 'RU' },
  { value: 'Екатеринбург', label: '🇷🇺 Екатеринбург', country: 'RU' },
  { value: 'Новосибирск', label: '🇷🇺 Новосибирск', country: 'RU' },
  { value: 'Нижний Новгород', label: '🇷🇺 Нижний Новгород', country: 'RU' },
  { value: 'Сочи', label: '🇷🇺 Сочи', country: 'RU' },
  { value: 'Краснодар', label: '🇷🇺 Краснодар', country: 'RU' },
  { value: 'Ростов-на-Дону', label: '🇷🇺 Ростов-на-Дону', country: 'RU' },
  { value: 'Самара', label: '🇷🇺 Самара', country: 'RU' },
  // Узбекистан
  { value: 'Ташкент', label: '🇺🇿 Ташкент', country: 'UZ' },
  { value: 'Самарканд', label: '🇺🇿 Самарканд', country: 'UZ' },
  { value: 'Бухара', label: '🇺🇿 Бухара', country: 'UZ' },
  { value: 'Фергана', label: '🇺🇿 Фергана', country: 'UZ' },
  { value: 'Наманган', label: '🇺🇿 Наманган', country: 'UZ' },
  { value: 'Андижан', label: '🇺🇿 Андижан', country: 'UZ' },
  // Казахстан
  { value: 'Алматы', label: '🇰🇿 Алматы', country: 'KZ' },
  { value: 'Астана', label: '🇰🇿 Астана', country: 'KZ' },
  { value: 'Шымкент', label: '🇰🇿 Шымкент', country: 'KZ' },
  // Беларусь
  { value: 'Минск', label: '🇧🇾 Минск', country: 'BY' },
  // Грузия  
  { value: 'Тбилиси', label: '🇬🇪 Тбилиси', country: 'GE' },
  { value: 'Батуми', label: '🇬🇪 Батуми', country: 'GE' },
  // Азербайджан
  { value: 'Баку', label: '🇦🇿 Баку', country: 'AZ' },
  // Армения
  { value: 'Ереван', label: '🇦🇲 Ереван', country: 'AM' },
  // Киргизия
  { value: 'Бишкек', label: '🇰🇬 Бишкек', country: 'KG' },
  // Таджикистан
  { value: 'Душанбе', label: '🇹🇯 Душанбе', country: 'TJ' },
  // Туркменистан
  { value: 'Ашхабад', label: '🇹🇲 Ашхабад', country: 'TM' },
];

// Категории заведений
export const CATEGORIES = [
  { value: 'рестораны', label: '🍽️ Рестораны', icon: '🍽️' },
  { value: 'кафе', label: '☕ Кафе', icon: '☕' },
  { value: 'бары', label: '🍺 Бары и пабы', icon: '🍺' },
  { value: 'фастфуд', label: '🍔 Фастфуд', icon: '🍔' },
  { value: 'кофейни', label: '☕ Кофейни', icon: '☕' },
  { value: 'пиццерии', label: '🍕 Пиццерии', icon: '🍕' },
  { value: 'суши', label: '🍣 Суши и роллы', icon: '🍣' },
  { value: 'шашлычные', label: '🥩 Шашлычные', icon: '🥩' },
  { value: 'столовые', label: '🥘 Столовые', icon: '🥘' },
  { value: 'кондитерские', label: '🧁 Кондитерские', icon: '🧁' },
  { value: 'пекарни', label: '🥐 Пекарни', icon: '🥐' },
  { value: 'чайханы', label: '🍵 Чайханы', icon: '🍵' },
  { value: 'пловные', label: '🍚 Пловные', icon: '🍚' },
  { value: 'узбекская кухня', label: '🥟 Узбекская кухня', icon: '🥟' },
  { value: 'грузинская кухня', label: '🍖 Грузинская кухня', icon: '🍖' },
  { value: 'итальянская кухня', label: '🍝 Итальянская кухня', icon: '🍝' },
  { value: 'азиатская кухня', label: '🥢 Азиатская кухня', icon: '🥢' },
  { value: 'европейская кухня', label: '🍷 Европейская кухня', icon: '🍷' },
];

// Количество записей
export const RESULT_LIMITS = [
  { value: 20, label: '20 мест (тест)' },
  { value: 50, label: '50 мест' },
  { value: 100, label: '100 мест' },
  { value: 200, label: '200 мест' },
  { value: 500, label: '500 мест' },
  { value: 1000, label: '1000 мест (макс)' },
];

export interface ScraperField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'array' | 'object' | 'boolean';
  description: string;
  example: any;
  required?: boolean;
  mapTo?: string; // К какому полю в БД маппится
}

export type InputFieldType = 'text' | 'number' | 'select' | 'city' | 'category';

export interface InputField {
  key: string;
  label: string;
  type: InputFieldType;
  placeholder?: string;
  options?: { value: string; label: string }[];
  default: any;
}

export interface ScraperConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  actorId: string;
  costPerItem: number; // Примерная стоимость в $ за 1 элемент
  avgTimePerItem: number; // Секунд на 1 элемент
  fields: ScraperField[];
  defaultInput: Record<string, any>;
  inputFields: InputField[];
}

export const SCRAPERS: ScraperConfig[] = [
  {
    id: 'google-maps',
    name: 'Google Maps',
    description: 'Парсинг ресторанов, кафе и других заведений из Google Maps',
    icon: '🗺️',
    actorId: 'compass/crawler-google-places',
    costPerItem: 0.002, // ~$0.002 за место
    avgTimePerItem: 2, // ~2 секунды на место
    fields: [
      { key: 'title', label: 'Название', type: 'string', description: 'Название заведения', example: 'Ресторан Пушкин', required: true, mapTo: 'name' },
      { key: 'address', label: 'Адрес', type: 'string', description: 'Полный адрес', example: 'Тверской б-р, 26А, Москва', required: true, mapTo: 'address' },
      { key: 'city', label: 'Город', type: 'string', description: 'Город', example: 'Москва', mapTo: 'city' },
      { key: 'location.lat', label: 'Широта', type: 'number', description: 'Координата широты', example: 55.7558, mapTo: 'latitude' },
      { key: 'location.lng', label: 'Долгота', type: 'number', description: 'Координата долготы', example: 37.6173, mapTo: 'longitude' },
      { key: 'phone', label: 'Телефон', type: 'string', description: 'Номер телефона', example: '+7 495 123-45-67', mapTo: 'phone' },
      { key: 'website', label: 'Сайт', type: 'string', description: 'URL сайта', example: 'https://example.com', mapTo: 'website' },
      { key: 'totalScore', label: 'Рейтинг', type: 'number', description: 'Средний рейтинг (1-5)', example: 4.5, mapTo: 'rating' },
      { key: 'reviewsCount', label: 'Кол-во отзывов', type: 'number', description: 'Количество отзывов', example: 234, mapTo: 'ratingCount' },
      { key: 'price', label: 'Ценовая категория', type: 'string', description: 'Уровень цен ($-$$$$)', example: '$$', mapTo: 'priceRange' },
      { key: 'categories', label: 'Категории', type: 'array', description: 'Типы кухни/заведения', example: ['Ресторан', 'Европейская кухня'], mapTo: 'cuisine' },
      { key: 'imageUrls', label: 'Фото', type: 'array', description: 'URLs фотографий', example: ['https://...'], mapTo: 'images' },
      { key: 'url', label: 'Ссылка на карты', type: 'string', description: 'URL в Google Maps', example: 'https://maps.google.com/...', mapTo: 'sourceUrl' },
      { key: 'placeId', label: 'Place ID', type: 'string', description: 'Уникальный ID места', example: 'ChIJxxxxxx', required: true, mapTo: 'sourceId' },
      { key: 'openingHours', label: 'Время работы', type: 'array', description: 'Расписание работы', example: ['Пн: 10:00-22:00'] },
      { key: 'reviews', label: 'Отзывы', type: 'array', description: 'Список отзывов', example: [{ author: 'Иван', rating: 5, text: '...' }] },
    ],
    defaultInput: {
      language: 'ru',
      deeperCityScrape: false,
      skipClosedPlaces: false,
    },
    inputFields: [
      { key: 'searchQuery', label: 'Категория', type: 'category', placeholder: 'Что искать...', default: 'рестораны' },
      { key: 'location', label: 'Город', type: 'city', placeholder: 'Выберите город', default: 'Ташкент' },
      { key: 'maxResults', label: 'Количество', type: 'select', options: RESULT_LIMITS.map(l => ({ value: String(l.value), label: l.label })), default: 100 },
    ],
  },
  {
    id: 'google-reviews',
    name: 'Google Maps Отзывы',
    description: 'Парсинг отзывов для конкретного заведения',
    icon: '⭐',
    actorId: 'compass/crawler-google-places',
    costPerItem: 0.001,
    avgTimePerItem: 0.5,
    fields: [
      { key: 'author', label: 'Автор', type: 'string', description: 'Имя автора отзыва', example: 'Иван Петров' },
      { key: 'rating', label: 'Оценка', type: 'number', description: 'Оценка 1-5', example: 5 },
      { key: 'text', label: 'Текст отзыва', type: 'string', description: 'Содержание отзыва', example: 'Отличное место!' },
      { key: 'publishedAtDate', label: 'Дата', type: 'string', description: 'Дата публикации', example: '2024-01-15' },
      { key: 'likesCount', label: 'Лайки', type: 'number', description: 'Количество лайков', example: 12 },
    ],
    defaultInput: {
      language: 'ru',
      maxReviews: 100,
    },
    inputFields: [
      { key: 'placeUrl', label: 'Ссылка на место', type: 'text', placeholder: 'https://maps.google.com/...', default: '' },
      { key: 'maxReviews', label: 'Макс. отзывов', type: 'number', default: 100 },
    ],
  },
  {
    id: 'yandex-maps',
    name: 'Яндекс.Карты',
    description: 'Парсинг заведений из Яндекс.Карт',
    icon: '🔴',
    actorId: 'johnvc/Scrape-Yandex',
    costPerItem: 0.003,
    avgTimePerItem: 2,
    fields: [
      { key: 'name', label: 'Название', type: 'string', description: 'Название заведения', example: 'Кафе Пушкин', required: true, mapTo: 'name' },
      { key: 'address', label: 'Адрес', type: 'string', description: 'Полный адрес', example: 'ул. Тверская, 26А', required: true, mapTo: 'address' },
      { key: 'coordinates', label: 'Координаты', type: 'object', description: 'lat/lon', example: { lat: 55.76, lon: 37.59 }, mapTo: 'coordinates' },
      { key: 'rating', label: 'Рейтинг', type: 'number', description: 'Рейтинг 1-5', example: 4.8, mapTo: 'rating' },
      { key: 'reviewsCount', label: 'Кол-во отзывов', type: 'number', description: 'Количество отзывов', example: 500, mapTo: 'ratingCount' },
      { key: 'phone', label: 'Телефон', type: 'string', description: 'Телефон', example: '+7 495 739-00-33', mapTo: 'phone' },
      { key: 'website', label: 'Сайт', type: 'string', description: 'URL сайта', example: 'https://cafe-pushkin.ru', mapTo: 'website' },
      { key: 'photos', label: 'Фото', type: 'array', description: 'URLs фотографий', example: ['https://...'], mapTo: 'images' },
      { key: 'categories', label: 'Категории', type: 'array', description: 'Типы заведения', example: ['Ресторан', 'Кафе'], mapTo: 'cuisine' },
      { key: 'url', label: 'Ссылка', type: 'string', description: 'URL на Яндекс.Картах', example: 'https://yandex.ru/maps/org/...', mapTo: 'sourceUrl' },
    ],
    defaultInput: { language: 'ru' },
    inputFields: [
      { key: 'searchQuery', label: 'Категория', type: 'category', placeholder: 'Что искать...', default: 'рестораны' },
      { key: 'location', label: 'Город', type: 'city', placeholder: 'Выберите город', default: 'Ташкент' },
      { key: 'maxResults', label: 'Количество', type: 'select', options: RESULT_LIMITS.map(l => ({ value: String(l.value), label: l.label })), default: 100 },
    ],
  },
  {
    id: '2gis',
    name: '2ГИС',
    description: 'Парсинг заведений из 2ГИС',
    icon: '🟢',
    actorId: 'm_mamaev/2gis-places-scraper',
    costPerItem: 0.002,
    avgTimePerItem: 1.5,
    fields: [
      { key: 'name', label: 'Название', type: 'string', description: 'Название заведения', example: 'Теремок', required: true, mapTo: 'name' },
      { key: 'address', label: 'Адрес', type: 'string', description: 'Полный адрес', example: 'ул. Арбат, 10', required: true, mapTo: 'address' },
      { key: 'lat', label: 'Широта', type: 'number', description: 'Координата', example: 55.75, mapTo: 'latitude' },
      { key: 'lon', label: 'Долгота', type: 'number', description: 'Координата', example: 37.59, mapTo: 'longitude' },
      { key: 'rating', label: 'Рейтинг', type: 'number', description: 'Рейтинг', example: 4.5, mapTo: 'rating' },
      { key: 'reviewCount', label: 'Кол-во отзывов', type: 'number', description: 'Количество отзывов', example: 234, mapTo: 'ratingCount' },
      { key: 'phone', label: 'Телефон', type: 'string', description: 'Телефон', example: '+7 495 123-45-67', mapTo: 'phone' },
      { key: 'website', label: 'Сайт', type: 'string', description: 'URL сайта', example: 'https://teremok.ru', mapTo: 'website' },
      { key: 'photos', label: 'Фото', type: 'array', description: 'URLs фотографий', example: ['https://...'], mapTo: 'images' },
      { key: 'rubrics', label: 'Рубрики', type: 'array', description: 'Категории заведения', example: ['Фастфуд', 'Блинная'], mapTo: 'cuisine' },
      { key: 'link', label: 'Ссылка', type: 'string', description: 'URL на 2ГИС', example: 'https://2gis.ru/firm/...', mapTo: 'sourceUrl' },
    ],
    defaultInput: { language: 'ru' },
    inputFields: [
      { key: 'searchQuery', label: 'Категория', type: 'category', placeholder: 'Что искать...', default: 'рестораны' },
      { key: 'location', label: 'Город', type: 'city', placeholder: 'Выберите город', default: 'Ташкент' },
      { key: 'maxResults', label: 'Количество', type: 'select', options: RESULT_LIMITS.map(l => ({ value: String(l.value), label: l.label })), default: 100 },
    ],
  },
];

/**
 * Расчет стоимости парсинга
 */
export function calculateCost(scraperId: string, count: number): { cost: number; time: number; timeFormatted: string } {
  const scraper = SCRAPERS.find(s => s.id === scraperId);
  if (!scraper) return { cost: 0, time: 0, timeFormatted: '0 сек' };

  const cost = scraper.costPerItem * count;
  const time = scraper.avgTimePerItem * count;
  
  let timeFormatted: string;
  if (time < 60) {
    timeFormatted = `~${Math.round(time)} сек`;
  } else if (time < 3600) {
    timeFormatted = `~${Math.round(time / 60)} мин`;
  } else {
    timeFormatted = `~${(time / 3600).toFixed(1)} ч`;
  }

  return { cost, time, timeFormatted };
}

/**
 * Получить скрейпер по ID
 */
export function getScraper(id: string): ScraperConfig | undefined {
  return SCRAPERS.find(s => s.id === id);
}

