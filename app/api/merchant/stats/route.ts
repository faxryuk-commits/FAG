import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, checkMerchantAccess } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get('restaurantId');

    if (!restaurantId) {
      return NextResponse.json({ error: 'Restaurant ID required' }, { status: 400 });
    }

    // Проверяем доступ
    if (userRole !== 'admin') {
      const hasAccess = await checkMerchantAccess(userId, restaurantId);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Начало текущего дня
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Статистика по статусам заказов
    const [pending, confirmed, preparing, ready, total] = await Promise.all([
      prisma.order.count({ where: { restaurantId, status: 'pending' } }),
      prisma.order.count({ where: { restaurantId, status: 'confirmed' } }),
      prisma.order.count({ where: { restaurantId, status: 'preparing' } }),
      prisma.order.count({ where: { restaurantId, status: 'ready' } }),
      prisma.order.count({ where: { restaurantId } }),
    ]);

    // Выручка за сегодня
    const todayOrders = await prisma.order.findMany({
      where: {
        restaurantId,
        createdAt: { gte: today },
        status: { not: 'cancelled' },
      },
      select: { total: true },
    });
    
    const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0);

    return NextResponse.json({
      stats: {
        pending,
        confirmed,
        preparing,
        ready,
        total,
        todayRevenue,
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

