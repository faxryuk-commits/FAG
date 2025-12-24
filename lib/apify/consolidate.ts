import { prisma } from '@/lib/prisma';

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
 * Сохраняет ресторан с консолидацией
 */
export async function saveWithConsolidation(source: string, data: any) {
  const { name, latitude, longitude, sourceId, ...rest } = data;
  
  if (!name || !latitude || !longitude) {
    throw new Error('Missing required fields for consolidation');
  }

  // Ищем существующий дубликат
  const duplicate = await findDuplicate(name, latitude, longitude, source, sourceId);
  
  if (duplicate) {
    // Объединяем данные
    const mergedData = mergeRestaurantData(duplicate, data, source);
    
    // Обновляем существующую запись
    await prisma.restaurant.update({
      where: { id: duplicate.id },
      data: {
        ...mergedData,
        lastSynced: new Date(),
        // Не меняем source и sourceId основной записи
      },
    });
    
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
      data: { ...data, lastSynced: new Date() },
    });
    return { action: 'updated', id: existing.id };
  }
  
  // Создаем новую запись
  const created = await prisma.restaurant.create({
    data: { ...data, source, sourceId },
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

