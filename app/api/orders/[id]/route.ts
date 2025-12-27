import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * API для конкретного заказа
 * GET /api/orders/[id] - получить заказ
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        items: true,
      },
    });
    
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    
    // Получаем ресторан
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: order.restaurantId },
      select: { id: true, name: true, slug: true, images: true, phone: true, address: true },
    });
    
    return NextResponse.json({
      order: {
        ...order,
        restaurant,
      },
    });
    
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

// PATCH - обновить статус заказа (для ресторана)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { status } = body;
    
    if (!status) {
      return NextResponse.json({ error: 'Status required' }, { status: 400 });
    }
    
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way', 'delivered', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    
    const updateData: any = { status };
    
    // Добавляем временные метки
    if (status === 'confirmed') {
      updateData.confirmedAt = new Date();
    } else if (status === 'delivered' || status === 'completed') {
      updateData.completedAt = new Date();
    }
    
    const order = await prisma.order.update({
      where: { id: params.id },
      data: updateData,
      include: { items: true },
    });
    
    return NextResponse.json({ success: true, order });
    
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}

