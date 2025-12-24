import apifyClient from './client';
import { prisma } from '@/lib/prisma';

export type SyncSource = 'yandex' | 'google' | '2gis';

interface SyncOptions {
  source: SyncSource;
  city?: string;
  actorId?: string;
  input?: Record<string, any>;
}

/**
 * Запускает синхронизацию данных через Apify
 */
export async function startSync(options: SyncOptions) {
  const { source, city, actorId, input } = options;

  // Создаем запись о задаче синхронизации
  const syncJob = await prisma.syncJob.create({
    data: {
      source,
      status: 'pending',
    },
  });

  try {
    // Определяем actor ID если не указан
    const finalActorId = actorId || getDefaultActorId(source);

    // Запускаем актера
    const run = await apifyClient.actor(finalActorId).start({
      ...input,
      city: city || 'Москва',
    });

    // Обновляем статус задачи
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: 'running',
        startedAt: new Date(),
        stats: {
          runId: run.id,
        },
      },
    });

    return {
      jobId: syncJob.id,
      runId: run.id,
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
 * Получает результаты выполнения актера
 */
export async function getSyncResults(runId: string) {
  const run = await apifyClient.run(runId).get();
  
  if (run.status === 'SUCCEEDED') {
    const dataset = await apifyClient.dataset(run.defaultDatasetId).listItems();
    return dataset.items;
  }

  return null;
}

/**
 * Обрабатывает данные из Apify и сохраняет в БД
 */
export async function processSyncResults(
  source: SyncSource,
  results: any[],
  jobId: string
) {
  let processed = 0;
  let errors = 0;

  for (const item of results) {
    try {
      await processRestaurantData(source, item);
      processed++;
    } catch (error) {
      console.error(`Error processing restaurant:`, error);
      errors++;
    }
  }

  // Обновляем статистику задачи
  await prisma.syncJob.update({
    where: { id: jobId },
    data: {
      status: 'completed',
      completedAt: new Date(),
      stats: {
        processed,
        errors,
        total: results.length,
      },
    },
  });

  return { processed, errors, total: results.length };
}

/**
 * Обрабатывает данные одного ресторана
 */
async function processRestaurantData(source: SyncSource, data: any) {
  // Нормализуем данные в зависимости от источника
  const normalized = normalizeRestaurantData(source, data);

  // Проверяем, существует ли ресторан
  const existing = await prisma.restaurant.findFirst({
    where: {
      source,
      sourceId: normalized.sourceId,
    },
  });

  if (existing) {
    // Обновляем существующий
    await prisma.restaurant.update({
      where: { id: existing.id },
      data: {
        ...normalized,
        lastSynced: new Date(),
      },
    });
  } else {
    // Создаем новый
    await prisma.restaurant.create({
      data: normalized,
    });
  }
}

/**
 * Нормализует данные ресторана из разных источников
 */
function normalizeRestaurantData(source: SyncSource, data: any) {
  // Базовая структура
  const base = {
    source,
    lastSynced: new Date(),
  };

  switch (source) {
    case 'yandex':
      return {
        ...base,
        name: data.name || data.title,
        address: data.address || data.formattedAddress,
        city: extractCity(data.address),
        latitude: data.coordinates?.lat || data.lat,
        longitude: data.coordinates?.lon || data.lng,
        phone: data.phones?.[0],
        website: data.url,
        rating: data.rating,
        ratingCount: data.reviewsCount || 0,
        sourceId: data.id || data.placeId,
        sourceUrl: data.url,
        images: data.photos || [],
        cuisine: data.categories || [],
        workingHours: data.workingHours ? {
          create: normalizeWorkingHours(data.workingHours),
        } : undefined,
        reviews: data.reviews ? {
          create: normalizeReviews(data.reviews, source),
        } : undefined,
      };

    case 'google':
      return {
        ...base,
        name: data.name,
        address: data.formatted_address,
        city: extractCity(data.formatted_address),
        latitude: data.geometry?.location?.lat,
        longitude: data.geometry?.location?.lng,
        phone: data.formatted_phone_number,
        website: data.website,
        rating: data.rating,
        ratingCount: data.user_ratings_total || 0,
        priceRange: data.price_level ? '$'.repeat(data.price_level) : null,
        sourceId: data.place_id,
        sourceUrl: data.url,
        images: data.photos?.map((p: any) => p.photo_reference) || [],
        cuisine: data.types || [],
        workingHours: data.opening_hours?.weekday_text ? {
          create: normalizeGoogleWorkingHours(data.opening_hours.weekday_text),
        } : undefined,
        reviews: data.reviews ? {
          create: normalizeReviews(data.reviews, source),
        } : undefined,
      };

    case '2gis':
      return {
        ...base,
        name: data.name,
        address: data.address_name,
        city: data.city || extractCity(data.address_name),
        latitude: data.point?.lat,
        longitude: data.point?.lon,
        phone: data.contacts?.phones?.[0]?.formatted,
        website: data.url,
        rating: data.rating,
        ratingCount: data.reviews_count || 0,
        sourceId: data.id,
        sourceUrl: data.url,
        images: data.rubrics || [],
        cuisine: data.rubrics || [],
        workingHours: data.schedule ? {
          create: normalize2GisWorkingHours(data.schedule),
        } : undefined,
        reviews: data.reviews ? {
          create: normalizeReviews(data.reviews, source),
        } : undefined,
      };

    default:
      throw new Error(`Unknown source: ${source}`);
  }
}

function extractCity(address: string): string {
  // Простая логика извлечения города из адреса
  // Можно улучшить с помощью геокодинга
  const parts = address.split(',');
  return parts[parts.length - 1]?.trim() || 'Неизвестно';
}

function normalizeWorkingHours(hours: any) {
  // Нормализация времени работы для Яндекс.Карт
  // Формат зависит от API
  return [];
}

function normalizeGoogleWorkingHours(weekdayText: string[]) {
  // Нормализация времени работы для Google Maps
  return [];
}

function normalize2GisWorkingHours(schedule: any) {
  // Нормализация времени работы для 2ГИС
  return [];
}

function normalizeReviews(reviews: any[], source: SyncSource) {
  return reviews.map((review) => ({
    author: review.author_name || review.author || 'Аноним',
    rating: review.rating || review.rating_value || 0,
    text: review.text || review.comment || null,
    date: new Date(review.time || review.date || Date.now()),
    source,
    sourceId: review.id || null,
    isApproved: true, // Автоматически одобряем отзывы из источников
    isVerified: true,
  }));
}

function getDefaultActorId(source: SyncSource): string {
  // Здесь должны быть ID ваших актеров в Apify
  const actorIds = {
    yandex: 'your-yandex-actor-id',
    google: 'your-google-actor-id',
    '2gis': 'your-2gis-actor-id',
  };

  return actorIds[source];
}

