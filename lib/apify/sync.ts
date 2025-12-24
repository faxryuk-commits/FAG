import apifyClient from './client';
import { prisma } from '@/lib/prisma';

export type SyncSource = 'yandex' | 'google' | '2gis';

// ID актеров в Apify
const ACTOR_IDS = {
  google: 'compass/crawler-google-places', // Популярный актер для Google Maps
  yandex: 'apify/yandex-search',           // Для Яндекса (нужно найти подходящий)
  '2gis': 'apify/web-scraper',             // Для 2ГИС (нужно создать свой)
} as const;

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

interface SyncOptions {
  source: SyncSource;
  searchQuery?: string;
  location?: string;
  maxResults?: number;
  actorId?: string;
}

/**
 * Запускает синхронизацию ресторанов через Apify
 */
export async function startRestaurantSync(options: SyncOptions) {
  const { source, searchQuery = 'рестораны', location = 'Москва', maxResults = 50, actorId } = options;

  // Создаем запись о задаче
  const syncJob = await prisma.syncJob.create({
    data: {
      source,
      status: 'pending',
    },
  });

  try {
    const finalActorId = actorId || ACTOR_IDS[source];
    
    // Формируем input в зависимости от актера
    const input = getActorInput(source, searchQuery, location, maxResults);

    // Запускаем актера
    const run = await apifyClient.actor(finalActorId).call(input, {
      waitSecs: 0, // Не ждем завершения
    });

    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: 'running',
        startedAt: new Date(),
        stats: { runId: run.id },
      },
    });

    return {
      jobId: syncJob.id,
      runId: run.id,
      status: 'running',
    };
  } catch (error) {
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    throw error;
  }
}

/**
 * Формирует input для актера в зависимости от источника
 */
function getActorInput(source: SyncSource, searchQuery: string, location: string, maxResults: number) {
  switch (source) {
    case 'google':
      return {
        searchStringsArray: [`${searchQuery} ${location}`],
        maxCrawledPlacesPerSearch: maxResults,
        language: 'ru',
        deeperCityScrape: false,
        skipClosedPlaces: false,
      };
    
    case 'yandex':
      return {
        text: `${searchQuery} ${location}`,
        yandex_domain: 'yandex.ru',
        lang: 'ru',
        max_pages: Math.ceil(maxResults / 10),
      };
    
    case '2gis':
      return {
        startUrls: [`https://2gis.ru/${location}/search/${encodeURIComponent(searchQuery)}`],
        maxRequestsPerCrawl: maxResults,
      };
    
    default:
      return {};
  }
}

/**
 * Проверяет статус выполнения актера
 */
export async function checkSyncStatus(runId: string) {
  const run = await apifyClient.run(runId).get();
  return {
    status: run?.status,
    isFinished: ['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(run?.status || ''),
  };
}

/**
 * Получает результаты и сохраняет в БД
 */
export async function fetchAndSaveResults(runId: string, jobId: string, source: SyncSource) {
  const run = await apifyClient.run(runId).get();
  
  if (run?.status !== 'SUCCEEDED' || !run.defaultDatasetId) {
    throw new Error(`Run not successful: ${run?.status}`);
  }

  const dataset = await apifyClient.dataset(run.defaultDatasetId).listItems();
  const results = dataset.items;

  let processed = 0;
  let errors = 0;

  for (const item of results) {
    try {
      await saveRestaurant(source, item);
      processed++;
    } catch (error) {
      console.error('Error saving restaurant:', error);
      errors++;
    }
  }

  await prisma.syncJob.update({
    where: { id: jobId },
    data: {
      status: 'completed',
      completedAt: new Date(),
      stats: { processed, errors, total: results.length },
    },
  });

  return { processed, errors, total: results.length };
}

/**
 * Сохраняет ресторан в БД
 */
async function saveRestaurant(source: SyncSource, data: any) {
  const normalized = normalizeData(source, data);
  
  if (!normalized.sourceId || !normalized.name) {
    throw new Error('Missing required fields');
  }

  const existing = await prisma.restaurant.findFirst({
    where: { source, sourceId: normalized.sourceId },
  });

  if (existing) {
    await prisma.restaurant.update({
      where: { id: existing.id },
      data: { ...normalized, lastSynced: new Date() },
    });
  } else {
    await prisma.restaurant.create({
      data: normalized,
    });
  }
}

/**
 * Нормализует данные из разных источников
 */
function normalizeData(source: SyncSource, data: any) {
  const base = { source, lastSynced: new Date() };

  switch (source) {
    case 'google': {
      // Формат данных от compass/crawler-google-places
      const name = data.title || data.name || 'Без названия';
      const sourceId = data.placeId || data.cid || String(Date.now());
      
      return {
        ...base,
        name,
        slug: generateSlug(name, sourceId),
        address: data.address || data.street || '',
        city: data.city || extractCity(data.address || ''),
        latitude: data.location?.lat || data.latitude || 0,
        longitude: data.location?.lng || data.longitude || 0,
        phone: data.phone || data.phoneUnformatted || null,
        website: data.website || null,
        rating: data.totalScore || data.rating || null,
        ratingCount: data.reviewsCount || 0,
        priceRange: data.price || null,
        sourceId,
        sourceUrl: data.url || null,
        images: data.imageUrls || data.images || [],
        cuisine: data.categories || data.categoryName ? [data.categoryName] : [],
      };
    }

    case 'yandex': {
      const name = data.title || data.name || 'Без названия';
      const sourceId = data.id || data.url || String(Date.now());
      
      return {
        ...base,
        name,
        slug: generateSlug(name, sourceId),
        address: data.address || '',
        city: extractCity(data.address || ''),
        latitude: data.coordinates?.lat || 0,
        longitude: data.coordinates?.lon || 0,
        phone: data.phone || null,
        website: data.url || null,
        rating: data.rating || null,
        ratingCount: data.reviewsCount || 0,
        sourceId,
        sourceUrl: data.url || null,
        images: data.photos || [],
        cuisine: data.categories || [],
      };
    }

    case '2gis': {
      const name = data.name || 'Без названия';
      const sourceId = data.id || String(Date.now());
      
      return {
        ...base,
        name,
        slug: generateSlug(name, sourceId),
        address: data.address_name || data.address || '',
        city: data.city || extractCity(data.address_name || ''),
        latitude: data.point?.lat || data.lat || 0,
        longitude: data.point?.lon || data.lng || 0,
        phone: data.contacts?.phones?.[0]?.formatted || data.phone || null,
        website: data.website || null,
        rating: data.rating || null,
        ratingCount: data.reviews_count || 0,
        sourceId,
        sourceUrl: data.url || null,
        images: [],
        cuisine: data.rubrics || [],
      };
    }

    default:
      throw new Error(`Unknown source: ${source}`);
  }
}

function extractCity(address: string): string {
  if (!address) return 'Неизвестно';
  
  // Пытаемся извлечь город из адреса
  const cityPatterns = [
    /^([^,]+),/,           // Первая часть до запятой
    /г\.\s*([^,]+)/,       // "г. Москва"
    /город\s+([^,]+)/i,    // "город Москва"
  ];
  
  for (const pattern of cityPatterns) {
    const match = address.match(pattern);
    if (match) return match[1].trim();
  }
  
  const parts = address.split(',');
  return parts[0]?.trim() || 'Неизвестно';
}
