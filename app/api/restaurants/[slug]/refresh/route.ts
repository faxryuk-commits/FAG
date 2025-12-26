import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Точечное обновление данных заведения через Google Places API (New)
 * 
 * Цены Google Places API (актуально на декабрь 2024):
 * - Place Details (Basic): $0.00 (ID only)
 * - Place Details (Contact): $0.003
 * - Place Details (Atmosphere): $0.005  
 * - Text Search: $0.032
 * - Place Photos: $0.007
 * 
 * Бесплатно: $200/месяц (~6000 запросов Place Details Advanced)
 */

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Referer для API запросов (если ключ настроен с referrer restriction)
const API_REFERER = process.env.GOOGLE_API_REFERER || 'https://fag-zeta.vercel.app';

// Какие поля обновлять и их стоимость
const FIELD_CONFIGS = {
  basic: {
    mask: 'displayName,rating,userRatingCount,nationalPhoneNumber,websiteUri',
    cost: 0.003, // Contact fields
    label: 'Основное (рейтинг, контакты)',
  },
  hours: {
    mask: 'currentOpeningHours,regularOpeningHours',
    cost: 0.005, // Atmosphere fields
    label: 'Время работы',
  },
  photos: {
    mask: 'photos',
    cost: 0.007, // Per photo request
    label: 'Фотографии',
  },
  reviews: {
    mask: 'reviews',
    cost: 0.005, // Atmosphere fields
    label: 'Отзывы',
  },
  full: {
    mask: 'displayName,rating,userRatingCount,currentOpeningHours,nationalPhoneNumber,websiteUri,photos,reviews,priceLevel',
    cost: 0.017, // All fields combined
    label: 'Всё сразу',
  },
};

interface RefreshOptions {
  fields?: keyof typeof FIELD_CONFIGS;
  force?: boolean;
}

// Логирование использования API (таблица может не существовать)
async function logApiUsage(endpoint: string, cost: number) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  try {
    // Проверяем существует ли таблица и логируем использование
    await prisma.apiUsage.upsert({
      where: {
        service_endpoint_year_month: {
          service: 'google_places',
          endpoint,
          year,
          month,
        },
      },
      update: {
        requests: { increment: 1 },
        totalCost: { increment: cost },
      },
      create: {
        service: 'google_places',
        endpoint,
        cost,
        year,
        month,
        requests: 1,
        totalCost: cost,
      },
    });
  } catch (error: any) {
    // Игнорируем если таблица не существует (P2021)
    if (error?.code !== 'P2021') {
      console.error('Error logging API usage:', error);
    }
    // Таблица не существует - пропускаем логирование
  }
}

// POST - обновить данные заведения
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    // Проверяем наличие API ключа
    if (!GOOGLE_API_KEY) {
      return NextResponse.json({
        error: 'Google Places API key not configured',
        hint: 'Добавьте GOOGLE_PLACES_API_KEY в переменные окружения. Стоимость: ~$0.017 за запрос.',
        alternative: 'Можно использовать Apify для массового обновления',
      }, { status: 501 });
    }

    // Находим ресторан
    const restaurant = await prisma.restaurant.findFirst({
      where: {
        OR: [
          { slug: params.slug },
          { id: params.slug },
        ],
      },
    });

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    // Проверяем cooldown (не чаще 1 раза в день)
    const body = await request.json().catch(() => ({})) as RefreshOptions;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    if (!body.force && restaurant.lastSynced && restaurant.lastSynced > oneDayAgo) {
      return NextResponse.json({
        error: 'Cooldown active',
        message: 'Заведение уже обновлялось в последние 24 часа',
        lastSynced: restaurant.lastSynced,
        nextAvailable: new Date(restaurant.lastSynced.getTime() + 24 * 60 * 60 * 1000),
      }, { status: 429 });
    }

    // Получаем place_id
    let placeId = restaurant.sourceId;
    
    // Если sourceId не похож на place_id, пробуем найти по координатам
    if (!placeId?.startsWith('ChIJ') && restaurant.latitude && restaurant.longitude) {
      const searchResult = await findPlaceByLocation(
        restaurant.name,
        restaurant.latitude,
        restaurant.longitude
      );
      if (searchResult) {
        placeId = searchResult;
      }
    }

    if (!placeId) {
      return NextResponse.json({
        error: 'No place_id found',
        message: 'Не удалось найти заведение в Google Maps',
      }, { status: 404 });
    }

    // Запрашиваем данные из Google Places API (новый API)
    const fieldConfig = FIELD_CONFIGS[body.fields || 'basic'];
    const placeData = await fetchPlaceDetails(placeId, fieldConfig.mask);

    if (!placeData) {
      return NextResponse.json({
        error: 'Failed to fetch place details',
        hint: 'Проверьте настройки API ключа в Google Cloud Console. Уберите ограничение "HTTP referrers" или настройте "IP addresses".',
      }, { status: 502 });
    }

    // Логируем использование API
    await logApiUsage('place_details', fieldConfig.cost);

    // Обновляем данные в БД
    const updateData: any = {
      lastSynced: new Date(),
    };

    // Рейтинг
    if (placeData.rating) {
      updateData.rating = placeData.rating;
    }
    if (placeData.userRatingCount) {
      updateData.ratingCount = placeData.userRatingCount;
    }

    // Контакты
    if (placeData.nationalPhoneNumber) {
      updateData.phone = placeData.nationalPhoneNumber;
    }
    if (placeData.websiteUri) {
      updateData.website = placeData.websiteUri;
    }

    // Цена
    if (placeData.priceLevel) {
      const priceMap: Record<string, string> = {
        'PRICE_LEVEL_FREE': 'Бесплатно',
        'PRICE_LEVEL_INEXPENSIVE': '$',
        'PRICE_LEVEL_MODERATE': '$$',
        'PRICE_LEVEL_EXPENSIVE': '$$$',
        'PRICE_LEVEL_VERY_EXPENSIVE': '$$$$',
      };
      updateData.priceRange = priceMap[placeData.priceLevel] || null;
    }

    // Обновляем ресторан
    const updated = await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: updateData,
    });

    // Обновляем время работы если есть
    if (placeData.currentOpeningHours?.periods) {
      await updateWorkingHours(restaurant.id, placeData.currentOpeningHours.periods);
    }

    // Обновляем фото если запрошены
    if (body.fields === 'photos' || body.fields === 'full') {
      if (placeData.photos && placeData.photos.length > 0) {
        const photoUrls = await fetchPlacePhotos(placeData.photos.slice(0, 10));
        if (photoUrls.length > 0) {
          await prisma.restaurant.update({
            where: { id: restaurant.id },
            data: { images: photoUrls },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Данные обновлены',
      updated: {
        rating: updateData.rating,
        ratingCount: updateData.ratingCount,
        phone: updateData.phone,
        website: updateData.website,
        priceRange: updateData.priceRange,
      },
      cost: `~$${fieldConfig.cost.toFixed(3)}`,
      fieldType: body.fields || 'basic',
    });

  } catch (error) {
    console.error('Error refreshing restaurant:', error);
    return NextResponse.json({
      error: 'Failed to refresh restaurant',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// Поиск place_id по координатам и названию
async function findPlaceByLocation(name: string, lat: number, lng: number): Promise<string | null> {
  try {
    const url = 'https://places.googleapis.com/v1/places:searchText';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY!,
        'X-Goog-FieldMask': 'places.id',
        'Referer': API_REFERER,
        'Origin': API_REFERER,
      },
      body: JSON.stringify({
        textQuery: name,
        locationBias: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 100.0,
          },
        },
        maxResultCount: 1,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.places?.[0]?.id || null;
  } catch {
    return null;
  }
}

// Получение деталей места
async function fetchPlaceDetails(placeId: string, fieldMask: string): Promise<any> {
  try {
    const url = `https://places.googleapis.com/v1/places/${placeId}`;
    
    const response = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': GOOGLE_API_KEY!,
        'X-Goog-FieldMask': fieldMask,
        'Referer': API_REFERER,
        'Origin': API_REFERER,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google API error:', errorText);
      
      // Если ошибка связана с referrer - даём подсказку
      if (errorText.includes('referer') || errorText.includes('REFERRER')) {
        console.error('💡 Подсказка: В Google Cloud Console снимите ограничение "HTTP referrers" для API ключа, или используйте "IP addresses" ограничение');
      }
      
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching place details:', error);
    return null;
  }
}

// Получение URL фото
async function fetchPlacePhotos(photos: any[]): Promise<string[]> {
  const urls: string[] = [];
  
  for (const photo of photos) {
    if (photo.name) {
      // Новый Places API возвращает name вместо photo_reference
      const url = `https://places.googleapis.com/v1/${photo.name}/media?maxHeightPx=800&maxWidthPx=800&key=${GOOGLE_API_KEY}`;
      urls.push(url);
    }
  }
  
  return urls;
}

// Обновление времени работы
async function updateWorkingHours(restaurantId: string, periods: any[]) {
  const dayMap: Record<string, number> = {
    'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3,
    'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6,
  };

  // Google может вернуть несколько периодов для одного дня (с перерывом)
  // Группируем по дню и берём первый/последний период
  const hoursByDay = new Map<number, { openTime: string; closeTime: string }>();
  
  for (const period of periods) {
    const day = dayMap[period.open?.day];
    if (day === undefined) continue;
    
    const openTime = formatTime(period.open?.hour, period.open?.minute);
    const closeTime = formatTime(period.close?.hour, period.close?.minute);
    
    if (openTime === '00:00' && closeTime === '00:00') continue;
    
    const existing = hoursByDay.get(day);
    if (existing) {
      // Если уже есть - расширяем диапазон (берём самое раннее открытие и позднее закрытие)
      if (openTime < existing.openTime) existing.openTime = openTime;
      if (closeTime > existing.closeTime) existing.closeTime = closeTime;
    } else {
      hoursByDay.set(day, { openTime, closeTime });
    }
  }

  const hours = Array.from(hoursByDay.entries()).map(([dayOfWeek, times]) => ({
    dayOfWeek,
    openTime: times.openTime,
    closeTime: times.closeTime,
    isClosed: false,
  }));

  if (hours.length > 0) {
    // Используем транзакцию для атомарного удаления и вставки
    await prisma.$transaction(async (tx) => {
      // Удаляем старые часы
      await tx.workingHours.deleteMany({
        where: { restaurantId },
      });

      // Добавляем новые
      await tx.workingHours.createMany({
        data: hours.map(h => ({ ...h, restaurantId })),
      });
    });
  }
}

function formatTime(hour?: number, minute?: number): string {
  if (hour === undefined) return '00:00';
  const h = hour.toString().padStart(2, '0');
  const m = (minute || 0).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// GET - получить статус и стоимость
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const hasApiKey = !!GOOGLE_API_KEY;
  
  // Находим ресторан
  const restaurant = await prisma.restaurant.findFirst({
    where: {
      OR: [
        { slug: params.slug },
        { id: params.slug },
      ],
    },
    select: {
      id: true,
      name: true,
      lastSynced: true,
      source: true,
      sourceId: true,
    },
  });

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
  }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const canRefresh = !restaurant.lastSynced || restaurant.lastSynced < oneDayAgo;

  return NextResponse.json({
    available: hasApiKey,
    canRefresh,
    lastSynced: restaurant.lastSynced,
    cooldownEnds: restaurant.lastSynced 
      ? new Date(restaurant.lastSynced.getTime() + 24 * 60 * 60 * 1000)
      : null,
    pricing: {
      basic: '$0.003 (рейтинг, контакты)',
      hours: '$0.005 (время работы)',
      photos: '$0.007 (фотографии)',
      full: '$0.017 (всё вместе)',
      freeMonthly: '$200 (~11,700 базовых запросов)',
    },
    setupRequired: !hasApiKey 
      ? 'Добавьте GOOGLE_PLACES_API_KEY в Vercel Environment Variables. В Google Cloud Console уберите ограничение "HTTP referrers" для ключа.' 
      : null,
  });
}

