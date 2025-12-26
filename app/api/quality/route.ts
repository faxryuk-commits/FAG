import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Критерии качества данных
interface QualityIssue {
  id: string;
  type: 'no_photos' | 'no_reviews' | 'no_rating' | 'no_phone' | 'no_hours' | 'low_rating' | 'incomplete';
  label: string;
  severity: 'low' | 'medium' | 'high';
}

const QUALITY_ISSUES: QualityIssue[] = [
  { id: 'no_photos', type: 'no_photos', label: 'Нет фотографий', severity: 'high' },
  { id: 'no_reviews', type: 'no_reviews', label: 'Нет отзывов', severity: 'medium' },
  { id: 'no_rating', type: 'no_rating', label: 'Нет рейтинга', severity: 'high' },
  { id: 'no_phone', type: 'no_phone', label: 'Нет телефона', severity: 'medium' },
  { id: 'no_hours', type: 'no_hours', label: 'Нет времени работы', severity: 'low' },
  { id: 'low_rating', type: 'low_rating', label: 'Низкий рейтинг (< 3.5)', severity: 'medium' },
  { id: 'incomplete', type: 'incomplete', label: 'Неполные данные (3+ проблем)', severity: 'high' },
];

// GET - получить статистику качества и список проблемных записей
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const includeArchived = searchParams.get('includeArchived') === 'true';

    // Базовый where для не архивированных
    const baseWhere = includeArchived ? {} : { isArchived: false };

    // Получаем общую статистику
    const [
      total,
      active,
      verified,
      noPhotos,
      noReviews,
      noRating,
      noPhone,
      noHours,
      lowRating,
      archived
    ] = await Promise.all([
      prisma.restaurant.count({ where: baseWhere }),
      prisma.restaurant.count({ where: { ...baseWhere, isActive: true } }),
      prisma.restaurant.count({ where: { ...baseWhere, isVerified: true } }),
      prisma.restaurant.count({ where: { ...baseWhere, images: { equals: [] } } }),
      prisma.restaurant.count({ where: { ...baseWhere, ratingCount: 0 } }),
      prisma.restaurant.count({ where: { ...baseWhere, rating: null } }),
      prisma.restaurant.count({ where: { ...baseWhere, phone: null } }),
      prisma.restaurant.count({ 
        where: { 
          ...baseWhere,
          workingHours: { none: {} }
        } 
      }),
      prisma.restaurant.count({ where: { ...baseWhere, rating: { lt: 3.5, not: null } } }),
      prisma.restaurant.count({ where: { isArchived: true } }),
    ]);

    // Определяем where для фильтра
    let filterWhere: any = baseWhere;
    
    switch (filter) {
      case 'no_photos':
        filterWhere = { ...baseWhere, images: { equals: [] } };
        break;
      case 'no_reviews':
        filterWhere = { ...baseWhere, ratingCount: 0 };
        break;
      case 'no_rating':
        filterWhere = { ...baseWhere, rating: null };
        break;
      case 'no_phone':
        filterWhere = { ...baseWhere, phone: null };
        break;
      case 'no_hours':
        filterWhere = { ...baseWhere, workingHours: { none: {} } };
        break;
      case 'low_rating':
        filterWhere = { ...baseWhere, rating: { lt: 3.5, not: null } };
        break;
      case 'archived':
        filterWhere = { isArchived: true };
        break;
      case 'low_quality':
        // Комбинация: нет фото И (нет рейтинга ИЛИ нет отзывов)
        filterWhere = {
          ...baseWhere,
          AND: [
            { images: { equals: [] } },
            {
              OR: [
                { rating: null },
                { ratingCount: 0 }
              ]
            }
          ]
        };
        break;
    }

    // Получаем записи
    const restaurants = await prisma.restaurant.findMany({
      where: filterWhere,
      select: {
        id: true,
        name: true,
        address: true,
        rating: true,
        ratingCount: true,
        images: true,
        phone: true,
        source: true,
        isArchived: true,
        createdAt: true,
        _count: {
          select: {
            workingHours: true,
            reviews: true
          }
        }
      },
      orderBy: [
        { rating: { sort: 'asc', nulls: 'first' } },
        { ratingCount: 'asc' }
      ],
      skip: offset,
      take: limit
    });

    // Подсчитываем общее количество для фильтра
    const filteredTotal = await prisma.restaurant.count({ where: filterWhere });

    // Вычисляем проблемы для каждой записи
    const restaurantsWithIssues = restaurants.map(r => {
      const issues: string[] = [];
      
      if (!r.images || (r.images as string[]).length === 0) issues.push('no_photos');
      if (r.ratingCount === 0) issues.push('no_reviews');
      if (r.rating === null) issues.push('no_rating');
      if (!r.phone) issues.push('no_phone');
      if (r._count.workingHours === 0) issues.push('no_hours');
      if (r.rating !== null && r.rating < 3.5) issues.push('low_rating');

      const qualityScore = 100 - (issues.length * 15);

      return {
        ...r,
        issues,
        qualityScore: Math.max(0, qualityScore),
        issueCount: issues.length
      };
    });

    // Сортируем по количеству проблем (больше проблем = выше)
    restaurantsWithIssues.sort((a, b) => b.issueCount - a.issueCount);

    // Подсчет "критических" (3+ проблем)
    const criticalCount = await prisma.restaurant.count({
      where: {
        ...baseWhere,
        AND: [
          { images: { equals: [] } },
          { rating: null },
          { phone: null }
        ]
      }
    });

    return NextResponse.json({
      // Основные счётчики для панели управления
      total,
      active,
      verified,
      archived,
      noPhotos,
      noRating,
      // Детальная статистика
      stats: {
        total,
        active,
        verified,
        archived,
        issues: {
          no_photos: noPhotos,
          no_reviews: noReviews,
          no_rating: noRating,
          no_phone: noPhone,
          no_hours: noHours,
          low_rating: lowRating,
          critical: criticalCount
        }
      },
      restaurants: restaurantsWithIssues,
      pagination: {
        total: filteredTotal,
        limit,
        offset,
        hasMore: offset + limit < filteredTotal
      }
    });
  } catch (error) {
    console.error('Quality analysis error:', error);
    return NextResponse.json({ error: 'Failed to analyze quality' }, { status: 500 });
  }
}

// POST - массовое архивирование по критериям
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, filter, ids } = body;

    if (action === 'archive') {
      let updateCount = 0;

      if (ids && Array.isArray(ids) && ids.length > 0) {
        // Архивируем конкретные записи
        const result = await prisma.restaurant.updateMany({
          where: { id: { in: ids } },
          data: { isArchived: true }
        });
        updateCount = result.count;
      } else if (filter) {
        // Архивируем по фильтру
        let where: any = { isArchived: false };

        switch (filter) {
          case 'no_photos':
            where = { ...where, images: { equals: [] } };
            break;
          case 'no_reviews':
            where = { ...where, ratingCount: 0 };
            break;
          case 'no_rating':
            where = { ...where, rating: null };
            break;
          case 'low_quality':
            where = {
              ...where,
              AND: [
                { images: { equals: [] } },
                {
                  OR: [
                    { rating: null },
                    { ratingCount: 0 }
                  ]
                }
              ]
            };
            break;
          case 'critical':
            where = {
              ...where,
              AND: [
                { images: { equals: [] } },
                { rating: null },
                { phone: null }
              ]
            };
            break;
        }

        const result = await prisma.restaurant.updateMany({
          where,
          data: { isArchived: true }
        });
        updateCount = result.count;
      }

      return NextResponse.json({
        success: true,
        message: `Архивировано ${updateCount} записей`,
        count: updateCount
      });
    }

    if (action === 'restore') {
      let updateCount = 0;

      if (ids && Array.isArray(ids) && ids.length > 0) {
        const result = await prisma.restaurant.updateMany({
          where: { id: { in: ids } },
          data: { isArchived: false }
        });
        updateCount = result.count;
      } else {
        // Восстановить все
        const result = await prisma.restaurant.updateMany({
          where: { isArchived: true },
          data: { isArchived: false }
        });
        updateCount = result.count;
      }

      return NextResponse.json({
        success: true,
        message: `Восстановлено ${updateCount} записей`,
        count: updateCount
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Quality action error:', error);
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 });
  }
}

