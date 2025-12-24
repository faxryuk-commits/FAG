import apifyClient from './client';
import { prisma } from '@/lib/prisma';

export type SyncSource = 'yandex' | 'google' | '2gis';

/**
 * Генерирует slug из названия
 */
function generateSlug(name: string, sourceId: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s]/gi, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
  
  // Добавляем часть sourceId для уникальности
  const suffix = sourceId.substring(0, 8);
  return `${base}-${suffix}`;
}

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
  
  if (run?.status === 'SUCCEEDED' && run.defaultDatasetId) {
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
    case 'yandex': {
      const name = data.name || data.title || 'Без названия';
      const sourceId = data.id || data.placeId || String(Date.now());
      return {
        ...base,
        name,
        slug: generateSlug(name, sourceId),
        address: data.address || data.formattedAddress || '',
        city: extractCity(data.address || ''),
        latitude: data.coordinates?.lat || data.lat || 0,
        longitude: data.coordinates?.lon || data.lng || 0,
        phone: data.phones?.[0] || null,
        website: data.url || null,
        rating: data.rating || null,
        ratingCount: data.reviewsCount || 0,
        sourceId,
        sourceUrl: data.url || null,
        images: data.photos || [],
        cuisine: data.categories || [],
      };
    }

    case 'google': {
      const name = data.name || 'Без названия';
      const sourceId = data.place_id || String(Date.now());
      return {
        ...base,
        name,
        slug: generateSlug(name, sourceId),
        address: data.formatted_address || '',
        city: extractCity(data.formatted_address || ''),
        latitude: data.geometry?.location?.lat || 0,
        longitude: data.geometry?.location?.lng || 0,
        phone: data.formatted_phone_number || null,
        website: data.website || null,
        rating: data.rating || null,
        ratingCount: data.user_ratings_total || 0,
        priceRange: data.price_level ? '$'.repeat(data.price_level) : null,
        sourceId,
        sourceUrl: data.url || null,
        images: data.photos?.map((p: any) => p.photo_reference) || [],
        cuisine: data.types || [],
      };
    }

    case '2gis': {
      const name = data.name || 'Без названия';
      const sourceId = data.id || String(Date.now());
      return {
        ...base,
        name,
        slug: generateSlug(name, sourceId),
        address: data.address_name || '',
        city: data.city || extractCity(data.address_name || ''),
        latitude: data.point?.lat || 0,
        longitude: data.point?.lon || 0,
        phone: data.contacts?.phones?.[0]?.formatted || null,
        website: data.url || null,
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
  // Простая логика извлечения города из адреса
  // Можно улучшить с помощью геокодинга
  const parts = address.split(',');
  return parts[parts.length - 1]?.trim() || 'Неизвестно';
}

// TODO: Реализовать обработку времени работы и отзывов
// после создания ресторана через отдельные запросы

function getDefaultActorId(source: SyncSource): string {
  // Здесь должны быть ID ваших актеров в Apify
  const actorIds = {
    yandex: 'your-yandex-actor-id',
    google: 'your-google-actor-id',
    '2gis': 'your-2gis-actor-id',
  };

  return actorIds[source];
}

