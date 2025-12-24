import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Вычисляет расстояние между двумя точками (формула Haversine)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * GET /api/restaurants - Получение списка ресторанов
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const city = searchParams.get('city');
    const search = searchParams.get('search');
    const cuisine = searchParams.get('cuisine');
    const minRating = searchParams.get('minRating');
    const priceRange = searchParams.get('priceRange');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    // Геолокация
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const sortBy = searchParams.get('sortBy');
    const maxDistance = parseFloat(searchParams.get('maxDistance') || '50'); // км
    
    const where: any = {
      isActive: true,
    };
    
    // Условия AND
    const andConditions: any[] = [];
    
    // Город
    if (city) {
      andConditions.push({ city: { contains: city, mode: 'insensitive' } });
    }
    
    // Поиск по названию или адресу
    if (search) {
      andConditions.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    
    // Фильтр по кухне - ищем частичное совпадение
    // hasSome ищет точное совпадение, для частичного нужен raw query или фильтр на клиенте
    if (cuisine) {
      // Для Prisma с массивами используем hasSome с разными вариантами
      const cuisineVariants = [
        cuisine,
        cuisine.charAt(0).toUpperCase() + cuisine.slice(1), // С большой буквы
        cuisine.toLowerCase(),
        cuisine.toUpperCase(),
      ];
      andConditions.push({ cuisine: { hasSome: cuisineVariants } });
    }
    
    // Фильтр по рейтингу
    if (minRating) {
      andConditions.push({ rating: { gte: parseFloat(minRating) } });
    }
    
    // Фильтр по бюджету (цене)
    if (priceRange) {
      andConditions.push({
        OR: [
          { priceRange: priceRange },
          { priceRange: { startsWith: priceRange } },
        ],
      });
    }
    
    // Собираем все условия
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }
    
    // Если есть координаты - фильтруем по области (примерно)
    // 1 градус широты ≈ 111 км
    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      const latDelta = maxDistance / 111;
      const lngDelta = maxDistance / (111 * Math.cos(userLat * Math.PI / 180));
      
      where.latitude = { gte: userLat - latDelta, lte: userLat + latDelta };
      where.longitude = { gte: userLng - lngDelta, lte: userLng + lngDelta };
    }
    
    let restaurants = await prisma.restaurant.findMany({
      where,
      orderBy: sortBy === 'distance' ? undefined : { rating: 'desc' },
      skip: sortBy === 'distance' ? 0 : (page - 1) * limit,
      take: sortBy === 'distance' ? 500 : limit, // Для сортировки по расстоянию берём больше
      include: {
        reviews: {
          take: 3,
          orderBy: { date: 'desc' },
        },
        workingHours: true,
      },
    });
    
    // Если сортируем по расстоянию - вычисляем и сортируем
    if (sortBy === 'distance' && lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      
      restaurants = restaurants
        .map(r => ({
          ...r,
          distance: calculateDistance(userLat, userLng, r.latitude, r.longitude),
        }))
        .filter(r => r.distance <= maxDistance)
        .sort((a, b) => a.distance - b.distance)
        .slice((page - 1) * limit, page * limit);
    }
    
    const total = await prisma.restaurant.count({ where });
    
    return NextResponse.json({
      restaurants,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    return NextResponse.json(
      { error: 'Failed to fetch restaurants' },
      { status: 500 }
    );
  }
}

