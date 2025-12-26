import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/locations - Получить уникальные страны, регионы, города и районы
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

    // Получаем уникальные регионы
    const regions = await prisma.restaurant.groupBy({
      by: ['region'],
      _count: { region: true },
      orderBy: { _count: { region: 'desc' } },
      where: { region: { not: null } },
    });

    // Получаем уникальные районы
    const districts = await prisma.restaurant.groupBy({
      by: ['district'],
      _count: { district: true },
      orderBy: { _count: { district: 'desc' } },
      where: { district: { not: null } },
    });

    return NextResponse.json({
      cities: cities.map(c => ({ name: c.city, count: c._count.city })),
      countries: countries.map(c => ({ name: c.country, count: c._count.country })),
      regions: regions.map(r => ({ name: r.region, count: r._count.region })),
      districts: districts.map(d => ({ name: d.district, count: d._count.district })),
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
  }
}

