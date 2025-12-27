import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * API для заказов текущего пользователя
 * GET /api/orders/my - все заказы пользователя
 * GET /api/orders/my?active=true - только активные заказы
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ orders: [] });
    }
    
    const userId = (session.user as any).id;
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';
    
    const where: any = { userId };
    
    if (activeOnly) {
      // Активные статусы - все кроме delivered, cancelled, completed
      where.status = {
        in: ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way'],
      };
    }
    
    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: activeOnly ? 10 : 50,
    });
    
    // Получаем названия ресторанов
    const restaurantIds = [...new Set(orders.map(o => o.restaurantId))];
    const restaurants = await prisma.restaurant.findMany({
      where: { id: { in: restaurantIds } },
      select: { id: true, name: true, slug: true, images: true },
    });
    const restaurantMap = Object.fromEntries(restaurants.map(r => [r.id, r]));
    
    const ordersWithRestaurant = orders.map(order => ({
      ...order,
      restaurant: restaurantMap[order.restaurantId] || null,
    }));
    
    return NextResponse.json({
      orders: ordersWithRestaurant,
      hasActive: orders.some(o => 
        ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way'].includes(o.status)
      ),
    });
    
  } catch (error) {
    console.error('Error fetching user orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

