import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;

    // Для админов - возвращаем все рестораны
    if (userRole === 'admin') {
      const restaurants = await prisma.restaurant.findMany({
        take: 100,
        select: {
          id: true,
          name: true,
          slug: true,
          address: true,
          rating: true,
          images: true,
          isActive: true,
        },
      });

      return NextResponse.json({
        restaurants: restaurants.map((r) => ({
          id: `admin-${r.id}`,
          restaurantId: r.id,
          restaurant: r,
          role: 'admin',
        })),
      });
    }

    // Для мерчантов - возвращаем привязанные рестораны
    const merchantRestaurants = await prisma.merchantRestaurant.findMany({
      where: { userId, isActive: true },
    });

    if (merchantRestaurants.length === 0) {
      return NextResponse.json({ restaurants: [] });
    }

    const restaurantIds = merchantRestaurants.map((mr) => mr.restaurantId);
    const restaurants = await prisma.restaurant.findMany({
      where: { id: { in: restaurantIds } },
      select: {
        id: true,
        name: true,
        slug: true,
        address: true,
        rating: true,
        images: true,
        isActive: true,
      },
    });

    const restaurantMap = Object.fromEntries(restaurants.map((r) => [r.id, r]));

    const result = merchantRestaurants.map((mr) => ({
      id: mr.id,
      restaurantId: mr.restaurantId,
      restaurant: restaurantMap[mr.restaurantId],
      role: mr.role,
    }));

    return NextResponse.json({ restaurants: result });
  } catch (error) {
    console.error('Error fetching merchant restaurants:', error);
    return NextResponse.json({ error: 'Failed to fetch restaurants' }, { status: 500 });
  }
}

