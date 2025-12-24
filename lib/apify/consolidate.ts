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
 * Парсит время работы в формат для БД
 */
function parseWorkingHours(hours: any): Array<{ dayOfWeek: number; openTime: string; closeTime: string }> {
  if (!hours) return [];
  
  const result: Array<{ dayOfWeek: number; openTime: string; closeTime: string }> = [];
  const dayNames: Record<string, number> = {
    'monday': 1, 'mon': 1, 'пн': 1, 'понедельник': 1,
    'tuesday': 2, 'tue': 2, 'вт': 2, 'вторник': 2,
    'wednesday': 3, 'wed': 3, 'ср': 3, 'среда': 3,
    'thursday': 4, 'thu': 4, 'чт': 4, 'четверг': 4,
    'friday': 5, 'fri': 5, 'пт': 5, 'пятница': 5,
    'saturday': 6, 'sat': 6, 'сб': 6, 'суббота': 6,
    'sunday': 0, 'sun': 0, 'вс': 0, 'воскресенье': 0,
  };

  // Если массив строк вида "Monday: 9:00 - 22:00"
  if (Array.isArray(hours)) {
    for (const h of hours) {
      if (typeof h === 'string') {
        const match = h.match(/(\w+):?\s*(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/i);
        if (match) {
          const day = dayNames[match[1].toLowerCase()];
          if (day !== undefined) {
            result.push({ dayOfWeek: day, openTime: match[2], closeTime: match[3] });
          }
        }
      } else if (typeof h === 'object' && h.day !== undefined) {
        // Формат { day: 1, open: "09:00", close: "22:00" }
        result.push({
          dayOfWeek: h.day,
          openTime: h.open || h.from || '00:00',
          closeTime: h.close || h.to || '23:59',
        });
      }
    }
  }
  // Если объект с днями { monday: "9:00-22:00", ... }
  else if (typeof hours === 'object') {
    for (const [day, time] of Object.entries(hours)) {
      const dayNum = dayNames[day.toLowerCase()];
      if (dayNum !== undefined && typeof time === 'string') {
        const match = time.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
        if (match) {
          result.push({ dayOfWeek: dayNum, openTime: match[1], closeTime: match[2] });
        }
      }
    }
  }
  
  return result;
}

/**
 * Парсит отзывы в формат для БД
 */
function parseReviews(reviews: any[]): Array<{ author: string; text: string; rating: number; date: Date }> {
  if (!Array.isArray(reviews)) return [];
  
  return reviews.slice(0, 10).map(r => ({
    author: r.author || r.authorName || r.name || r.user || 'Аноним',
    text: r.text || r.comment || r.review || r.content || '',
    rating: r.rating || r.stars || r.score || 5,
    date: r.date ? new Date(r.date) : new Date(),
  })).filter(r => r.text); // Только с текстом
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
  const { name, latitude, longitude, sourceId, _openingHours, _reviews, ...rest } = data;
  
  if (!name || !latitude || !longitude) {
    throw new Error('Missing required fields for consolidation');
  }

  // Инкрементальная проверка - пропускаем если данные не изменились
  if (options?.incremental) {
    const changed = await hasDataChanged(source, sourceId, { name, ...rest });
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
  const reviews = parseReviews(_reviews);

  // Ищем существующий дубликат
  const duplicate = await findDuplicate(name, latitude, longitude, source, sourceId);
  
  if (duplicate) {
    // Объединяем данные
    const mergedData = mergeRestaurantData(duplicate, { ...rest, name, latitude, longitude, sourceId }, source);
    
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
          data: workingHours.map(h => ({ ...h, restaurantId: duplicate.id })),
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
      data: { ...rest, name, latitude, longitude, lastSynced: new Date() },
    });
    
    // Обновляем время работы
    if (workingHours.length > 0) {
      await prisma.workingHours.deleteMany({ where: { restaurantId: existing.id } });
      await prisma.workingHours.createMany({
        data: workingHours.map(h => ({ ...h, restaurantId: existing.id })),
      });
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
      source, 
      sourceId,
      // Время работы
      workingHours: workingHours.length > 0 ? {
        create: workingHours,
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

