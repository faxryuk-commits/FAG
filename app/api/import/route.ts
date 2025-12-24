import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { saveWithConsolidation } from '@/lib/apify/consolidate';

/**
 * Генерирует slug из названия
 */
function generateSlug(name: string, sourceId: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s]/gi, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
  
  const suffix = sourceId.substring(0, 8);
  return `${base}-${suffix}`;
}

/**
 * POST - Импорт JSON данных из Apify
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data, source = 'google' } = body;

    if (!Array.isArray(data)) {
      return NextResponse.json(
        { error: 'data must be an array' },
        { status: 400 }
      );
    }

    console.log(`[Import] Starting import of ${data.length} items from ${source}`);

    let processed = 0;
    let errors = 0;
    let skipped = 0;
    const errorMessages: string[] = [];

    for (const item of data) {
      try {
        // Пропускаем записи без названия или координат
        if (!item.title || !item.location?.lat || !item.location?.lng) {
          skipped++;
          continue;
        }

        // Нормализуем данные под формат нашей системы
        const normalized = normalizeImportData(item, source);
        
        // Сохраняем с консолидацией (объединение дубликатов)
        await saveWithConsolidation(source, normalized);
        processed++;

        // Логируем прогресс каждые 100 записей
        if (processed % 100 === 0) {
          console.log(`[Import] Processed ${processed}/${data.length}`);
        }
      } catch (error) {
        errors++;
        const msg = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessages.length < 10) {
          errorMessages.push(`${item.title || 'Unknown'}: ${msg.substring(0, 100)}`);
        }
      }
    }

    console.log(`[Import] Completed: ${processed} processed, ${errors} errors, ${skipped} skipped`);

    return NextResponse.json({
      success: true,
      message: `Импортировано ${processed} из ${data.length} записей`,
      stats: {
        total: data.length,
        processed,
        errors,
        skipped,
        errorMessages,
      },
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}

/**
 * Нормализует данные из разных форматов Apify
 */
function normalizeImportData(item: any, source: string) {
  const name = item.title || item.name || 'Без названия';
  const sourceId = item.placeId || item.cid || item.id || `import-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  // Координаты
  let lat = 0, lng = 0;
  if (item.location?.lat) {
    lat = item.location.lat;
    lng = item.location.lng;
  } else if (item.coordinates?.latitude) {
    lat = item.coordinates.latitude;
    lng = item.coordinates.longitude;
  } else {
    lat = item.latitude || item.lat || 0;
    lng = item.longitude || item.lng || 0;
  }

  // Изображения
  let images: string[] = [];
  if (item.imageUrls && Array.isArray(item.imageUrls)) {
    images = item.imageUrls;
  } else if (item.images && Array.isArray(item.images)) {
    images = item.images.map((img: any) => typeof img === 'string' ? img : img.url);
  } else if (item.imageUrl) {
    images = [item.imageUrl];
  } else if (item.thumbnail) {
    images = [item.thumbnail];
  }

  // Категории/кухня
  let cuisine: string[] = [];
  if (item.categories && Array.isArray(item.categories)) {
    cuisine = item.categories;
  } else if (item.categoryName) {
    cuisine = [item.categoryName];
  } else if (item.category) {
    cuisine = Array.isArray(item.category) ? item.category : [item.category];
  }

  // Город
  let city = item.city || 'Неизвестно';
  if (!city || city === 'null') {
    // Пробуем извлечь из адреса
    if (item.state?.includes('Tashkent')) {
      city = 'Ташкент';
    } else if (item.address?.includes('Tashkent')) {
      city = 'Ташкент';
    }
  }
  // Нормализуем название города
  if (city === 'Tashkent' || city === 'Toshkent' || city === 'Тоshkent') {
    city = 'Ташкент';
  }

  return {
    name,
    slug: generateSlug(name, sourceId),
    address: item.address || item.street || '',
    city,
    country: item.countryCode === 'UZ' ? 'Узбекистан' : item.countryCode || null,
    latitude: lat,
    longitude: lng,
    phone: item.phone || item.phoneUnformatted || null,
    website: item.website || item.url || null,
    rating: item.totalScore || item.rating || item.stars || null,
    ratingCount: item.reviewsCount || item.userRatingsTotal || 0,
    priceRange: item.price || (item.priceLevel ? '$'.repeat(item.priceLevel) : null),
    sourceId,
    sourceUrl: item.url || item.googleMapsUrl || null,
    images: images.filter(Boolean).slice(0, 10),
    cuisine: cuisine.filter(Boolean),
    source,
    lastSynced: new Date(),
    isActive: true,
    isVerified: false,
    // Временные поля для обработки
    _openingHours: item.openingHours || item.workingHours || null,
    _reviews: item.reviews || item.reviewsData || [],
  };
}

/**
 * GET - Получить статус импорта / информацию
 */
export async function GET() {
  const stats = await prisma.restaurant.groupBy({
    by: ['source'],
    _count: { id: true },
  });

  const total = await prisma.restaurant.count();

  return NextResponse.json({
    message: 'Import API ready',
    currentData: {
      total,
      bySource: stats.map(s => ({ source: s.source, count: s._count.id })),
    },
    supportedFormats: [
      'Google Maps Scraper (compass/crawler-google-places)',
      'Yandex Maps (johnvc/Scrape-Yandex)',
      '2GIS (m_mamaev/2gis-places-scraper)',
    ],
  });
}

