import { NextRequest, NextResponse } from 'next/server';
import { runFullConsolidation } from '@/lib/apify/consolidate';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/consolidate - Запуск полной консолидации
 */
export async function POST() {
  try {
    const result = await runFullConsolidation();
    
    return NextResponse.json({
      success: true,
      ...result,
      message: `Обработано: ${result.processed}, Объединено: ${result.merged}, Удалено дубликатов: ${result.deleted}`,
    });
  } catch (error) {
    console.error('Consolidation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to consolidate' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/consolidate - Статистика по источникам
 */
export async function GET() {
  try {
    // Статистика по источникам
    const bySource = await prisma.restaurant.groupBy({
      by: ['source'],
      _count: { id: true },
      _avg: { rating: true },
    });

    // Общее количество
    const total = await prisma.restaurant.count();
    
    // Количество с несколькими источниками (потенциальные дубликаты)
    // Это приблизительная оценка - рестораны в радиусе 50м друг от друга
    const restaurants = await prisma.restaurant.findMany({
      select: { id: true, name: true, latitude: true, longitude: true, source: true },
    });

    // Простой подсчет потенциальных дубликатов
    let potentialDuplicates = 0;
    const checked = new Set<string>();
    
    for (let i = 0; i < restaurants.length; i++) {
      if (checked.has(restaurants[i].id)) continue;
      
      for (let j = i + 1; j < restaurants.length; j++) {
        if (checked.has(restaurants[j].id)) continue;
        
        const latDiff = Math.abs(restaurants[i].latitude - restaurants[j].latitude);
        const lonDiff = Math.abs(restaurants[i].longitude - restaurants[j].longitude);
        
        // Примерно 50 метров
        if (latDiff < 0.0005 && lonDiff < 0.0005) {
          potentialDuplicates++;
          checked.add(restaurants[j].id);
        }
      }
    }

    return NextResponse.json({
      total,
      bySource: bySource.map(s => ({
        source: s.source,
        count: s._count.id,
        avgRating: s._avg.rating ? Math.round(s._avg.rating * 10) / 10 : null,
      })),
      potentialDuplicates,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get stats' },
      { status: 500 }
    );
  }
}

