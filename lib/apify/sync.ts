import apifyClient from './client';
import { prisma } from '@/lib/prisma';
import { saveWithConsolidation } from './consolidate';

export type SyncSource = 'yandex' | 'google' | '2gis';

// ID актеров в Apify
// Можно использовать полное имя (username/actor-name) или ID
const ACTOR_IDS = {
  google: 'compass/crawler-google-places',   // Google Maps - работает отлично
  yandex: 'johnvc/Scrape-Yandex',            // Яндекс.Карты - специализированный скрейпер
  '2gis': 'm_mamaev/2gis-places-scraper',    // 2ГИС - специализированный скрейпер
} as const;

// Можно переопределить через env переменные
const getActorId = (source: SyncSource): string => {
  const envKey = `APIFY_ACTOR_${source.toUpperCase()}`;
  return process.env[envKey] || ACTOR_IDS[source];
};

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
 * Получает slug города для 2ГИС
 */
function get2GisCitySlug(city: string): string {
  const cityMap: Record<string, string> = {
    'москва': 'moscow',
    'moscow': 'moscow',
    'санкт-петербург': 'spb',
    'спб': 'spb',
    'питер': 'spb',
    'новосибирск': 'novosibirsk',
    'екатеринбург': 'ekaterinburg',
    'казань': 'kazan',
    'нижний новгород': 'n_novgorod',
    'челябинск': 'chelyabinsk',
    'самара': 'samara',
    'омск': 'omsk',
    'ростов-на-дону': 'rostov',
    'уфа': 'ufa',
    'красноярск': 'krasnoyarsk',
    'пермь': 'perm',
    'воронеж': 'voronezh',
    'волгоград': 'volgograd',
    'краснодар': 'krasnodar',
    'ташкент': 'tashkent',
    'tashkent': 'tashkent',
    'алматы': 'almaty',
    'астана': 'astana',
    'минск': 'minsk',
    'киев': 'kiev',
  };
  
  const normalized = city.toLowerCase().trim();
  return cityMap[normalized] || normalized.replace(/\s+/g, '_');
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
    const finalActorId = actorId || getActorId(source);
    
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
      // compass/crawler-google-places - полная конфигурация
      return {
        searchStringsArray: [`${searchQuery} ${location}`],
        maxCrawledPlacesPerSearch: maxResults,
        language: 'ru',
        
        // ИЗОБРАЖЕНИЯ - важные настройки
        maxImages: 10,                   // До 10 фото
        placeMinimumStars: 0,            // Не фильтруем по рейтингу
        
        // Отзывы
        maxReviews: 10,
        reviewsSort: 'newest',
        reviewsTranslation: 'originalAndTranslated',
        scrapeReviewerName: true,
        scrapeReviewId: false,
        scrapeReviewUrl: false,
        scrapeReviewerId: false,
        scrapeReviewerUrl: false,
        scrapeResponseFromOwnerText: true,
        
        // Дополнительная информация
        additionalInfo: true,            // Время работы, описание и т.д.
        scrapeDirectories: false,
        includeWebResults: false,
        
        // Производительность
        maxConcurrency: 10,
        maxPageRetries: 3,
        skipClosedPlaces: false,
        
        // Полные данные о месте
        allPlacesNoSearch: false,
        oneReviewPerRow: false,
      };
    
    case 'yandex':
      // johnvc/Scrape-Yandex
      return {
        search: `${searchQuery} ${location}`,
        searchQuery: `${searchQuery} ${location}`,
        query: `${searchQuery} ${location}`,
        maxItems: maxResults,
        limit: maxResults,
        maxResults: maxResults,
        language: 'ru',
        region: location,
        city: location,
        
        // Расширенные данные
        includePhotos: true,
        includeReviews: true,
        includeHours: true,
        maxPhotos: 5,
        maxReviews: 10,
      };
    
    case '2gis':
      // m_mamaev/2gis-places-scraper требует startUrls
      // Формируем URL поиска 2ГИС
      const citySlug = get2GisCitySlug(location);
      const searchUrl = `https://2gis.ru/${citySlug}/search/${encodeURIComponent(searchQuery)}`;
      
      return {
        startUrls: [{ url: searchUrl }],
        maxItems: maxResults,
        
        // pageFunction для извлечения данных
        pageFunction: `async function pageFunction(context) {
          const { page, request, log } = context;
          
          // Ждем загрузки результатов
          await page.waitForSelector('[data-id]', { timeout: 10000 }).catch(() => {});
          
          // Собираем данные
          const items = await page.evaluate(() => {
            const results = [];
            document.querySelectorAll('[data-id]').forEach(el => {
              const name = el.querySelector('span')?.textContent || '';
              const address = el.querySelector('[class*="address"]')?.textContent || '';
              if (name) {
                results.push({
                  name,
                  address,
                  url: el.querySelector('a')?.href || '',
                });
              }
            });
            return results;
          });
          
          return items;
        }`,
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
 * Сохраняет ресторан в БД с консолидацией дубликатов
 */
async function saveRestaurant(source: SyncSource, data: any) {
  const normalized = normalizeData(source, data);
  
  if (!normalized.sourceId || !normalized.name) {
    throw new Error('Missing required fields');
  }

  // Используем консолидацию для объединения дубликатов
  const result = await saveWithConsolidation(source, normalized);
  
  return result;
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
      
      // Извлекаем фото
      let images: string[] = [];
      if (data.imageUrls && Array.isArray(data.imageUrls)) {
        images = data.imageUrls;
      } else if (data.images && Array.isArray(data.images)) {
        images = data.images.map((img: any) => typeof img === 'string' ? img : img.url || img.imageUrl);
      } else if (data.imageUrl) {
        images = [data.imageUrl];
      }
      
      // Извлекаем категории
      let cuisine: string[] = [];
      if (data.categories && Array.isArray(data.categories)) {
        cuisine = data.categories;
      } else if (data.categoryName) {
        cuisine = [data.categoryName];
      } else if (data.category) {
        cuisine = [data.category];
      }
      
      return {
        ...base,
        name,
        slug: generateSlug(name, sourceId),
        address: data.address || data.street || data.vicinity || '',
        city: data.city || data.neighborhood || extractCity(data.address || ''),
        latitude: data.location?.lat || data.latitude || data.lat || 0,
        longitude: data.location?.lng || data.longitude || data.lng || 0,
        phone: data.phone || data.phoneUnformatted || data.internationalPhoneNumber || null,
        website: data.website || data.url || null,
        rating: data.totalScore || data.rating || data.stars || null,
        ratingCount: data.reviewsCount || data.userRatingsTotal || data.reviews?.length || 0,
        priceRange: data.price || data.priceLevel ? '$'.repeat(data.priceLevel) : null,
        sourceId,
        sourceUrl: data.url || data.googleMapsUrl || `https://www.google.com/maps/place/?q=place_id:${sourceId}`,
        images: images.filter(Boolean).slice(0, 10),
        cuisine: cuisine.filter(Boolean),
        // Время работы будет обрабатываться отдельно
        _openingHours: data.openingHours || data.workingHours || data.hours || null,
        _reviews: data.reviews || [],
      };
    }

    case 'yandex': {
      // Формат от johnvc/Scrape-Yandex
      const name = data.title || data.name || data.orgName || 'Без названия';
      const sourceId = data.id || data.oid || String(Date.now());
      
      // Извлекаем фото
      let images: string[] = [];
      if (data.photos && Array.isArray(data.photos)) {
        images = data.photos.map((p: any) => typeof p === 'string' ? p : p.url || p.urlTemplate);
      } else if (data.images && Array.isArray(data.images)) {
        images = data.images;
      } else if (data.gallery && Array.isArray(data.gallery)) {
        images = data.gallery;
      }
      
      // Извлекаем категории
      let cuisine: string[] = [];
      if (data.categories && Array.isArray(data.categories)) {
        cuisine = data.categories.map((c: any) => typeof c === 'string' ? c : c.name);
      } else if (data.rubrics && Array.isArray(data.rubrics)) {
        cuisine = data.rubrics;
      } else if (data.type) {
        cuisine = [data.type];
      }
      
      return {
        ...base,
        name,
        slug: generateSlug(name, sourceId),
        address: data.address || data.formattedAddress || data.fullAddress || '',
        city: data.city || data.locality || data.cityName || extractCity(data.address || ''),
        latitude: data.coordinates?.lat || data.lat || data.geo?.lat || data.point?.lat || 0,
        longitude: data.coordinates?.lon || data.lng || data.lon || data.geo?.lon || data.point?.lon || 0,
        phone: data.phone || data.phones?.[0] || data.contactInfo?.phone || null,
        website: data.website || data.site || null,
        rating: data.rating || data.stars || data.score || null,
        ratingCount: data.reviewsCount || data.reviewCount || (Array.isArray(data.reviews) ? data.reviews.length : 0),
        sourceId,
        sourceUrl: data.url || data.link || `https://yandex.ru/maps/org/${sourceId}`,
        images: images.filter(Boolean).slice(0, 10),
        cuisine: cuisine.filter(Boolean),
        priceRange: data.priceCategory || data.price || null,
        _openingHours: data.workingHours || data.openingHours || data.schedule || null,
        _reviews: data.reviews || [],
      };
    }

    case '2gis': {
      // Формат от m_mamaev/2gis-places-scraper
      const name = data.name || data.title || 'Без названия';
      const sourceId = data.id || data.firmId || String(Date.now());
      
      // Извлекаем фото
      let images: string[] = [];
      if (data.photos && Array.isArray(data.photos)) {
        images = data.photos.map((p: any) => typeof p === 'string' ? p : p.url || p.preview_url);
      } else if (data.images && Array.isArray(data.images)) {
        images = data.images;
      } else if (data.gallery && Array.isArray(data.gallery)) {
        images = data.gallery;
      }
      
      // Извлекаем категории
      let cuisine: string[] = [];
      if (data.rubrics && Array.isArray(data.rubrics)) {
        cuisine = data.rubrics.map((r: any) => typeof r === 'string' ? r : r.name);
      } else if (data.categories && Array.isArray(data.categories)) {
        cuisine = data.categories;
      } else if (data.type) {
        cuisine = [data.type];
      }
      
      return {
        ...base,
        name,
        slug: generateSlug(name, sourceId),
        address: data.address || data.address_name || data.fullAddress || '',
        city: data.city || data.cityName || extractCity(data.address || ''),
        latitude: data.lat || data.point?.lat || data.geo?.lat || data.coordinates?.lat || 0,
        longitude: data.lon || data.lng || data.point?.lon || data.geo?.lon || data.coordinates?.lon || 0,
        phone: data.phone || data.phones?.[0] || data.contacts?.phone || null,
        website: data.website || data.site || null,
        rating: data.rating || data.stars || data.reviewRating || null,
        ratingCount: data.reviewCount || data.reviews_count || data.reviewsCount || (Array.isArray(data.reviews) ? data.reviews.length : 0),
        sourceId,
        sourceUrl: data.link || data.url || `https://2gis.ru/firm/${sourceId}`,
        images: images.filter(Boolean).slice(0, 10),
        cuisine: cuisine.filter(Boolean),
        priceRange: data.priceCategory || data.average_bill || null,
        _openingHours: data.schedule || data.workingHours || data.working_hours || null,
        _reviews: data.reviews || [],
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
