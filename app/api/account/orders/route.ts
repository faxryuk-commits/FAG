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

    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Получаем названия ресторанов
    const restaurantIds = [...new Set(orders.map((o) => o.restaurantId))];
    const restaurants = await prisma.restaurant.findMany({
      where: { id: { in: restaurantIds } },
      select: { id: true, name: true, slug: true },
    });
    const restaurantMap = Object.fromEntries(restaurants.map((r) => [r.id, r]));

    const ordersWithRestaurants = orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      restaurantId: order.restaurantId,
      restaurantName: restaurantMap[order.restaurantId]?.name || 'Ресторан',
      restaurantSlug: restaurantMap[order.restaurantId]?.slug,
      status: order.status,
      orderType: order.orderType,
      total: order.total,
      createdAt: order.createdAt.toISOString(),
    }));

    return NextResponse.json({ orders: ordersWithRestaurants });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

