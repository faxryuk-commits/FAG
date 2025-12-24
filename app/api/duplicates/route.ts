import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Вычисляет расстояние между двумя точками (Haversine formula)
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
 * Вычисляет схожесть двух строк (0-1)
 */
function stringSimilarity(str1: string, str2: string): number {
  const s1 = normalizeName(str1);
  const s2 = normalizeName(str2);
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  const words1 = new Set(s1.split(' ').filter(w => w.length > 2));
  const words2 = new Set(s2.split(' ').filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;
  
  return intersection / union;
}

interface DuplicateGroup {
  id: string;
  restaurants: Array<{
    id: string;
    name: string;
    address: string;
    city: string;
    source: string;
    rating: number | null;
    ratingCount: number;
    images: string[];
    latitude: number;
    longitude: number;
    phone: string | null;
    website: string | null;
  }>;
  similarity: number;
  distance: number;
  reason: string;
}

/**
 * GET - Получить список потенциальных дубликатов
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const restaurants = await prisma.restaurant.findMany({
      where: { isArchived: false },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        source: true,
        rating: true,
        ratingCount: true,
        images: true,
        latitude: true,
        longitude: true,
        phone: true,
        website: true,
      },
      orderBy: { name: 'asc' },
    });

    const duplicateGroups: DuplicateGroup[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < restaurants.length; i++) {
      const r1 = restaurants[i];
      
      if (processed.has(r1.id)) continue;

      const group: DuplicateGroup = {
        id: `group-${i}`,
        restaurants: [r1],
        similarity: 0,
        distance: 0,
        reason: '',
      };

      for (let j = i + 1; j < restaurants.length; j++) {
        const r2 = restaurants[j];
        
        if (processed.has(r2.id)) continue;
        // Убрали ограничение: теперь находим дубликаты и из одного источника тоже

        const distance = calculateDistance(r1.latitude, r1.longitude, r2.latitude, r2.longitude);
        const nameSimilarity = stringSimilarity(r1.name, r2.name);

        // Критерии дубликата:
        // 1. Расстояние < 50м И схожесть названия > 0.5
        // 2. ИЛИ расстояние < 20м (один и тот же адрес)
        // 3. ИЛИ одинаковый телефон
        const samePhone = r1.phone && r2.phone && 
          r1.phone.replace(/\D/g, '') === r2.phone.replace(/\D/g, '');

        let isDuplicate = false;
        let reason = '';

        if (samePhone) {
          isDuplicate = true;
          reason = `📞 Одинаковый телефон: ${r1.phone}`;
        } else if (distance < 20) {
          isDuplicate = true;
          reason = `📍 Очень близко: ${Math.round(distance)}м`;
        } else if (distance < 50 && nameSimilarity > 0.5) {
          isDuplicate = true;
          reason = `🏷️ Похожие названия (${Math.round(nameSimilarity * 100)}%) на расстоянии ${Math.round(distance)}м`;
        } else if (distance < 100 && nameSimilarity > 0.8) {
          isDuplicate = true;
          reason = `🏷️ Очень похожие названия (${Math.round(nameSimilarity * 100)}%) на расстоянии ${Math.round(distance)}м`;
        }

        if (isDuplicate) {
          group.restaurants.push(r2);
          group.similarity = Math.max(group.similarity, nameSimilarity);
          group.distance = Math.max(group.distance, distance);
          group.reason = reason;
          processed.add(r2.id);
        }
      }

      // Добавляем только если нашли дубликаты
      if (group.restaurants.length > 1) {
        processed.add(r1.id);
        duplicateGroups.push(group);
      }
    }

    // Сортируем по количеству дубликатов
    duplicateGroups.sort((a, b) => b.restaurants.length - a.restaurants.length);

    // Пагинация
    const paginatedGroups = duplicateGroups.slice(offset, offset + limit);

    return NextResponse.json({
      total: duplicateGroups.length,
      totalRestaurants: duplicateGroups.reduce((sum, g) => sum + g.restaurants.length, 0),
      groups: paginatedGroups,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < duplicateGroups.length,
      },
    });
  } catch (error) {
    console.error('Error finding duplicates:', error);
    return NextResponse.json(
      { error: 'Failed to find duplicates' },
      { status: 500 }
    );
  }
}

/**
 * POST - Объединить группу дубликатов
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { keepId, mergeIds } = body;

    if (!keepId || !mergeIds || !Array.isArray(mergeIds)) {
      return NextResponse.json(
        { error: 'keepId and mergeIds[] required' },
        { status: 400 }
      );
    }

    // Получаем все рестораны для объединения
    const restaurants = await prisma.restaurant.findMany({
      where: { id: { in: [keepId, ...mergeIds] } },
      include: {
        reviews: true,
        workingHours: true,
      },
    });

    const keepRestaurant = restaurants.find(r => r.id === keepId);
    if (!keepRestaurant) {
      return NextResponse.json(
        { error: 'Keep restaurant not found' },
        { status: 404 }
      );
    }

    const toMerge = restaurants.filter(r => r.id !== keepId);

    // Объединяем данные
    const mergedImages = [...new Set([
      ...keepRestaurant.images,
      ...toMerge.flatMap(r => r.images),
    ])].slice(0, 15);

    const mergedCuisine = [...new Set([
      ...keepRestaurant.cuisine,
      ...toMerge.flatMap(r => r.cuisine),
    ])];

    // Средний рейтинг
    const allRatings = [keepRestaurant, ...toMerge]
      .filter(r => r.rating)
      .map(r => ({ rating: r.rating!, count: r.ratingCount }));
    
    const totalCount = allRatings.reduce((sum, r) => sum + r.count, 0);
    const weightedRating = totalCount > 0 
      ? allRatings.reduce((sum, r) => sum + r.rating * r.count, 0) / totalCount
      : keepRestaurant.rating;

    // Обновляем основной ресторан
    await prisma.restaurant.update({
      where: { id: keepId },
      data: {
        images: mergedImages,
        cuisine: mergedCuisine,
        rating: weightedRating ? Math.round(weightedRating * 10) / 10 : null,
        ratingCount: totalCount,
        // Берём лучшие данные
        phone: keepRestaurant.phone || toMerge.find(r => r.phone)?.phone,
        website: keepRestaurant.website || toMerge.find(r => r.website)?.website,
        description: keepRestaurant.description || toMerge.find(r => r.description)?.description,
      },
    });

    // Переносим отзывы
    for (const restaurant of toMerge) {
      await prisma.review.updateMany({
        where: { restaurantId: restaurant.id },
        data: { restaurantId: keepId },
      });
    }

    // Переносим время работы (если нет у основного)
    const hasWorkingHours = await prisma.workingHours.count({ where: { restaurantId: keepId } });
    if (hasWorkingHours === 0) {
      const sourceWithHours = toMerge.find(r => r.workingHours.length > 0);
      if (sourceWithHours) {
        await prisma.workingHours.updateMany({
          where: { restaurantId: sourceWithHours.id },
          data: { restaurantId: keepId },
        });
      }
    }

    // Удаляем дубликаты
    await prisma.restaurant.deleteMany({
      where: { id: { in: mergeIds } },
    });

    return NextResponse.json({
      success: true,
      message: `Объединено ${mergeIds.length + 1} ресторанов в один`,
      keptId: keepId,
      deletedIds: mergeIds,
    });
  } catch (error) {
    console.error('Error merging duplicates:', error);
    return NextResponse.json(
      { error: 'Failed to merge duplicates' },
      { status: 500 }
    );
  }
}

