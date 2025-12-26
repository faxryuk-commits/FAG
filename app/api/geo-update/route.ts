import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseGeoFromAddress, normalizeCity } from '@/lib/geo-parser';

// POST /api/geo-update - Обновить географические данные для всех ресторанов
export async function POST() {
  try {
    // Получаем все рестораны без географических данных
    const restaurants = await prisma.restaurant.findMany({
      where: {
        OR: [
          { country: null },
          { region: null },
          { district: null },
        ],
      },
      select: {
        id: true,
        address: true,
        city: true,
        country: true,
        region: true,
        district: true,
      },
    });

    let updated = 0;
    let errors = 0;

    for (const restaurant of restaurants) {
      try {
        const geoData = parseGeoFromAddress(restaurant.address || '', restaurant.city || '');
        const normalizedCity = restaurant.city ? normalizeCity(restaurant.city) : null;
        
        const updateData: any = {};
        
        if (!restaurant.country && geoData.country) {
          updateData.country = geoData.country;
        }
        if (!restaurant.region && geoData.region) {
          updateData.region = geoData.region;
        }
        if (!restaurant.district && geoData.district) {
          updateData.district = geoData.district;
        }
        if (normalizedCity && restaurant.city !== normalizedCity) {
          updateData.city = normalizedCity;
        }
        
        if (Object.keys(updateData).length > 0) {
          await prisma.restaurant.update({
            where: { id: restaurant.id },
            data: updateData,
          });
          updated++;
        }
      } catch (e) {
        errors++;
        console.error(`Error updating geo for ${restaurant.id}:`, e);
      }
    }

    return NextResponse.json({
      success: true,
      total: restaurants.length,
      updated,
      errors,
      message: `Обновлено ${updated} из ${restaurants.length} записей`,
    });
  } catch (error) {
    console.error('Error updating geo data:', error);
    return NextResponse.json({ error: 'Failed to update geo data' }, { status: 500 });
  }
}

// GET /api/geo-update - Получить статистику по географии
export async function GET() {
  try {
    const total = await prisma.restaurant.count();
    const withCountry = await prisma.restaurant.count({ where: { country: { not: null } } });
    const withRegion = await prisma.restaurant.count({ where: { region: { not: null } } });
    const withDistrict = await prisma.restaurant.count({ where: { district: { not: null } } });
    const withoutGeo = await prisma.restaurant.count({
      where: {
        AND: [
          { country: null },
          { region: null },
          { district: null },
        ],
      },
    });

    return NextResponse.json({
      total,
      withCountry,
      withRegion,
      withDistrict,
      withoutGeo,
      coverage: {
        country: Math.round((withCountry / total) * 100),
        region: Math.round((withRegion / total) * 100),
        district: Math.round((withDistrict / total) * 100),
      },
    });
  } catch (error) {
    console.error('Error fetching geo stats:', error);
    return NextResponse.json({ error: 'Failed to fetch geo stats' }, { status: 500 });
  }
}

