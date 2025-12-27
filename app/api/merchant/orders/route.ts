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

    const orders = await prisma.order.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        items: true,
      },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    const { orderId, status } = await request.json();

    if (!orderId || !status) {
      return NextResponse.json({ error: 'Order ID and status required' }, { status: 400 });
    }

    // Находим заказ
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Проверяем доступ
    if (userRole !== 'admin') {
      const hasAccess = await checkMerchantAccess(userId, order.restaurantId);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Обновляем статус
    const updateData: any = { status };
    
    if (status === 'confirmed') {
      updateData.confirmedAt = new Date();
    } else if (status === 'delivered') {
      updateData.completedAt = new Date();
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });

    // TODO: Отправить уведомление клиенту

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}

