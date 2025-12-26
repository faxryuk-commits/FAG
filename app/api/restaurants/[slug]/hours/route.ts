import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Helper: найти ресторан по slug или id
async function findRestaurant(slugOrId: string) {
  let restaurant = await prisma.restaurant.findUnique({
    where: { slug: slugOrId },
  });

  if (!restaurant) {
    restaurant = await prisma.restaurant.findUnique({
      where: { id: slugOrId },
    });
  }

  return restaurant;
}

// GET - получить время работы
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const restaurant = await findRestaurant(params.slug);

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    const hours = await prisma.workingHours.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { dayOfWeek: 'asc' },
    });

    return NextResponse.json({ hours });
  } catch (error) {
    console.error('Error fetching working hours:', error);
    return NextResponse.json({ error: 'Failed to fetch working hours' }, { status: 500 });
  }
}

// PUT - обновить время работы
export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const restaurant = await findRestaurant(params.slug);

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    const body = await request.json();
    const { hours } = body;

    if (!Array.isArray(hours)) {
      return NextResponse.json({ error: 'Invalid hours data' }, { status: 400 });
    }

    // Удаляем старые записи
    await prisma.workingHours.deleteMany({
      where: { restaurantId: restaurant.id },
    });

    // Создаём новые
    if (hours.length > 0) {
      await prisma.workingHours.createMany({
        data: hours.map((h: any) => ({
          restaurantId: restaurant.id,
          dayOfWeek: h.dayOfWeek,
          openTime: h.openTime || '09:00',
          closeTime: h.closeTime || '22:00',
          isClosed: h.isClosed || false,
        })),
      });
    }

    // Обновляем lastSynced ресторана
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating working hours:', error);
    return NextResponse.json({ error: 'Failed to update working hours' }, { status: 500 });
  }
}

