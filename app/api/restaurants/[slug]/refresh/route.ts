import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Точечное обновление данных заведения через Google Places API
 * 
 * Стоимость: ~$0.017 за запрос (vs $0.10-0.50 через Apify)
 * 
 * Обновляет:
 * - rating, ratingCount
 * - phone, website
 * - openingHours
 * - photos (опционально)
 */

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Какие поля обновлять
const FIELD_MASKS = {
  basic: 'displayName,rating,userRatingCount,currentOpeningHours,nationalPhoneNumber,websiteUri',
  photos: 'photos',
  reviews: 'reviews',
  full: 'displayName,rating,userRatingCount,currentOpeningHours,nationalPhoneNumber,websiteUri,photos,reviews,priceLevel',
};

interface RefreshOptions {
  fields?: 'basic' | 'photos' | 'reviews' | 'full';
  force?: boolean;
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
    const fieldMask = FIELD_MASKS[body.fields || 'basic'];
    const placeData = await fetchPlaceDetails(placeId, fieldMask);

    if (!placeData) {
      return NextResponse.json({
        error: 'Failed to fetch place details',
      }, { status: 502 });
    }

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
      cost: '~$0.017', // Примерная стоимость запроса
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
    const url = new URL('https://places.googleapis.com/v1/places:searchText');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY!,
        'X-Goog-FieldMask': 'places.id',
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
      },
    });

    if (!response.ok) {
      console.error('Google API error:', await response.text());
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

  const hours = periods.map(period => ({
    dayOfWeek: dayMap[period.open?.day] ?? 0,
    openTime: formatTime(period.open?.hour, period.open?.minute),
    closeTime: formatTime(period.close?.hour, period.close?.minute),
    isClosed: false,
  })).filter(h => h.openTime !== '00:00' || h.closeTime !== '00:00');

  if (hours.length > 0) {
    // Удаляем старые часы
    await prisma.workingHours.deleteMany({
      where: { restaurantId },
    });

    // Добавляем новые
    await prisma.workingHours.createMany({
      data: hours.map(h => ({ ...h, restaurantId })),
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
      perRequest: '$0.017',
      note: 'Google Places API (New) - значительно дешевле чем Apify scraping',
    },
    setupRequired: !hasApiKey ? 'Добавьте GOOGLE_PLACES_API_KEY в Vercel Environment Variables' : null,
  });
}

