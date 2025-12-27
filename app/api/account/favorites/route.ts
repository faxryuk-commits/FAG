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

    const favorites = await prisma.userFavorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Получаем данные ресторанов
    const restaurantIds = favorites.map((f) => f.restaurantId);
    const restaurants = await prisma.restaurant.findMany({
      where: { id: { in: restaurantIds } },
      select: {
        id: true,
        name: true,
        slug: true,
        address: true,
        rating: true,
        images: true,
        cuisine: true,
      },
    });
    const restaurantMap = Object.fromEntries(restaurants.map((r) => [r.id, r]));

    const favoritesWithRestaurants = favorites.map((fav) => ({
      id: fav.id,
      restaurantId: fav.restaurantId,
      restaurant: restaurantMap[fav.restaurantId],
      createdAt: fav.createdAt.toISOString(),
    }));

    return NextResponse.json({ favorites: favoritesWithRestaurants });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { restaurantId } = await request.json();

    if (!restaurantId) {
      return NextResponse.json({ error: 'Restaurant ID required' }, { status: 400 });
    }

    // Проверяем, есть ли уже в избранном
    const existing = await prisma.userFavorite.findUnique({
      where: { userId_restaurantId: { userId, restaurantId } },
    });

    if (existing) {
      // Удаляем из избранного
      await prisma.userFavorite.delete({
        where: { id: existing.id },
      });
      return NextResponse.json({ success: true, action: 'removed' });
    }

    // Добавляем в избранное
    await prisma.userFavorite.create({
      data: { userId, restaurantId },
    });

    return NextResponse.json({ success: true, action: 'added' });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    return NextResponse.json({ error: 'Failed to toggle favorite' }, { status: 500 });
  }
}

