import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { detectBrand, KNOWN_CHAINS } from '@/lib/apify/consolidate';

interface ChainGroup {
  brand: string;
  type: 'franchise' | 'chain' | 'group';
  count: number;
  avgRating: number | null;
  totalReviews: number;
  restaurants: Array<{
    id: string;
    name: string;
    address: string;
    city: string;
    rating: number | null;
    ratingCount: number;
    images: string[];
  }>;
}

/**
 * GET - Получить список сетей и их филиалов
 */
export async function GET() {
  try {
    const restaurants = await prisma.restaurant.findMany({
      where: { isArchived: false },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        rating: true,
        ratingCount: true,
        images: true,
        brand: true,
      },
      orderBy: { name: 'asc' },
    });

    // Группируем по брендам
    const chainGroups: Record<string, ChainGroup> = {};

    for (const restaurant of restaurants) {
      // Используем сохранённый бренд или определяем по названию
      let brandInfo = restaurant.brand 
        ? { brand: restaurant.brand, type: 'chain' as const }
        : detectBrand(restaurant.name);

      if (!brandInfo) continue;

      const { brand, type } = brandInfo;

      if (!chainGroups[brand]) {
        chainGroups[brand] = {
          brand,
          type: type as 'franchise' | 'chain' | 'group',
          count: 0,
          avgRating: null,
          totalReviews: 0,
          restaurants: [],
        };
      }

      chainGroups[brand].count++;
      chainGroups[brand].totalReviews += restaurant.ratingCount;
      chainGroups[brand].restaurants.push({
        id: restaurant.id,
        name: restaurant.name,
        address: restaurant.address,
        city: restaurant.city,
        rating: restaurant.rating,
        ratingCount: restaurant.ratingCount,
        images: restaurant.images,
      });
    }

    // Вычисляем средний рейтинг для каждой сети
    for (const group of Object.values(chainGroups)) {
      const ratingsWithCount = group.restaurants
        .filter(r => r.rating !== null)
        .map(r => ({ rating: r.rating!, count: r.ratingCount }));

      if (ratingsWithCount.length > 0) {
        const totalWeight = ratingsWithCount.reduce((sum, r) => sum + r.count, 0);
        if (totalWeight > 0) {
          group.avgRating = Math.round(
            ratingsWithCount.reduce((sum, r) => sum + r.rating * r.count, 0) / totalWeight * 10
          ) / 10;
        }
      }
    }

    // Сортируем по количеству филиалов
    const sortedChains = Object.values(chainGroups)
      .filter(g => g.count >= 2) // Только с 2+ филиалами
      .sort((a, b) => b.count - a.count);

    // Статистика
    const totalChains = sortedChains.length;
    const totalBranches = sortedChains.reduce((sum, g) => sum + g.count, 0);
    const franchises = sortedChains.filter(g => g.type === 'franchise').length;
    const localChains = sortedChains.filter(g => g.type === 'chain').length;

    // Список известных сетей для справки
    const knownChainsList = Object.entries(KNOWN_CHAINS).map(([brand, config]) => ({
      brand,
      type: config.type,
      keywords: config.keywords.slice(0, 3),
    }));

    return NextResponse.json({
      stats: {
        totalChains,
        totalBranches,
        franchises,
        localChains,
      },
      chains: sortedChains,
      knownChains: knownChainsList,
    });
  } catch (error) {
    console.error('Error fetching chains:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chains' },
      { status: 500 }
    );
  }
}

/**
 * POST - Обновить бренд для ресторанов
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, restaurantIds, brand } = body;

    if (action === 'setBrand') {
      // Установить бренд для выбранных ресторанов
      if (!restaurantIds || !Array.isArray(restaurantIds)) {
        return NextResponse.json({ error: 'restaurantIds required' }, { status: 400 });
      }

      await prisma.restaurant.updateMany({
        where: { id: { in: restaurantIds } },
        data: { brand: brand || null },
      });

      return NextResponse.json({
        success: true,
        message: `Обновлено ${restaurantIds.length} ресторанов`,
      });
    }

    if (action === 'autoDetect') {
      // Автоматически определить бренды для всех ресторанов
      const restaurants = await prisma.restaurant.findMany({
        where: { brand: null, isArchived: false },
        select: { id: true, name: true },
      });

      let updated = 0;
      for (const restaurant of restaurants) {
        const brandInfo = detectBrand(restaurant.name);
        if (brandInfo) {
          await prisma.restaurant.update({
            where: { id: restaurant.id },
            data: { brand: brandInfo.brand },
          });
          updated++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Автоматически определено ${updated} брендов`,
        updated,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating chains:', error);
    return NextResponse.json(
      { error: 'Failed to update chains' },
      { status: 500 }
    );
  }
}


