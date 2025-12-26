import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/locations - Получить уникальные страны и города
export async function GET() {
  try {
    // Получаем уникальные города
    const cities = await prisma.restaurant.groupBy({
      by: ['city'],
      _count: { city: true },
      orderBy: { _count: { city: 'desc' } },
      where: { city: { not: '' } },
    });

    // Получаем уникальные страны
    const countries = await prisma.restaurant.groupBy({
      by: ['country'],
      _count: { country: true },
      orderBy: { _count: { country: 'desc' } },
      where: { country: { not: null } },
    });

    return NextResponse.json({
      cities: cities.map(c => ({ name: c.city, count: c._count.city })),
      countries: countries.map(c => ({ name: c.country, count: c._count.country })),
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
  }
}

