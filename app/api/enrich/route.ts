import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

// Дата 7 дней назад
const getSevenDaysAgo = () => {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date;
};

// GET - получить статистику неполных записей
export async function GET() {
  try {
    const sevenDaysAgo = getSevenDaysAgo();
    
    // Записи без фото (исключая обновлённые за 7 дней)
    const noImages = await prisma.restaurant.count({
      where: {
        OR: [
          { images: { equals: [] } },
          { images: { equals: null } },
        ],
        isArchived: false,
        lastSynced: { lt: sevenDaysAgo },
      },
    });

    // Все записи без фото (включая недавно обновлённые)
    const noImagesTotal = await prisma.restaurant.count({
      where: {
        OR: [
          { images: { equals: [] } },
          { images: { equals: null } },
        ],
        isArchived: false,
      },
    });

    // Записи без рейтинга
    const noRating = await prisma.restaurant.count({
      where: {
        rating: null,
        isArchived: false,
        lastSynced: { lt: sevenDaysAgo },
      },
    });

    // Записи без рабочих часов (вообще нет)
    const noHours = await prisma.restaurant.count({
      where: {
        workingHours: { none: {} },
        isArchived: false,
        lastSynced: { lt: sevenDaysAgo },
      },
    });

    // Записи с некорректными часами (00:00-23:59 для всех дней = плейсхолдер) - готовые к обновлению
    const placeholderHoursRestaurants = await prisma.$queryRaw<{count: bigint}[]>`
      SELECT COUNT(DISTINCT r.id) as count
      FROM restaurants r
      JOIN working_hours wh ON wh."restaurantId" = r.id
      WHERE r."isArchived" = false
      AND r."lastSynced" < ${sevenDaysAgo}
      AND wh."openTime" = '00:00'
      AND wh."closeTime" = '23:59'
      AND wh."isClosed" = false
    `;
    const badHours = Number(placeholderHoursRestaurants[0]?.count || 0);

    // ВСЕ записи с плейсхолдер часами (включая на кулдауне)
    const placeholderHoursTotal = await prisma.$queryRaw<{count: bigint}[]>`
      SELECT COUNT(DISTINCT r.id) as count
      FROM restaurants r
      JOIN working_hours wh ON wh."restaurantId" = r.id
      WHERE r."isArchived" = false
      AND wh."openTime" = '00:00'
      AND wh."closeTime" = '23:59'
      AND wh."isClosed" = false
    `;
    const badHoursTotal = Number(placeholderHoursTotal[0]?.count || 0);

    // Записи без отзывов
    const noReviews = await prisma.restaurant.count({
      where: {
        reviews: { none: {} },
        isArchived: false,
        lastSynced: { lt: sevenDaysAgo },
      },
    });

    // Всего активных
    const total = await prisma.restaurant.count({
      where: { isArchived: false },
    });

    // Записи обновлённые за последние 7 дней (на "кулдауне")
    const recentlyUpdated = await prisma.restaurant.count({
      where: {
        isArchived: false,
        lastSynced: { gte: sevenDaysAgo },
      },
    });

    // Записи из импорта (sourceId начинается с "import-")
    const importedCount = await prisma.restaurant.count({
      where: {
        sourceId: { startsWith: 'import-' },
        isArchived: false,
      },
    });

    // Неполные записи (импорт без фото, исключая обновлённые за 7 дней)
    const incompleteImports = await prisma.restaurant.count({
      where: {
        sourceId: { startsWith: 'import-' },
        OR: [
          { images: { equals: [] } },
          { images: { equals: null } },
        ],
        isArchived: false,
        lastSynced: { lt: sevenDaysAgo },
      },
    });

    // Все неполные импорты (включая недавно обновлённые)
    const incompleteImportsTotal = await prisma.restaurant.count({
      where: {
        sourceId: { startsWith: 'import-' },
        OR: [
          { images: { equals: [] } },
          { images: { equals: null } },
        ],
        isArchived: false,
      },
    });

    return NextResponse.json({
      total,
      stats: {
        noImages,
        noImagesTotal, // Всего без фото (вкл. недавние)
        noRating,
        noHours,
        noReviews,
        badHours,
        badHoursTotal, // Всего с плейсхолдер часами (вкл. недавние)
        importedCount,
        incompleteImports,
        incompleteImportsTotal, // Всего неполных (вкл. недавние)
        recentlyUpdated, // На кулдауне (обновлены < 7 дней)
      },
      needsEnrichment: incompleteImports,
      needsHoursUpdate: badHours + noHours,
      needsHoursUpdateTotal: badHoursTotal + noHours, // Всего (вкл. кулдаун)
      cooldownDays: 7,
    });
  } catch (error) {
    console.error('Error getting enrich stats:', error);
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}

// POST - запустить обогащение данных
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { batchSize = 50, mode = 'incomplete', force = false } = body;
    
    const sevenDaysAgo = getSevenDaysAgo();
    
    // Базовый фильтр по дате (пропускаем если force=true)
    const dateFilter = force ? {} : { lastSynced: { lt: sevenDaysAgo } };

    // Получить записи для обогащения
    let restaurants: { id: string; name: string; address: string | null; city: string | null; latitude: number | null; longitude: number | null; }[];
    
    if (mode === 'hours') {
      // Рестораны с плейсхолдер часами - СНАЧАЛА КАЧЕСТВЕННЫЕ (с рейтингом, отзывами, фото)
      let restaurantIds: {id: string}[];
      
      if (force) {
        restaurantIds = await prisma.$queryRaw<{id: string}[]>`
          SELECT DISTINCT r.id
          FROM restaurants r
          LEFT JOIN working_hours wh ON wh."restaurantId" = r.id
          WHERE r."isArchived" = false
          AND (
            wh.id IS NULL
            OR (wh."openTime" = '00:00' AND wh."closeTime" = '23:59' AND wh."isClosed" = false)
          )
          ORDER BY 
            CASE WHEN r.rating IS NOT NULL AND r.rating >= 4.0 THEN 0 ELSE 1 END,
            CASE WHEN array_length(r.images, 1) > 0 THEN 0 ELSE 1 END,
            COALESCE(r."ratingCount", 0) DESC,
            r.rating DESC NULLS LAST
          LIMIT ${batchSize}
        `;
      } else {
        restaurantIds = await prisma.$queryRaw<{id: string}[]>`
          SELECT DISTINCT r.id
          FROM restaurants r
          LEFT JOIN working_hours wh ON wh."restaurantId" = r.id
          WHERE r."isArchived" = false
          AND r."lastSynced" < ${sevenDaysAgo}
          AND (
            wh.id IS NULL
            OR (wh."openTime" = '00:00' AND wh."closeTime" = '23:59' AND wh."isClosed" = false)
          )
          ORDER BY 
            CASE WHEN r.rating IS NOT NULL AND r.rating >= 4.0 THEN 0 ELSE 1 END,
            CASE WHEN array_length(r.images, 1) > 0 THEN 0 ELSE 1 END,
            COALESCE(r."ratingCount", 0) DESC,
            r.rating DESC NULLS LAST
          LIMIT ${batchSize}
        `;
      }
      
      // Защита от пустого массива
      if (restaurantIds.length === 0) {
        restaurants = [];
      } else {
        restaurants = await prisma.restaurant.findMany({
          where: {
            id: { in: restaurantIds.map(r => r.id) },
          },
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            latitude: true,
            longitude: true,
          },
        });
      }
    } else if (mode === 'incomplete') {
      // Импортированные без фото - ПРИОРИТЕТ качественным (с рейтингом, отзывами)
      restaurants = await prisma.restaurant.findMany({
        where: {
          sourceId: { startsWith: 'import-' },
          OR: [
            { images: { equals: [] } },
            { images: { equals: null } },
          ],
          isArchived: false,
          ...dateFilter,
        },
        orderBy: [
          { rating: 'desc' },
          { ratingCount: 'desc' },
        ],
        take: batchSize,
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          latitude: true,
          longitude: true,
        },
      });
    } else {
      // Все без фото - приоритет качественным
      restaurants = await prisma.restaurant.findMany({
        where: {
          OR: [
            { images: { equals: [] } },
            { images: { equals: null } },
          ],
          isArchived: false,
          ...dateFilter,
        },
        orderBy: [
          { rating: 'desc' },
          { ratingCount: 'desc' },
        ],
        take: batchSize,
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          latitude: true,
          longitude: true,
        },
      });
    }

    if (restaurants.length === 0) {
      return NextResponse.json({
        message: 'Нет записей для обогащения',
        processed: 0,
      });
    }

    // Создать поисковые запросы для Apify
    const searchQueries = restaurants.map(r => {
      // Формируем точный поисковый запрос
      const query = `${r.name} ${r.city || 'Tashkent'}`;
      return query;
    });

    // Лимит Apify - до 1000 запросов за раз
    const maxQueries = Math.min(restaurants.length, 1000);
    const queriesToProcess = searchQueries.slice(0, maxQueries);

    // Запустить Apify для обогащения
    const run = await client.actor('compass/crawler-google-places').call({
      searchStringsArray: queriesToProcess,
      maxCrawledPlacesPerSearch: 1, // Только 1 результат на запрос
      language: 'ru',
      maxImages: 10,
      maxReviews: 10,
      scrapeReviewerName: true,
      scrapeReviewerId: true,
      scrapeResponseFromOwnerText: true,
      additionalInfo: true,
    });

    // Создать задачу синхронизации
    const job = await prisma.syncJob.create({
      data: {
        source: 'google',
        status: 'running',
        startedAt: new Date(),
        stats: {
          runId: run.id,
          mode: 'enrich',
          targetIds: restaurants.slice(0, maxQueries).map(r => r.id),
          searchQueries: queriesToProcess,
          totalRequested: maxQueries,
        },
      },
    });

    return NextResponse.json({
      message: `Запущено обогащение ${maxQueries} записей`,
      jobId: job.id,
      runId: run.id,
      targetCount: maxQueries,
      totalIncomplete: restaurants.length,
    });
  } catch (error: any) {
    console.error('Error starting enrichment:', error);
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to start enrichment', 
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}

