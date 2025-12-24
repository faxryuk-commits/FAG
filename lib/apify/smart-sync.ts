import { prisma } from '@/lib/prisma';
import apifyClient from './client';
import { SyncSource } from './sync';

/**
 * Умная синхронизация с разделением на типы данных
 * 
 * ЧАСТЫЕ ОБНОВЛЕНИЯ (ежедневно):
 * - Отзывы
 * - Рейтинг
 * - Количество отзывов
 * 
 * РЕДКИЕ ОБНОВЛЕНИЯ (еженедельно/ежемесячно):
 * - Адрес
 * - Время работы
 * - Телефон
 * - Координаты
 * - Фото
 */

export type SyncMode = 'full' | 'reviews_only' | 'basic_info';

interface SyncConfig {
  mode: SyncMode;
  // Интервалы обновления в днях
  reviewsInterval: number;      // Отзывы - по умолчанию 1 день
  ratingInterval: number;       // Рейтинг - по умолчанию 1 день
  basicInfoInterval: number;    // Базовая инфо - по умолчанию 7 дней
  photosInterval: number;       // Фото - по умолчанию 14 дней
  hoursInterval: number;        // Время работы - по умолчанию 30 дней
}

export const DEFAULT_CONFIG: SyncConfig = {
  mode: 'full',
  reviewsInterval: 1,       // Каждый день
  ratingInterval: 1,        // Каждый день
  basicInfoInterval: 7,     // Раз в неделю
  photosInterval: 14,       // Раз в 2 недели
  hoursInterval: 30,        // Раз в месяц
};

/**
 * Проверяет, нужно ли обновить данные
 */
function needsUpdate(lastUpdate: Date | null, intervalDays: number): boolean {
  if (!lastUpdate) return true;
  
  const now = new Date();
  const diff = now.getTime() - new Date(lastUpdate).getTime();
  const daysDiff = diff / (1000 * 60 * 60 * 24);
  
  return daysDiff >= intervalDays;
}

/**
 * Определяет какой режим синхронизации нужен для ресторана
 */
export async function determineSyncMode(
  restaurantId: string, 
  config: Partial<SyncConfig> = {}
): Promise<SyncMode> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      lastSynced: true,
      // Храним метаданные обновлений в JSON
    },
  });
  
  if (!restaurant) return 'full';
  
  // Получаем метаданные последних обновлений
  const meta = await getRestaurantSyncMeta(restaurantId);
  
  // Если базовая инфо устарела - полное обновление
  if (needsUpdate(meta.lastBasicInfoSync, cfg.basicInfoInterval)) {
    return 'full';
  }
  
  // Если только отзывы устарели - обновляем только их
  if (needsUpdate(meta.lastReviewsSync, cfg.reviewsInterval)) {
    return 'reviews_only';
  }
  
  // Данные актуальны
  return 'basic_info';
}

/**
 * Получает метаданные синхронизации ресторана
 */
async function getRestaurantSyncMeta(restaurantId: string) {
  const meta = await prisma.restaurantSyncMeta.findUnique({
    where: { restaurantId },
  });
  
  return {
    lastBasicInfoSync: meta?.lastBasicInfoSync || null,
    lastReviewsSync: meta?.lastReviewsSync || null,
    lastPhotosSync: meta?.lastPhotosSync || null,
    lastHoursSync: meta?.lastHoursSync || null,
  };
}

/**
 * Обновляет метаданные синхронизации
 */
async function updateSyncMeta(restaurantId: string, mode: SyncMode) {
  const now = new Date();
  const data: any = {};
  
  switch (mode) {
    case 'full':
      data.lastBasicInfoSync = now;
      data.lastReviewsSync = now;
      data.lastPhotosSync = now;
      data.lastHoursSync = now;
      break;
    case 'reviews_only':
      data.lastReviewsSync = now;
      break;
    case 'basic_info':
      data.lastBasicInfoSync = now;
      break;
  }
  
  await prisma.restaurantSyncMeta.upsert({
    where: { restaurantId },
    update: data,
    create: { restaurantId, ...data },
  });
}

/**
 * Формирует input для актера в зависимости от режима
 */
export function getSmartActorInput(
  source: SyncSource, 
  mode: SyncMode,
  placeId?: string
) {
  switch (source) {
    case 'google':
      if (mode === 'reviews_only') {
        // Только отзывы - дешевле и быстрее
        return {
          startUrls: placeId ? [{ url: `https://www.google.com/maps/place/?q=place_id:${placeId}` }] : [],
          maxImages: 0,           // Не грузим фото
          maxReviews: 20,         // Только свежие отзывы
          reviewsSort: 'newest',
          scrapeReviewerName: true,
          additionalInfo: false,  // Не грузим время работы
        };
      }
      // Полный режим
      return {
        startUrls: placeId ? [{ url: `https://www.google.com/maps/place/?q=place_id:${placeId}` }] : [],
        maxImages: 10,
        maxReviews: 10,
        reviewsSort: 'newest',
        additionalInfo: true,
      };
      
    default:
      return {};
  }
}

/**
 * Рассчитывает экономию при умном обновлении
 */
export function calculateSavings(
  totalRestaurants: number,
  config: Partial<SyncConfig> = {}
): { 
  fullSyncCost: number;
  smartSyncCost: number;
  savingsPercent: number;
  savingsAmount: number;
} {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const costPerFullSync = 0.003;    // Полная синхронизация
  const costPerReviewSync = 0.001;  // Только отзывы (дешевле)
  
  const daysInMonth = 30;
  
  // Стоимость если обновлять всё каждый день
  const fullSyncCost = totalRestaurants * costPerFullSync * daysInMonth;
  
  // Стоимость при умном обновлении
  const fullSyncsPerMonth = Math.ceil(daysInMonth / cfg.basicInfoInterval);
  const reviewSyncsPerMonth = Math.ceil(daysInMonth / cfg.reviewsInterval) - fullSyncsPerMonth;
  
  const smartSyncCost = 
    totalRestaurants * costPerFullSync * fullSyncsPerMonth +
    totalRestaurants * costPerReviewSync * Math.max(0, reviewSyncsPerMonth);
  
  const savingsAmount = fullSyncCost - smartSyncCost;
  const savingsPercent = (savingsAmount / fullSyncCost) * 100;
  
  return {
    fullSyncCost: Math.round(fullSyncCost * 100) / 100,
    smartSyncCost: Math.round(smartSyncCost * 100) / 100,
    savingsPercent: Math.round(savingsPercent),
    savingsAmount: Math.round(savingsAmount * 100) / 100,
  };
}

/**
 * Получает рестораны которым нужно обновление
 */
export async function getRestaurantsNeedingSync(
  config: Partial<SyncConfig> = {},
  limit = 100
): Promise<{
  needFullSync: string[];
  needReviewsOnly: string[];
  upToDate: number;
}> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  const restaurants = await prisma.restaurant.findMany({
    select: { id: true, sourceId: true },
    take: limit,
  });
  
  const metas = await prisma.restaurantSyncMeta.findMany({
    where: { restaurantId: { in: restaurants.map(r => r.id) } },
  });
  
  const metaMap = new Map(metas.map(m => [m.restaurantId, m]));
  
  const needFullSync: string[] = [];
  const needReviewsOnly: string[] = [];
  let upToDate = 0;
  
  for (const restaurant of restaurants) {
    const meta = metaMap.get(restaurant.id);
    
    if (!meta || needsUpdate(meta.lastBasicInfoSync, cfg.basicInfoInterval)) {
      needFullSync.push(restaurant.id);
    } else if (needsUpdate(meta.lastReviewsSync, cfg.reviewsInterval)) {
      needReviewsOnly.push(restaurant.id);
    } else {
      upToDate++;
    }
  }
  
  return { needFullSync, needReviewsOnly, upToDate };
}

/**
 * Запускает умную синхронизацию
 */
export async function runSmartSync(config: Partial<SyncConfig> = {}) {
  const { needFullSync, needReviewsOnly, upToDate } = await getRestaurantsNeedingSync(config);
  
  const stats = {
    fullSyncCount: needFullSync.length,
    reviewsSyncCount: needReviewsOnly.length,
    upToDateCount: upToDate,
    processed: 0,
    errors: 0,
  };
  
  // Здесь запуск актуальной синхронизации
  // Пока возвращаем статистику
  
  return stats;
}

