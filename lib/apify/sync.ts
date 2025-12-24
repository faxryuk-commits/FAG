import apifyClient from './client';
import { prisma } from '@/lib/prisma';
import { saveWithConsolidation } from './consolidate';

export type SyncSource = 'yandex' | 'google' | '2gis';

// ID актеров в Apify
// Можно использовать полное имя (username/actor-name) или ID
const ACTOR_IDS = {
  google: 'compass/crawler-google-places',   // Google Maps - работает отлично
  yandex: 'johnvc/Scrape-Yandex',            // Яндекс.Карты - специализированный скрейпер
  '2gis': 'apify/web-scraper',               // 2ГИС - через универсальный web-scraper
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
      // compass/crawler-google-places - полная конфигурация с детальными отзывами
      console.log(`[Google Maps] Starting scrape with maxResults: ${maxResults}`);
      return {
        // Основной поисковый запрос - точный формат для актера
        searchStringsArray: [`${searchQuery} in ${location}`],
        
        // ВСЕ параметры лимитов для полного охвата
        maxCrawledPlacesPerSearch: maxResults,  // Главный параметр
        maxCrawledPlaces: maxResults,           // Общий лимит
        maxResults: maxResults,                  // Альтернативный
        scrapeDirectories: false,               // Не парсить каталоги, только поиск
        
        // Язык и регион
        language: 'ru',
        geolocation: {
          country: 'RU',
        },
        
        // ИЗОБРАЖЕНИЯ
        maxImages: 10,
        placeMinimumStars: '',  // пустая строка = любой рейтинг
        
        // ДЕТАЛЬНЫЕ ОТЗЫВЫ - все поля
        maxReviews: 20,                          // Отзывов на каждое место
        reviewsSort: 'newest',                   // Сначала новые
        reviewsTranslation: 'originalAndTranslated',
        
        // Информация об авторе отзыва
        scrapeReviewerName: true,                // Имя автора
        scrapeReviewerId: true,                  // ID автора
        scrapeReviewerUrl: true,                 // Ссылка на профиль
        scrapeReviewId: true,                    // ID отзыва
        scrapeReviewUrl: true,                   // Ссылка на отзыв
        scrapeResponseFromOwnerText: true,       // Ответ владельца
        
        // Дополнительные детали отзывов
        reviewsFilterString: '',                 // Без фильтра
        personalDataOptions: 'full',             // Полные данные автора
        
        // Дополнительная информация о месте
        additionalInfo: true,
        includeWebResults: false,
        
        // Производительность - увеличиваем для большего охвата
        maxConcurrency: 20,
        maxPageRetries: 5,
        skipClosedPlaces: false,
        
        // Полные данные
        allPlacesNoSearch: false,
        oneReviewPerRow: false,
        
        // Глубина сканирования
        deeperCityScrape: true,                  // Глубокое сканирование города
        exportPlaceUrls: false,
      };
    
    case 'yandex':
      // johnvc/Scrape-Yandex - требует поле text
      return {
        text: `${searchQuery} ${location}`,
        maxItems: maxResults,
        language: 'ru',
      };
    
    case '2gis': {
      // apify/web-scraper для парсинга 2ГИС
      const citySlug2gis = get2GisCitySlug(location);
      const searchUrl2gis = `https://2gis.ru/${citySlug2gis}/search/${encodeURIComponent(searchQuery)}`;
      
      return {
        startUrls: [{ url: searchUrl2gis }],
        
        pageFunction: `async function pageFunction(context) {
          const { request, log, jQuery } = context;
          const $ = jQuery;
          
          log.info('Parsing 2GIS page: ' + request.url);
          
          // Ждём загрузки
          await context.waitFor(3000);
          
          const results = [];
          
          // Собираем карточки заведений
          $('[data-id], ._1hf7139, .miniCard').each(function() {
            const $card = $(this);
            const name = $card.find('span._oqoid, ._1p8iqzw, .miniCard__title').first().text().trim();
            const address = $card.find('._2lcm958, .miniCard__address').first().text().trim();
            const rating = parseFloat($card.find('._y10azs, .miniCard__rating').text()) || null;
            const reviewsText = $card.find('._jspzdm, .miniCard__reviews').text();
            const reviewsCount = parseInt(reviewsText.replace(/\\D/g, '')) || 0;
            const link = $card.find('a').first().attr('href') || '';
            
            if (name) {
              results.push({
                name,
                address,
                rating,
                reviewsCount,
                url: link.startsWith('http') ? link : 'https://2gis.ru' + link,
                city: '${location}',
              });
            }
          });
          
          log.info('Found ' + results.length + ' places');
          return results;
        }`,
        
        maxRequestsPerCrawl: maxResults,
        maxConcurrency: 5,
      };
    }
    
    default:
      return {};
  }
}

/**
 * Проверяет статус выполнения актера с промежуточными результатами
 */
export async function checkSyncStatus(runId: string) {
  const run = await apifyClient.run(runId).get();
  
  // Пытаемся получить промежуточные результаты
  let itemCount = 0;
  let recentItems: Array<{ name: string; status: 'success' | 'error' }> = [];
  
  if (run?.defaultDatasetId) {
    try {
      const datasetInfo = await apifyClient.dataset(run.defaultDatasetId).get();
      itemCount = datasetInfo?.itemCount || 0;
      
      // Получаем последние элементы для мониторинга
      if (itemCount > 0) {
        const items = await apifyClient.dataset(run.defaultDatasetId).listItems({ 
          limit: 10,
          offset: Math.max(0, itemCount - 10),
        });
        recentItems = items.items.map((item: any) => ({
          name: String(item.title || item.name || 'Без названия'),
          status: 'success' as const,
        }));
      }
    } catch (e) {
      console.log('Could not get intermediate results:', e);
    }
  }
  
  return {
    status: run?.status,
    isFinished: ['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(run?.status || ''),
    itemCount,
    recentItems,
  };
}

/**
 * Отменяет выполнение актера
 */
export async function abortSync(runId: string) {
  try {
    await apifyClient.run(runId).abort();
    return { success: true };
  } catch (error) {
    console.error('Failed to abort run:', error);
    return { success: false, error };
  }
}

/**
 * Получает результаты и сохраняет в БД с реалтайм обновлением прогресса
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
  const processedItems: Array<{ name: string; status: 'success' | 'error'; error?: string }> = [];

  for (const item of results) {
    const itemName = String(item.title || item.name || 'Без названия');
    try {
      await saveRestaurant(source, item);
      processed++;
      processedItems.push({ name: itemName, status: 'success' });
      
      // Обновляем прогресс каждые 5 записей для реалтайм мониторинга
      if (processed % 5 === 0 || processed === results.length) {
        await prisma.syncJob.update({
          where: { id: jobId },
          data: {
            stats: { 
              runId, 
              processed, 
              errors, 
              total: results.length,
              lastProcessed: itemName,
              processedItems: processedItems.slice(-10), // Последние 10 записей
            },
          },
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error saving restaurant "${itemName}":`, errorMessage);
      errors++;
      processedItems.push({ name: itemName, status: 'error', error: errorMessage });
    }
  }

  await prisma.syncJob.update({
    where: { id: jobId },
    data: {
      status: 'completed',
      completedAt: new Date(),
      stats: { 
        runId,
        processed, 
        errors, 
        total: results.length,
        processedItems: processedItems.slice(-20), // Последние 20 записей
      },
    },
  });

  return { processed, errors, total: results.length, items: processedItems };
}

/**
 * Получает результаты синхронизации по jobId (для webhook)
 */
export async function getSyncResults(jobId: string) {
  const job = await prisma.syncJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error('Job not found');
  }

  const stats = job.stats as { runId?: string } | null;
  const runId = stats?.runId;

  if (!runId) {
    throw new Error('No runId found for job');
  }

  return fetchAndSaveResults(runId, jobId, job.source as SyncSource);
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
        // Отзывы могут быть в разных полях
        _reviews: data.reviews || data.reviewsData || data.reviewsList || data.userReviews || [],
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
        _reviews: data.reviews || data.reviewsData || data.comments || [],
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
