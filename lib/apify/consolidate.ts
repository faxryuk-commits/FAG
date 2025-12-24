import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * Консолидация данных из разных источников
 * Объединяет дубликаты ресторанов в одну запись
 */

// Приоритет источников (чем выше, тем лучше данные)
const SOURCE_PRIORITY: Record<string, number> = {
  google: 3,  // Самые полные данные
  yandex: 2,  // Хорошие данные для РФ
  '2gis': 1,  // Базовые данные
};

/**
 * Маппинг ключевых слов на стандартизированные категории кухни
 */
const CUISINE_MAPPING: Record<string, string[]> = {
  // Узбекская
  'Узбекская кухня': ['узбек', 'uzbek', 'плов', 'plov', 'самса', 'samsa', 'лагман', 'lagman', 'шурпа', 'чайхана', 'чайхона'],
  // Европейская
  'Европейская кухня': ['европ', 'europ', 'western', 'continental', 'french', 'франц', 'german', 'немец', 'итальян', 'italian', 'spanish', 'испан'],
  // Азиатская
  'Азиатская кухня': ['азиат', 'asian', 'china', 'китай', 'japan', 'япон', 'korea', 'корей', 'вьетнам', 'vietnam', 'thai', 'тайск', 'wok', 'вок', 'noodle', 'лапша'],
  // Мясо/Гриль
  'Мясо и гриль': ['мясо', 'meat', 'стейк', 'steak', 'гриль', 'grill', 'шашлык', 'bbq', 'барбекю', 'kebab', 'кебаб', 'мангал'],
  // Пицца
  'Пиццерия': ['пицц', 'pizza'],
  // Суши
  'Суши и роллы': ['суши', 'sushi', 'ролл', 'roll', 'sashimi', 'сашими'],
  // Кофейня
  'Кофейня': ['кофе', 'coffee', 'cafe', 'espresso', 'эспрессо', 'капучино', 'cappuccino'],
  // Бар
  'Бар': ['бар', 'bar', 'pub', 'паб', 'пиво', 'beer', 'cocktail', 'коктейл'],
  // Фастфуд
  'Фастфуд': ['фаст', 'fast', 'фуд', 'food', 'бургер', 'burger', 'хот-дог', 'hotdog', 'quick'],
  // Кондитерская
  'Кондитерская': ['десерт', 'dessert', 'торт', 'cake', 'выпечка', 'bakery', 'пекарн', 'сладк', 'sweet'],
  // Ресторан (общий)
  'Ресторан': ['ресторан', 'restaurant', 'dining'],
  // Кафе (общий)
  'Кафе': ['кафе', 'cafe', 'столовая', 'canteen', 'bistro', 'бистро'],
};

/**
 * Нормализует и обогащает массив категорий кухни
 */
export function normalizeCuisine(cuisineArray: string[], name?: string): string[] {
  const result = new Set<string>();
  
  // Объединяем все данные для анализа
  const allText = [...cuisineArray, name || ''].join(' ').toLowerCase();
  
  // Сохраняем оригинальные категории (очищенные)
  for (const cuisine of cuisineArray) {
    if (cuisine && typeof cuisine === 'string') {
      const cleaned = cuisine.trim();
      if (cleaned.length > 0 && cleaned.length < 50) {
        result.add(cleaned);
      }
    }
  }
  
  // Добавляем стандартизированные категории на основе ключевых слов
  for (const [standardCategory, keywords] of Object.entries(CUISINE_MAPPING)) {
    for (const keyword of keywords) {
      if (allText.includes(keyword.toLowerCase())) {
        result.add(standardCategory);
        break;
      }
    }
  }
  
  return [...result].slice(0, 10); // Максимум 10 категорий
}

/**
 * Вычисляет хеш данных для инкрементального парсинга
 */
export function calculateDataHash(data: any): string {
  // Создаём объект с ключевыми полями для сравнения
  const hashSource = {
    name: data.name,
    address: data.address,
    phone: data.phone,
    rating: data.rating,
    ratingCount: data.ratingCount,
    images: data.images?.slice(0, 3), // Первые 3 фото
  };
  
  return crypto
    .createHash('md5')
    .update(JSON.stringify(hashSource))
    .digest('hex');
}

/**
 * Проверяет, изменились ли данные
 */
export async function hasDataChanged(source: string, sourceId: string, newData: any): Promise<boolean> {
  const existing = await prisma.restaurant.findFirst({
    where: { source, sourceId },
    select: { 
      name: true, 
      address: true, 
      phone: true, 
      rating: true, 
      ratingCount: true,
      images: true,
    },
  });
  
  if (!existing) {
    return true; // Новая запись - считаем изменённой
  }
  
  const existingHash = calculateDataHash(existing);
  const newHash = calculateDataHash(newData);
  
  return existingHash !== newHash;
}

/**
 * Статистика инкрементального парсинга
 */
export interface IncrementalStats {
  total: number;
  new: number;
  updated: number;
  unchanged: number;
  merged: number;
}

/**
 * Нормализует название для сравнения
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[«»"'`]/g, '')
    .replace(/ресторан|кафе|бар|паб|столовая|кофейня/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Вычисляет расстояние между двумя точками (в метрах)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Радиус Земли в метрах
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Вычисляет схожесть двух строк (0-1)
 */
function stringSimilarity(str1: string, str2: string): number {
  const s1 = normalizeName(str1);
  const s2 = normalizeName(str2);
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  // Простой алгоритм схожести на основе общих слов
  const words1 = new Set(s1.split(' ').filter(w => w.length > 2));
  const words2 = new Set(s2.split(' ').filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;
  
  return intersection / union;
}

/**
 * Находит потенциальный дубликат ресторана
 */
export async function findDuplicate(
  name: string,
  latitude: number,
  longitude: number,
  excludeSource?: string,
  excludeSourceId?: string
) {
  // Ищем рестораны в радиусе 100 метров
  const candidates = await prisma.restaurant.findMany({
    where: {
      latitude: { gte: latitude - 0.001, lte: latitude + 0.001 }, // ~100м
      longitude: { gte: longitude - 0.001, lte: longitude + 0.001 },
      NOT: excludeSource && excludeSourceId ? {
        source: excludeSource,
        sourceId: excludeSourceId,
      } : undefined,
    },
  });

  for (const candidate of candidates) {
    const distance = calculateDistance(latitude, longitude, candidate.latitude, candidate.longitude);
    const nameSimilarity = stringSimilarity(name, candidate.name);
    
    // Считаем дубликатом если:
    // - Расстояние < 50м И схожесть названия > 0.5
    // - ИЛИ расстояние < 20м И любое название (один и тот же адрес)
    if ((distance < 50 && nameSimilarity > 0.5) || (distance < 20)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Объединяет данные из двух записей
 * Приоритет отдается источнику с большим весом
 */
export function mergeRestaurantData(existing: any, newData: any, newSource: string) {
  const existingPriority = SOURCE_PRIORITY[existing.source] || 0;
  const newPriority = SOURCE_PRIORITY[newSource] || 0;
  
  // Функция выбора лучшего значения
  const pickBest = (existingVal: any, newVal: any, preferNew = false) => {
    if (!existingVal && newVal) return newVal;
    if (existingVal && !newVal) return existingVal;
    if (preferNew || newPriority > existingPriority) return newVal;
    return existingVal;
  };

  // Объединяем массивы (уникальные значения)
  const mergeArrays = (arr1: any[] = [], arr2: any[] = []) => {
    const set = new Set([...arr1, ...arr2].filter(Boolean));
    return [...set];
  };

  return {
    // Основные поля - берем из лучшего источника
    name: pickBest(existing.name, newData.name),
    address: pickBest(existing.address, newData.address),
    city: pickBest(existing.city, newData.city),
    
    // Координаты - берем более точные (от Google обычно лучше)
    latitude: pickBest(existing.latitude, newData.latitude),
    longitude: pickBest(existing.longitude, newData.longitude),
    
    // Контакты - объединяем
    phone: pickBest(existing.phone, newData.phone),
    website: pickBest(existing.website, newData.website),
    email: pickBest(existing.email, newData.email),
    
    // Рейтинг - берем средний или лучший
    rating: existing.rating && newData.rating 
      ? Math.round(((existing.rating + newData.rating) / 2) * 10) / 10
      : pickBest(existing.rating, newData.rating),
    ratingCount: Math.max(existing.ratingCount || 0, newData.ratingCount || 0),
    
    // Массивы - объединяем
    images: mergeArrays(existing.images, newData.images).slice(0, 10), // Макс 10 фото
    cuisine: mergeArrays(existing.cuisine, newData.cuisine),
    
    // Цена - берем если есть
    priceRange: pickBest(existing.priceRange, newData.priceRange),
    
    // Сохраняем информацию о всех источниках
    // (главный источник остается, но добавляем метаданные)
    description: existing.description || newData.description || 
      `Данные из: ${existing.source}${newSource !== existing.source ? `, ${newSource}` : ''}`,
  };
}

/**
 * Конвертирует время из AM/PM формата в 24-часовой
 */
function convertTo24Hour(time: string): string {
  if (!time) return '00:00';
  
  // Уже в 24-часовом формате
  if (/^\d{1,2}:\d{2}$/.test(time.trim())) {
    const [h, m] = time.trim().split(':');
    return `${h.padStart(2, '0')}:${m}`;
  }
  
  // AM/PM формат
  const match = time.match(/(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)/i);
  if (match) {
    let hours = parseInt(match[1]);
    const minutes = match[2] || '00';
    const period = match[3].toLowerCase();
    
    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }
  
  // Только число (часы)
  const hourMatch = time.match(/^(\d{1,2})$/);
  if (hourMatch) {
    return `${hourMatch[1].padStart(2, '0')}:00`;
  }
  
  return '00:00';
}

/**
 * Проверяет, указывает ли строка на закрытие
 */
function isClosedIndicator(str: string): boolean {
  if (!str) return false;
  const normalized = str.toLowerCase().trim();
  return normalized === 'closed' || 
         normalized === 'закрыто' || 
         normalized === 'выходной' ||
         normalized === 'не работает' ||
         normalized.includes('closed') ||
         normalized.includes('закрыт');
}

/**
 * Парсит время работы в формат для БД
 */
function parseWorkingHours(hours: any): Array<{ dayOfWeek: number; openTime: string; closeTime: string; isClosed?: boolean }> {
  if (!hours) return [];
  
  const result: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isClosed?: boolean }> = [];
  const dayNames: Record<string, number> = {
    // English
    'sunday': 0, 'sun': 0,
    'monday': 1, 'mon': 1,
    'tuesday': 2, 'tue': 2,
    'wednesday': 3, 'wed': 3,
    'thursday': 4, 'thu': 4,
    'friday': 5, 'fri': 5,
    'saturday': 6, 'sat': 6,
    // Russian
    'вс': 0, 'воскресенье': 0,
    'пн': 1, 'понедельник': 1,
    'вт': 2, 'вторник': 2,
    'ср': 3, 'среда': 3,
    'чт': 4, 'четверг': 4,
    'пт': 5, 'пятница': 5,
    'сб': 6, 'суббота': 6,
  };

  // Вспомогательная функция для конвертации дня в число
  const getDayNumber = (day: any): number | undefined => {
    if (typeof day === 'number' && day >= 0 && day <= 6) {
      return day;
    }
    if (typeof day === 'string') {
      const normalized = day.toLowerCase().trim();
      if (dayNames[normalized] !== undefined) {
        return dayNames[normalized];
      }
      // Попробуем найти частичное совпадение
      for (const [name, num] of Object.entries(dayNames)) {
        if (normalized.includes(name) || name.includes(normalized)) {
          return num;
        }
      }
    }
    return undefined;
  };

  // Парсит строку времени вида "9:00 AM – 10:00 PM" или "09:00-22:00"
  const parseTimeRange = (timeStr: string): { open: string; close: string; isClosed: boolean } | null => {
    if (!timeStr) return null;
    
    // Проверяем на закрытие
    if (isClosedIndicator(timeStr)) {
      return { open: '00:00', close: '00:00', isClosed: true };
    }
    
    // 24/7 или круглосуточно
    if (/24\s*(\/|часа|hours)|круглосуточно/i.test(timeStr)) {
      return { open: '00:00', close: '23:59', isClosed: false };
    }
    
    // Паттерн для времени с AM/PM: "9:00 AM – 10:00 PM"
    const ampmMatch = timeStr.match(/(\d{1,2}:?\d{0,2}\s*(?:am|pm)?)\s*[-–—⁃]\s*(\d{1,2}:?\d{0,2}\s*(?:am|pm)?)/i);
    if (ampmMatch) {
      return {
        open: convertTo24Hour(ampmMatch[1]),
        close: convertTo24Hour(ampmMatch[2]),
        isClosed: false,
      };
    }
    
    // Паттерн для 24h формата: "09:00-22:00"
    const h24Match = timeStr.match(/(\d{1,2}:\d{2})\s*[-–—⁃]\s*(\d{1,2}:\d{2})/);
    if (h24Match) {
      return {
        open: h24Match[1].padStart(5, '0'),
        close: h24Match[2].padStart(5, '0'),
        isClosed: false,
      };
    }
    
    return null;
  };

  // Если массив строк или объектов
  if (Array.isArray(hours)) {
    for (const h of hours) {
      if (typeof h === 'string') {
        // Формат "Monday: 9:00 AM – 10:00 PM" или "понедельник: 09:00-22:00"
        const colonMatch = h.match(/^([а-яёa-z]+)\s*[:\s]+(.+)$/i);
        if (colonMatch) {
          const dayNum = getDayNumber(colonMatch[1]);
          const timeRange = parseTimeRange(colonMatch[2]);
          if (dayNum !== undefined && timeRange) {
            result.push({
              dayOfWeek: dayNum,
              openTime: timeRange.open,
              closeTime: timeRange.close,
              isClosed: timeRange.isClosed,
            });
          }
        }
      } else if (typeof h === 'object' && h !== null) {
        // Формат объекта { day/dayOfWeek: ..., hours/open/openTime: ... }
        const dayNum = getDayNumber(h.day) ?? getDayNumber(h.dayOfWeek);
        
        if (dayNum !== undefined) {
          // Если есть поле hours (как в Google Maps)
          if (h.hours) {
            const timeRange = parseTimeRange(h.hours);
            if (timeRange) {
              result.push({
                dayOfWeek: dayNum,
                openTime: timeRange.open,
                closeTime: timeRange.close,
                isClosed: timeRange.isClosed,
              });
              continue;
            }
          }
          
          // Если есть отдельные поля open/close
          const openTime = h.openTime || h.open || h.from || h.start;
          const closeTime = h.closeTime || h.close || h.to || h.end;
          
          if (openTime && closeTime) {
            result.push({
              dayOfWeek: dayNum,
              openTime: convertTo24Hour(openTime),
              closeTime: convertTo24Hour(closeTime),
              isClosed: h.isClosed || false,
            });
          } else if (h.isClosed || isClosedIndicator(String(h.hours || ''))) {
            result.push({
              dayOfWeek: dayNum,
              openTime: '00:00',
              closeTime: '00:00',
              isClosed: true,
            });
          }
        }
      }
    }
  }
  // Если объект с днями { monday: "9:00-22:00", ... }
  else if (typeof hours === 'object') {
    for (const [day, time] of Object.entries(hours)) {
      const dayNum = getDayNumber(day);
      if (dayNum !== undefined) {
        if (typeof time === 'string') {
          const timeRange = parseTimeRange(time);
          if (timeRange) {
            result.push({
              dayOfWeek: dayNum,
              openTime: timeRange.open,
              closeTime: timeRange.close,
              isClosed: timeRange.isClosed,
            });
          }
        } else if (typeof time === 'object' && time !== null) {
          const t = time as any;
          const openTime = t.open || t.from || t.start || t.openTime;
          const closeTime = t.close || t.to || t.end || t.closeTime;
          
          if (openTime && closeTime) {
            result.push({
              dayOfWeek: dayNum,
              openTime: convertTo24Hour(openTime),
              closeTime: convertTo24Hour(closeTime),
              isClosed: t.isClosed || false,
            });
          } else if (t.isClosed === true) {
            // Обработка дня, который явно помечен как закрытый
            result.push({
              dayOfWeek: dayNum,
              openTime: '00:00',
              closeTime: '00:00',
              isClosed: true,
            });
          }
        }
      }
    }
  }
  
  // Финальная проверка - убедиться что все dayOfWeek числа
  return result
    .filter(h => typeof h.dayOfWeek === 'number' && !isNaN(h.dayOfWeek))
    .map(h => ({
      dayOfWeek: h.dayOfWeek,
      openTime: h.openTime || '00:00',
      closeTime: h.closeTime || '23:59',
      isClosed: h.isClosed,
    }));
}

/**
 * Детальный интерфейс отзыва
 */
interface ParsedReview {
  author: string;
  authorId: string | null;
  authorUrl: string | null;
  authorAvatar: string | null;
  authorLevel: string | null;
  authorReviewsCount: number | null;
  authorPhotosCount: number | null;
  isLocalGuide: boolean;
  rating: number;
  text: string;
  date: Date;
  photos: string[];
  ownerResponse: string | null;
  ownerResponseDate: Date | null;
  likesCount: number;
  language: string | null;
  translatedText: string | null;
  source: string;
  sourceId: string | null;
  sourceUrl: string | null;
}

/**
 * Парсит отзывы в детальный формат для БД
 */
function parseReviews(reviews: any[], source: string): ParsedReview[] {
  if (!Array.isArray(reviews)) return [];
  
  return reviews.slice(0, 20).map(r => {
    // Определяем автора
    const author = r.author || r.authorName || r.name || r.user || r.reviewer?.name || 'Аноним';
    
    // ID и URL автора
    const authorId = r.authorId || r.reviewerId || r.userId || r.reviewer?.id || null;
    const authorUrl = r.authorUrl || r.reviewerUrl || r.userUrl || r.reviewer?.url || null;
    
    // Аватар автора
    const authorAvatar = r.authorAvatar || r.reviewerAvatar || r.avatar || 
                         r.profilePhotoUrl || r.reviewer?.avatar || r.reviewer?.profilePhoto || null;
    
    // Уровень автора (Local Guide и т.д.)
    const authorLevel = r.authorLevel || r.reviewerLevel || r.badge || 
                        r.localGuideLevel || r.reviewer?.level || null;
    
    // Количество отзывов/фото автора
    const authorReviewsCount = r.reviewerNumberOfReviews || r.authorReviewsCount || 
                               r.reviewer?.reviewsCount || null;
    const authorPhotosCount = r.reviewerNumberOfPhotos || r.authorPhotosCount || 
                              r.reviewer?.photosCount || null;
    
    // Local Guide
    const isLocalGuide = r.isLocalGuide || r.localGuide || 
                         (authorLevel && authorLevel.toLowerCase().includes('local guide')) || false;
    
    // Фото в отзыве
    let photos: string[] = [];
    if (r.reviewImageUrls && Array.isArray(r.reviewImageUrls)) {
      photos = r.reviewImageUrls;
    } else if (r.photos && Array.isArray(r.photos)) {
      photos = r.photos.map((p: any) => typeof p === 'string' ? p : p.url);
    } else if (r.images && Array.isArray(r.images)) {
      photos = r.images;
    }
    
    // Ответ владельца
    const ownerResponse = r.ownerResponse || r.responseFromOwnerText || 
                          r.ownerReply || r.reply?.text || null;
    
    // Безопасный парсинг даты ответа владельца
    let ownerResponseDate: Date | null = null;
    const rawOwnerDate = r.ownerResponseDate || r.responseFromOwnerDate || r.reply?.date;
    if (rawOwnerDate) {
      const parsed = new Date(rawOwnerDate);
      // Проверяем что дата валидна
      if (!isNaN(parsed.getTime())) {
        ownerResponseDate = parsed;
      }
    }
    
    // Полезность
    const likesCount = r.likesCount || r.reviewLikesCount || r.helpful || r.likes || 0;
    
    // Язык
    const language = r.language || r.reviewLanguage || r.lang || null;
    const translatedText = r.translatedText || r.textTranslated || r.translation || null;
    
    // ID отзыва
    const sourceId = r.reviewId || r.id || r.sourceId || null;
    const sourceUrl = r.reviewUrl || r.url || r.link || null;
    
    // Безопасный парсинг даты отзыва
    let reviewDate = new Date();
    const rawDate = r.date || r.publishedAtDate || r.reviewDate;
    if (rawDate) {
      const parsed = new Date(rawDate);
      if (!isNaN(parsed.getTime())) {
        reviewDate = parsed;
      }
    }
    
    return {
      author,
      authorId,
      authorUrl,
      authorAvatar,
      authorLevel,
      authorReviewsCount,
      authorPhotosCount,
      isLocalGuide,
      rating: r.rating || r.stars || r.score || 5,
      text: r.text || r.comment || r.review || r.content || r.reviewText || '',
      date: reviewDate,
      photos: photos.filter(Boolean),
      ownerResponse,
      ownerResponseDate,
      likesCount,
      language,
      translatedText,
      source,
      sourceId,
      sourceUrl,
    };
  }).filter(r => r.text || r.rating); // С текстом или рейтингом
}

/**
 * Тип действия при сохранении
 */
export type SaveAction = 'created' | 'updated' | 'merged' | 'unchanged';

/**
 * Сохраняет ресторан с консолидацией и инкрементальной проверкой
 */
export async function saveWithConsolidation(
  source: string, 
  data: any,
  options?: { incremental?: boolean }
): Promise<{ action: SaveAction; id: string; mergedWith?: string }> {
  // Извлекаем временные поля
  const { name, latitude, longitude, sourceId, _openingHours, _reviews, cuisine: rawCuisine, brand, ...rest } = data;
  
  if (!name || !latitude || !longitude) {
    throw new Error('Missing required fields for consolidation');
  }

  // Нормализуем категории кухни
  const cuisine = normalizeCuisine(rawCuisine || [], name);
  
  // Сохраняем бренд если есть
  const restaurantBrand = brand || null;

  // Инкрементальная проверка - пропускаем если данные не изменились
  if (options?.incremental) {
    const changed = await hasDataChanged(source, sourceId, { name, cuisine, ...rest });
    if (!changed) {
      const existing = await prisma.restaurant.findFirst({
        where: { source, sourceId },
        select: { id: true },
      });
      if (existing) {
        return { action: 'unchanged', id: existing.id };
      }
    }
  }

  // Парсим время работы и отзывы
  const workingHours = parseWorkingHours(_openingHours);
  const reviews = parseReviews(_reviews, source);

  // Ищем существующий дубликат
  const duplicate = await findDuplicate(name, latitude, longitude, source, sourceId);
  
  if (duplicate) {
    // Объединяем данные
    const mergedData = mergeRestaurantData(duplicate, { ...rest, name, latitude, longitude, sourceId, cuisine }, source);
    
    // Обновляем существующую запись
    await prisma.restaurant.update({
      where: { id: duplicate.id },
      data: {
        ...mergedData,
        lastSynced: new Date(),
      },
    });
    
    // Добавляем время работы если есть и нет существующих
    if (workingHours.length > 0) {
      const existingHours = await prisma.workingHours.count({ where: { restaurantId: duplicate.id } });
      if (existingHours === 0) {
        await prisma.workingHours.createMany({
          data: workingHours.map(h => ({ 
            dayOfWeek: h.dayOfWeek,
            openTime: h.openTime,
            closeTime: h.closeTime,
            isClosed: h.isClosed || false,
            restaurantId: duplicate.id,
          })),
        });
      }
    }
    
    // Добавляем отзывы
    if (reviews.length > 0) {
      for (const review of reviews) {
        // Проверяем дубликат отзыва по автору и тексту
        const exists = await prisma.review.findFirst({
          where: { restaurantId: duplicate.id, author: review.author, text: review.text },
        });
        if (!exists) {
          await prisma.review.create({
            data: { ...review, restaurantId: duplicate.id },
          });
        }
      }
    }
    
    return { action: 'merged', id: duplicate.id, mergedWith: duplicate.name };
  }
  
  // Проверяем существование по source + sourceId
  const existing = await prisma.restaurant.findFirst({
    where: { source, sourceId },
  });
  
  if (existing) {
    // Обновляем свою же запись
    await prisma.restaurant.update({
      where: { id: existing.id },
      data: { ...rest, name, latitude, longitude, cuisine, lastSynced: new Date() },
    });
    
    // Обновляем время работы
    if (workingHours.length > 0) {
      await prisma.workingHours.deleteMany({ where: { restaurantId: existing.id } });
      await prisma.workingHours.createMany({
        data: workingHours.map(h => ({ 
          dayOfWeek: h.dayOfWeek,
          openTime: h.openTime,
          closeTime: h.closeTime,
          isClosed: h.isClosed || false,
          restaurantId: existing.id,
        })),
      });
    }
    
    // Добавляем новые отзывы
    if (reviews.length > 0) {
      for (const review of reviews) {
        // Проверяем дубликат отзыва
        const exists = await prisma.review.findFirst({
          where: { 
            restaurantId: existing.id, 
            author: review.author,
            OR: [
              { text: review.text },
              { sourceId: review.sourceId },
            ]
          },
        });
        if (!exists) {
          await prisma.review.create({
            data: { ...review, restaurantId: existing.id },
          });
        }
      }
    }
    
    return { action: 'updated', id: existing.id };
  }
  
  // Создаем новую запись
  const created = await prisma.restaurant.create({
    data: { 
      ...rest, 
      name,
      latitude,
      longitude,
      cuisine,
      brand: restaurantBrand, // Бренд/сеть для группировки
      source, 
      sourceId,
      // Время работы
      workingHours: workingHours.length > 0 ? {
        create: workingHours.map(h => ({
          dayOfWeek: h.dayOfWeek,
          openTime: h.openTime,
          closeTime: h.closeTime,
          isClosed: h.isClosed || false,
        })),
      } : undefined,
      // Отзывы
      reviews: reviews.length > 0 ? {
        create: reviews,
      } : undefined,
    },
  });
  
  return { action: 'created', id: created.id };
}

/**
 * Запускает полную консолидацию всех записей
 */
export async function runFullConsolidation() {
  const restaurants = await prisma.restaurant.findMany({
    orderBy: [
      // Сначала обрабатываем источники с высоким приоритетом
      { source: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  let merged = 0;
  let processed = 0;
  const toDelete: string[] = [];

  for (const restaurant of restaurants) {
    if (toDelete.includes(restaurant.id)) continue;
    
    // Ищем дубликаты для этого ресторана
    const duplicate = await findDuplicate(
      restaurant.name,
      restaurant.latitude,
      restaurant.longitude,
      restaurant.source,
      restaurant.sourceId
    );
    
    if (duplicate && duplicate.id !== restaurant.id) {
      // Определяем какую запись оставить (с большим приоритетом)
      const keepPriority = SOURCE_PRIORITY[restaurant.source] || 0;
      const dupPriority = SOURCE_PRIORITY[duplicate.source] || 0;
      
      const [keep, remove] = keepPriority >= dupPriority 
        ? [restaurant, duplicate]
        : [duplicate, restaurant];
      
      // Объединяем данные в запись с большим приоритетом
      const mergedData = mergeRestaurantData(keep, remove, remove.source);
      
      await prisma.restaurant.update({
        where: { id: keep.id },
        data: mergedData,
      });
      
      toDelete.push(remove.id);
      merged++;
    }
    
    processed++;
  }

  // Удаляем дубликаты
  if (toDelete.length > 0) {
    await prisma.restaurant.deleteMany({
      where: { id: { in: toDelete } },
    });
  }

  return { processed, merged, deleted: toDelete.length };
}

