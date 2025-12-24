import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    const where: any = {
      isActive: true,
    };
    
    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (cuisine) {
      where.cuisine = { has: cuisine };
    }
    
    if (minRating) {
      where.rating = { gte: parseFloat(minRating) };
    }
    
    const [restaurants, total] = await Promise.all([
      prisma.restaurant.findMany({
        where,
        orderBy: { rating: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          reviews: {
            take: 3,
            orderBy: { date: 'desc' },
          },
        },
      }),
      prisma.restaurant.count({ where }),
    ]);
    
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

