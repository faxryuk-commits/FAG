import apifyClient from './client';
import { prisma } from '@/lib/prisma';
import { saveWithConsolidation } from './consolidate';

export type SyncSource = 'yandex' | 'google' | '2gis';

// ID актеров в Apify
// Можно использовать полное имя (username/actor-name) или ID
const ACTOR_IDS = {
  // Google Maps - используем проверенный актёр
  google: 'compass/crawler-google-places',   // Основной актёр
  yandex: 'johnvc/Scrape-Yandex',            // Яндекс.Карты
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
 * Извлекает отзывы из данных (универсальная функция)
 */
function extractReviews(data: any): any[] {
  // Прямые поля с отзывами
  if (Array.isArray(data.reviews) && data.reviews.length > 0) {
    console.log(`[Reviews] Found ${data.reviews.length} reviews in data.reviews`);
    return data.reviews;
  }
  if (Array.isArray(data.reviewsData) && data.reviewsData.length > 0) {
    console.log(`[Reviews] Found ${data.reviewsData.length} reviews in data.reviewsData`);
    return data.reviewsData;
  }
  if (Array.isArray(data.reviewsList) && data.reviewsList.length > 0) {
    console.log(`[Reviews] Found ${data.reviewsList.length} reviews in data.reviewsList`);
    return data.reviewsList;
  }
  if (Array.isArray(data.userReviews) && data.userReviews.length > 0) {
    console.log(`[Reviews] Found ${data.userReviews.length} reviews in data.userReviews`);
    return data.userReviews;
  }
  if (Array.isArray(data.comments) && data.comments.length > 0) {
    console.log(`[Reviews] Found ${data.comments.length} reviews in data.comments`);
    return data.comments;
  }
  
  // Поле review (единственный отзыв в объекте)
  if (data.review && typeof data.review === 'object') {
    console.log(`[Reviews] Found single review in data.review`);
    return [data.review];
  }
  
  // Если данные сами являются отзывом (oneReviewPerRow)
  if (data.reviewId || (data.text && data.author)) {
    console.log(`[Reviews] Data is a single review (oneReviewPerRow mode)`);
    return [data];
  }
  
  console.log(`[Reviews] No reviews found in data`);
  return [];
}

/**
 * Извлекает URL меню из данных
 */
function extractMenuUrl(data: any): string | null {
  // Объект menu с link
  if (data.menu && typeof data.menu === 'object' && data.menu.link) {
    return data.menu.link;
  }
  // Прямая строка
  if (typeof data.menu === 'string' && data.menu.startsWith('http')) {
    return data.menu;
  }
  // Другие поля
  return data.menuUrl || data.menuLink || data.orderOnlineUrl || null;
}

/**
 * Извлекает позиции меню из данных Google Maps
 * Google может возвращать меню в поле menu.menuItems
 */
function extractMenuItems(data: any): any[] {
  const items: any[] = [];
  
  // Google Maps menu object
  if (data.menu && typeof data.menu === 'object') {
    // Формат: menu.menuItems или menu.categories[].items[]
    if (Array.isArray(data.menu.menuItems)) {
      for (const item of data.menu.menuItems) {
        items.push({
          name: item.name || item.title || '',
          description: item.description || '',
          price: parsePrice(item.price),
          category: item.category || item.section || null,
          image: item.image || item.photo || null,
        });
      }
    }
    
    // Формат с категориями
    if (Array.isArray(data.menu.categories)) {
      for (const cat of data.menu.categories) {
        const categoryName = cat.name || cat.title || '';
        const catItems = cat.items || cat.menuItems || [];
        for (const item of catItems) {
          items.push({
            name: item.name || item.title || '',
            description: item.description || '',
            price: parsePrice(item.price),
            category: categoryName,
            image: item.image || item.photo || null,
          });
        }
      }
    }
  }
  
  // Прямое поле menuItems
  if (Array.isArray(data.menuItems)) {
    for (const item of data.menuItems) {
      items.push({
        name: item.name || item.title || '',
        description: item.description || '',
        price: parsePrice(item.price),
        category: item.category || item.section || null,
        image: item.image || item.photo || null,
      });
    }
  }
  
  // Поле dishes (некоторые актёры)
  if (Array.isArray(data.dishes)) {
    for (const item of data.dishes) {
      items.push({
        name: item.name || item.title || '',
        description: item.description || '',
        price: parsePrice(item.price),
        category: item.category || null,
        image: item.image || item.photo || null,
      });
    }
  }
  
  return items.filter(item => item.name);
}

/**
 * Парсит цену из разных форматов
 */
function parsePrice(price: any): number | null {
  if (typeof price === 'number') return price;
  if (!price) return null;
  
  const str = String(price);
  // Убираем валюту и пробелы, оставляем числа
  const numbers = str.replace(/[^\d.,]/g, '').replace(',', '.');
  const parsed = parseFloat(numbers);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Формирует input для актера в зависимости от источника
 */
function getActorInput(source: SyncSource, searchQuery: string, location: string, maxResults: number) {
  switch (source) {
    case 'google':
      // compass/crawler-google-places - официальный актёр от Apify
      // Документация: https://apify.com/compass/crawler-google-places
      console.log(`[Google Maps] Starting scrape with maxResults: ${maxResults}`);
      
      return {
        // ===== МЕТОД "WHERE + WHAT" =====
        // Разделяем поисковый запрос и местоположение для преодоления лимита 120 мест
        searchStringsArray: [searchQuery], // Только тип заведения: "пицца", "рестораны"
        locationQuery: location,            // Отдельно город: "Ташкент"
        
        // ===== КЛЮЧЕВОЙ ПАРАМЕТР - КОЛИЧЕСТВО МЕСТ =====
        // ВАЖНО: Явно устанавливаем большой лимит
        maxCrawledPlacesPerSearch: maxResults,
        maxCrawledPlaces: maxResults,  // Общий лимит на весь запуск
        
        // ===== РЕЖИМ ПОИСКА =====
        // deeperCityScrape разбивает город на зоны (grid) для полного охвата
        // Это позволяет обойти лимит Google Maps в 120 результатов
        deeperCityScrape: true,
        
        // Язык и регион
        language: 'ru',
        
        // ===== ИЗОБРАЖЕНИЯ =====
        maxImages: 10,
        
        // ===== ОТЗЫВЫ - детальные =====
        maxReviews: 20,
        reviewsSort: 'newest',
        scrapeReviewerName: true,
        scrapeReviewerId: true,
        scrapeReviewerUrl: true,
        scrapeResponseFromOwnerText: true,
        
        // ===== ДОПОЛНИТЕЛЬНЫЕ ДАННЫЕ =====
        additionalInfo: true,           // Характеристики заведения
        scrapeTableReservation: true,   // Бронирование столиков
        
        // ===== ПРОИЗВОДИТЕЛЬНОСТЬ =====
        maxConcurrency: 10,
        maxPageRetries: 3,
        
        // Не пропускать закрытые заведения
        skipClosedPlaces: false,
        
        // Включить все данные
        includeHistogram: true,         // Популярные часы
        includePeopleAlsoSearch: false, // "Люди также ищут"
        includeWebResults: false,       // Веб-результаты не нужны
      };
    
    case 'yandex':
      // johnvc/Scrape-Yandex - требует поле text
      console.log(`[Yandex] Starting scrape with maxItems: ${maxResults}`);
      return {
        text: `${searchQuery} ${location}`,
        maxItems: maxResults,
        language: 'ru',
        // Дополнительные параметры для пагинации
        maxPagesPerQuery: Math.ceil(maxResults / 20), // ~20 результатов на страницу
        includePhotos: true,
        includeReviews: true,
        includeHours: true,
      };
    
    case '2gis': {
      // apify/web-scraper для парсинга 2ГИС с пагинацией
      const citySlug2gis = get2GisCitySlug(location);
      const searchUrl2gis = `https://2gis.ru/${citySlug2gis}/search/${encodeURIComponent(searchQuery)}`;
      
      return {
        startUrls: [{ url: searchUrl2gis }],
        
        pageFunction: `async function pageFunction(context) {
          const { request, log, jQuery, page } = context;
          const $ = jQuery;
          const maxItems = ${maxResults};
          
          log.info('Parsing 2GIS page: ' + request.url);
          log.info('Target: ' + maxItems + ' items');
          
          // Ждём начальной загрузки
          await context.waitFor(3000);
          
          const allResults = new Map(); // Используем Map для дедупликации по имени
          let previousCount = 0;
          let noNewResultsCount = 0;
          const maxScrollAttempts = 50; // Максимум попыток прокрутки
          
          // Функция для сбора карточек
          function collectCards() {
            $('[data-id], ._1hf7139, .miniCard, [class*="miniCard"]').each(function() {
              const $card = $(this);
              const name = $card.find('span._oqoid, ._1p8iqzw, .miniCard__title, [class*="title"]').first().text().trim();
              const address = $card.find('._2lcm958, .miniCard__address, [class*="address"]').first().text().trim();
              const rating = parseFloat($card.find('._y10azs, .miniCard__rating, [class*="rating"]').text()) || null;
              const reviewsText = $card.find('._jspzdm, .miniCard__reviews, [class*="reviews"]').text();
              const reviewsCount = parseInt(reviewsText.replace(/\\\\D/g, '')) || 0;
              const link = $card.find('a').first().attr('href') || '';
              
              if (name && !allResults.has(name)) {
                allResults.set(name, {
                  name,
                  address,
                  rating,
                  reviewsCount,
                  url: link.startsWith('http') ? link : 'https://2gis.ru' + link,
                  city: '${location}',
                });
              }
            });
          }
          
          // Первичный сбор
          collectCards();
          log.info('Initial collection: ' + allResults.size + ' places');
          
          // Прокручиваем страницу для загрузки больше результатов
          for (let i = 0; i < maxScrollAttempts && allResults.size < maxItems; i++) {
            // Прокручиваем контейнер с результатами
            await page.evaluate(() => {
              const scrollContainer = document.querySelector('[class*="searchResults"], [class*="scroll"], .scroll');
              if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
              } else {
                window.scrollTo(0, document.body.scrollHeight);
              }
            });
            
            // Ждём загрузки новых элементов
            await context.waitFor(1500);
            
            // Собираем новые карточки
            collectCards();
            
            // Проверяем, появились ли новые результаты
            if (allResults.size === previousCount) {
              noNewResultsCount++;
              if (noNewResultsCount >= 3) {
                log.info('No new results after 3 scroll attempts, stopping');
                break;
              }
            } else {
              noNewResultsCount = 0;
            }
            
            previousCount = allResults.size;
            log.info('Scroll ' + (i + 1) + ': collected ' + allResults.size + ' places');
          }
          
          const results = Array.from(allResults.values()).slice(0, maxItems);
          log.info('Final: ' + results.length + ' places collected');
          return results;
        }`,
        
        maxRequestsPerCrawl: 1, // Одна страница с прокруткой
        maxConcurrency: 1,
        waitUntil: 'networkidle',
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
 * Известные бренды/сети ресторанов для группировки
 */
const KNOWN_BRANDS = [
  'McDonald\'s', 'McDonalds', 'Макдоналдс',
  'KFC', 'КФС',
  'Burger King', 'Бургер Кинг',
  'Subway',
  'Starbucks', 'Старбакс',
  'Pizza Hut', 'Пицца Хат',
  'Domino\'s', 'Доминос',
  'Теремок',
  'Шоколадница',
  'Кофе Хауз',
  'Coffee House',
  'Му-Му',
  'Тануки',
  'Якитория',
  'Чайхона №1',
  'Чайхана',
  'Евразия',
  'IL Патио',
  'Планета Суши',
  'CZN Burak',
  'Novikov',
  'White Rabbit',
  'Пушкин',
];

/**
 * Извлекает бренд из названия ресторана
 */
function extractBrand(name: string): string | null {
  const lowerName = name.toLowerCase();
  
  for (const brand of KNOWN_BRANDS) {
    if (lowerName.includes(brand.toLowerCase())) {
      return brand;
    }
  }
  
  // Пытаемся извлечь бренд из названия типа "Brand Name - Location"
  const parts = name.split(/[-–—|]/);
  if (parts.length > 1) {
    return parts[0].trim();
  }
  
  return null;
}

/**
 * Нормализует данные из разных источников
 */
function normalizeData(source: SyncSource, data: any) {
  const base = { source, lastSynced: new Date() };

  switch (source) {
    case 'google': {
      // Поддержка разных форматов Google Maps актёров
      const name = data.title || data.name || data.searchString || 'Без названия';
      const sourceId = data.placeId || data.place_id || data.cid || data.id || String(Date.now());
      
      // Извлекаем бренд
      const brand = extractBrand(name);
      
      // Извлекаем фото (разные форматы)
      let images: string[] = [];
      if (data.imageUrls && Array.isArray(data.imageUrls)) {
        images = data.imageUrls;
      } else if (data.images && Array.isArray(data.images)) {
        images = data.images.map((img: any) => typeof img === 'string' ? img : img.url || img.imageUrl);
      } else if (data.imageUrl) {
        images = [data.imageUrl];
      } else if (data.thumbnail) {
        images = [data.thumbnail];
      } else if (data.photos && Array.isArray(data.photos)) {
        images = data.photos.map((p: any) => typeof p === 'string' ? p : p.url);
      }
      
      // Извлекаем категории (разные форматы)
      let cuisine: string[] = [];
      if (data.categories && Array.isArray(data.categories)) {
        cuisine = data.categories;
      } else if (data.categoryName) {
        cuisine = [data.categoryName];
      } else if (data.category) {
        cuisine = Array.isArray(data.category) ? data.category : [data.category];
      } else if (data.type) {
        cuisine = Array.isArray(data.type) ? data.type : [data.type];
      }
      
      // Извлекаем координаты (разные форматы)
      let lat = 0, lng = 0;
      if (data.location?.lat) {
        lat = data.location.lat;
        lng = data.location.lng;
      } else if (data.coordinates?.latitude) {
        lat = data.coordinates.latitude;
        lng = data.coordinates.longitude;
      } else if (data.gps_coordinates?.latitude) {
        lat = data.gps_coordinates.latitude;
        lng = data.gps_coordinates.longitude;
      } else {
        lat = data.latitude || data.lat || 0;
        lng = data.longitude || data.lng || 0;
      }
      
      return {
        ...base,
        name,
        brand, // Новое поле для группировки
        slug: generateSlug(name, sourceId),
        address: data.address || data.street || data.vicinity || data.formatted_address || '',
        city: data.city || data.neighborhood || extractCity(data.address || data.formatted_address || ''),
        latitude: lat,
        longitude: lng,
        phone: data.phone || data.phoneUnformatted || data.phone_number || data.internationalPhoneNumber || null,
        website: data.website || data.url || null,
        rating: data.totalScore || data.rating || data.stars || data.overall_rating || null,
        ratingCount: data.reviewsCount || data.userRatingsTotal || data.reviews_count || data.reviews?.length || 0,
        priceRange: data.price || (data.priceLevel ? '$'.repeat(data.priceLevel) : null) || data.price_level || null,
        sourceId,
        sourceUrl: data.url || data.link || data.googleMapsUrl || data.google_maps_url || `https://www.google.com/maps/place/?q=place_id:${sourceId}`,
        images: images.filter(Boolean).slice(0, 10),
        cuisine: cuisine.filter(Boolean),
        // Время работы
        _openingHours: data.openingHours || data.workingHours || data.hours || data.opening_hours || null,
        // Отзывы
        _reviews: extractReviews(data),
        // Меню - ссылка (из документации актёра: поле "menu")
        menuUrl: extractMenuUrl(data),
        // Позиции меню если есть
        _menuItems: extractMenuItems(data),
        // Популярные часы (histogram)
        _popularTimes: data.popularTimesHistogram || data.popularTimes || null,
        // Бронирование столиков
        _reservationUrl: data.reserveTableUrl || data.tableReservation || null,
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
        _reviews: extractReviews(data),
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
        _reviews: extractReviews(data),
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
