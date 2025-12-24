import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/brands - Получение списка брендов/сетей с количеством заведений
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    
    // Получаем статистику по брендам
    const brandStats = await prisma.restaurant.groupBy({
      by: ['brand'],
      where: {
        isActive: true,
        isArchived: false,
        brand: { not: null },
        ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
      },
      _count: true,
      _avg: { rating: true },
      orderBy: { _count: { brand: 'desc' } },
    });
    
    // Получаем детали по каждому бренду
    const brands = await Promise.all(
      brandStats.map(async (stat) => {
        if (!stat.brand) return null;
        
        // Получаем первое заведение для превью
        const firstRestaurant = await prisma.restaurant.findFirst({
          where: { brand: stat.brand, isActive: true, isArchived: false },
          select: {
            id: true,
            name: true,
            images: true,
            cuisine: true,
          },
        });
        
        // Получаем список городов для этого бренда
        const cities = await prisma.restaurant.groupBy({
          by: ['city'],
          where: { brand: stat.brand, isActive: true, isArchived: false },
          _count: true,
        });
        
        return {
          brand: stat.brand,
          count: stat._count,
          avgRating: stat._avg.rating ? Math.round(stat._avg.rating * 10) / 10 : null,
          image: firstRestaurant?.images?.[0] || null,
          cuisine: firstRestaurant?.cuisine || [],
          cities: cities.map(c => ({ city: c.city, count: c._count })),
        };
      })
    );
    
    return NextResponse.json({
      brands: brands.filter(Boolean),
      total: brandStats.length,
    });
  } catch (error) {
    console.error('Error fetching brands:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brands' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/brands/[brand] - Получение всех заведений бренда
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brand, city, page = 1, limit = 20 } = body;
    
    if (!brand) {
      return NextResponse.json(
        { error: 'Brand is required' },
        { status: 400 }
      );
    }
    
    const where: any = {
      brand,
      isActive: true,
      isArchived: false,
    };
    
    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }
    
    const [restaurants, total] = await Promise.all([
      prisma.restaurant.findMany({
        where,
        include: {
          reviews: {
            take: 3,
            orderBy: { date: 'desc' },
          },
        },
        orderBy: [
          { rating: 'desc' },
          { ratingCount: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.restaurant.count({ where }),
    ]);
    
    return NextResponse.json({
      brand,
      restaurants,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching brand restaurants:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brand restaurants' },
      { status: 500 }
    );
  }
}

