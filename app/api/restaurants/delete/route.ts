import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * DELETE /api/restaurants/delete - Удаление или архивирование ресторанов
 * 
 * Параметры:
 * - source: удалить только из определённого источника (google, yandex, 2gis)
 * - all: true для удаления всех данных
 * - ids: массив ID для точечного удаления
 * - archive: true для архивирования вместо удаления
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { source, all, ids, archive } = body;
    
    // Режим архивирования
    if (archive) {
      let archivedCount = 0;
      
      if (ids && Array.isArray(ids) && ids.length > 0) {
        const result = await prisma.restaurant.updateMany({
          where: { id: { in: ids } },
          data: { isArchived: true },
        });
        archivedCount = result.count;
      } else if (source) {
        const result = await prisma.restaurant.updateMany({
          where: { source },
          data: { isArchived: true },
        });
        archivedCount = result.count;
      } else if (all === true) {
        const result = await prisma.restaurant.updateMany({
          data: { isArchived: true },
        });
        archivedCount = result.count;
      }
      
      return NextResponse.json({
        success: true,
        message: `Архивировано ${archivedCount} ресторанов`,
        archived: archivedCount,
      });
    }
    
    let deletedCount = 0;
    let deletedReviews = 0;
    let deletedHours = 0;
    
    if (all === true) {
      // Удаляем ВСЕ данные (опасная операция)
      // Сначала удаляем связанные данные
      deletedReviews = (await prisma.review.deleteMany({})).count;
      deletedHours = (await prisma.workingHours.deleteMany({})).count;
      await prisma.menuItem.deleteMany({});
      await prisma.restaurantSyncMeta.deleteMany({});
      
      // Затем удаляем рестораны
      const result = await prisma.restaurant.deleteMany({});
      deletedCount = result.count;
      
      // Очищаем историю задач
      await prisma.syncJob.deleteMany({});
      
      return NextResponse.json({
        success: true,
        message: `Удалено всё: ${deletedCount} ресторанов, ${deletedReviews} отзывов, ${deletedHours} записей времени работы`,
        deleted: {
          restaurants: deletedCount,
          reviews: deletedReviews,
          workingHours: deletedHours,
        },
      });
    }
    
    if (source) {
      // Удаляем только из определённого источника
      // Получаем ID ресторанов для удаления
      const restaurantsToDelete = await prisma.restaurant.findMany({
        where: { source },
        select: { id: true },
      });
      
      const restaurantIds = restaurantsToDelete.map(r => r.id);
      
      if (restaurantIds.length > 0) {
        // Удаляем связанные данные
        deletedReviews = (await prisma.review.deleteMany({
          where: { restaurantId: { in: restaurantIds } },
        })).count;
        
        deletedHours = (await prisma.workingHours.deleteMany({
          where: { restaurantId: { in: restaurantIds } },
        })).count;
        
        await prisma.menuItem.deleteMany({
          where: { restaurantId: { in: restaurantIds } },
        });
        
        await prisma.restaurantSyncMeta.deleteMany({
          where: { restaurantId: { in: restaurantIds } },
        });
        
        // Удаляем рестораны
        const result = await prisma.restaurant.deleteMany({
          where: { source },
        });
        deletedCount = result.count;
      }
      
      return NextResponse.json({
        success: true,
        message: `Удалено из ${source}: ${deletedCount} ресторанов`,
        deleted: {
          restaurants: deletedCount,
          reviews: deletedReviews,
          workingHours: deletedHours,
        },
      });
    }
    
    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Точечное удаление по ID
      deletedReviews = (await prisma.review.deleteMany({
        where: { restaurantId: { in: ids } },
      })).count;
      
      deletedHours = (await prisma.workingHours.deleteMany({
        where: { restaurantId: { in: ids } },
      })).count;
      
      await prisma.menuItem.deleteMany({
        where: { restaurantId: { in: ids } },
      });
      
      await prisma.restaurantSyncMeta.deleteMany({
        where: { restaurantId: { in: ids } },
      });
      
      const result = await prisma.restaurant.deleteMany({
        where: { id: { in: ids } },
      });
      deletedCount = result.count;
      
      return NextResponse.json({
        success: true,
        message: `Удалено ${deletedCount} ресторанов`,
        deleted: {
          restaurants: deletedCount,
          reviews: deletedReviews,
          workingHours: deletedHours,
        },
      });
    }
    
    return NextResponse.json(
      { error: 'Укажите source, all=true или ids для удаления' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('Error deleting restaurants:', error);
    return NextResponse.json(
      { error: 'Failed to delete restaurants' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/restaurants/delete - Получение статистики для удаления
 */
export async function GET(request: NextRequest) {
  try {
    // Статистика по источникам
    const stats = await prisma.restaurant.groupBy({
      by: ['source'],
      where: { isArchived: false },
      _count: true,
    });
    
    // Статистика по городам
    const cityStats = await prisma.restaurant.groupBy({
      by: ['city'],
      where: { isArchived: false },
      _count: true,
      orderBy: { _count: { city: 'desc' } },
      take: 50,
    });
    
    // Статистика по странам
    const countryStats = await prisma.restaurant.groupBy({
      by: ['country'],
      where: { isArchived: false },
      _count: true,
    });
    
    const total = await prisma.restaurant.count({ where: { isArchived: false } });
    const archivedCount = await prisma.restaurant.count({ where: { isArchived: true } });
    const reviewsCount = await prisma.review.count();
    const hoursCount = await prisma.workingHours.count();
    
    return NextResponse.json({
      total,
      archived: archivedCount,
      bySource: stats.map(s => ({
        source: s.source,
        count: s._count,
      })),
      byCity: cityStats.map(c => ({
        city: c.city || 'Неизвестно',
        count: c._count,
      })),
      byCountry: countryStats.map(c => ({
        country: c.country || 'Неизвестно',
        count: c._count,
      })),
      relatedData: {
        reviews: reviewsCount,
        workingHours: hoursCount,
      },
    });
  } catch (error) {
    console.error('Error fetching delete stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/restaurants/delete - Восстановление архивированных ресторанов
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ids, source, all } = body;
    
    if (action === 'restore') {
      let restoredCount = 0;
      
      if (ids && Array.isArray(ids) && ids.length > 0) {
        const result = await prisma.restaurant.updateMany({
          where: { id: { in: ids }, isArchived: true },
          data: { isArchived: false },
        });
        restoredCount = result.count;
      } else if (source) {
        const result = await prisma.restaurant.updateMany({
          where: { source, isArchived: true },
          data: { isArchived: false },
        });
        restoredCount = result.count;
      } else if (all === true) {
        const result = await prisma.restaurant.updateMany({
          where: { isArchived: true },
          data: { isArchived: false },
        });
        restoredCount = result.count;
      }
      
      return NextResponse.json({
        success: true,
        message: `Восстановлено ${restoredCount} ресторанов`,
        restored: restoredCount,
      });
    }
    
    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in POST /api/restaurants/delete:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

