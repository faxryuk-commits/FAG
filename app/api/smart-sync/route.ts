import { NextRequest, NextResponse } from 'next/server';
import { 
  getRestaurantsNeedingSync, 
  calculateSavings,
  runSmartSync,
  DEFAULT_CONFIG 
} from '@/lib/apify/smart-sync';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/smart-sync - Получить статистику и настройки умной синхронизации
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reviewsInterval = parseInt(searchParams.get('reviewsInterval') || '1');
    const basicInfoInterval = parseInt(searchParams.get('basicInfoInterval') || '7');
    
    const config = { reviewsInterval, basicInfoInterval };
    
    // Получаем общее количество ресторанов
    const totalRestaurants = await prisma.restaurant.count();
    
    // Получаем статистику что нужно обновить
    const syncNeeds = await getRestaurantsNeedingSync(config, 1000);
    
    // Рассчитываем экономию
    const savings = calculateSavings(totalRestaurants, config);
    
    return NextResponse.json({
      totalRestaurants,
      syncNeeds: {
        needFullSync: syncNeeds.needFullSync.length,
        needReviewsOnly: syncNeeds.needReviewsOnly.length,
        upToDate: syncNeeds.upToDate,
      },
      savings,
      config: {
        reviewsInterval,
        basicInfoInterval,
        ...config,
      },
      explanation: {
        full: 'Полное обновление: адрес, телефон, фото, время работы, отзывы',
        reviewsOnly: 'Только отзывы: рейтинг, новые отзывы (дешевле на 70%)',
        upToDate: 'Актуальные данные: обновление не требуется',
      },
    });
  } catch (error) {
    console.error('Smart sync stats error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get stats' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/smart-sync - Запустить умную синхронизацию
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode, config } = body;
    
    if (mode === 'calculate') {
      // Только расчёт без запуска
      const totalRestaurants = await prisma.restaurant.count();
      const savings = calculateSavings(totalRestaurants, config);
      return NextResponse.json({ savings });
    }
    
    // Запуск умной синхронизации
    const result = await runSmartSync(config);
    
    return NextResponse.json({
      success: true,
      message: 'Умная синхронизация запущена',
      stats: result,
    });
  } catch (error) {
    console.error('Smart sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Smart sync failed' },
      { status: 500 }
    );
  }
}

