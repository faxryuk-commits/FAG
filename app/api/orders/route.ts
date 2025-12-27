import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * API для управления заказами
 * 
 * POST - создать заказ (доставка/самовывоз/бронь)
 * GET - получить заказы ресторана
 */

interface OrderItemInput {
  menuItemId?: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

interface CreateOrderInput {
  restaurantId: string;
  orderType: 'delivery' | 'pickup' | 'reservation';
  
  // Клиент
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  
  // Доставка
  deliveryAddress?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  deliveryNotes?: string;
  
  // Бронь
  reservationDate?: string;
  reservationTime?: string;
  guestsCount?: number;
  
  // Самовывоз
  pickupTime?: string;
  
  // Корзина
  items: OrderItemInput[];
  
  // Оплата
  paymentMethod?: string;
  
  // Отслеживание
  visitorId?: string;
  sessionId?: string;
}

// POST - создать заказ
export async function POST(request: NextRequest) {
  try {
    const body: CreateOrderInput = await request.json();
    
    // Валидация
    if (!body.restaurantId || !body.orderType || !body.customerName || !body.customerPhone) {
      return NextResponse.json({ error: 'Заполните обязательные поля' }, { status: 400 });
    }
    
    if (body.orderType === 'delivery' && !body.deliveryAddress) {
      return NextResponse.json({ error: 'Укажите адрес доставки' }, { status: 400 });
    }
    
    if (body.orderType === 'reservation' && (!body.reservationDate || !body.reservationTime)) {
      return NextResponse.json({ error: 'Укажите дату и время бронирования' }, { status: 400 });
    }
    
    if ((body.orderType === 'delivery' || body.orderType === 'pickup') && (!body.items || body.items.length === 0)) {
      return NextResponse.json({ error: 'Добавьте товары в корзину' }, { status: 400 });
    }
    
    // Проверяем ресторан
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: body.restaurantId },
      select: { id: true, name: true },
    });
    
    if (!restaurant) {
      return NextResponse.json({ error: 'Ресторан не найден' }, { status: 404 });
    }
    
    // Считаем суммы
    const subtotal = body.items?.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0;
    const deliveryFee = body.orderType === 'delivery' ? 15000 : 0; // 15,000 сум за доставку
    const total = subtotal + deliveryFee;
    
    // Генерируем номер заказа
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    const orderNumber = `${restaurant.name.substring(0, 3).toUpperCase()}-${timestamp.slice(-4)}${random}`;

    // Создаём заказ
    const order = await prisma.order.create({
      data: {
        restaurantId: body.restaurantId,
        orderNumber,
        orderType: body.orderType,
        status: 'pending',
        
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        customerEmail: body.customerEmail,
        
        deliveryAddress: body.deliveryAddress,
        deliveryLat: body.deliveryLat,
        deliveryLng: body.deliveryLng,
        deliveryNotes: body.deliveryNotes,
        
        reservationDate: body.reservationDate ? new Date(body.reservationDate) : null,
        reservationTime: body.reservationTime,
        guestsCount: body.guestsCount,
        
        pickupTime: body.pickupTime,
        
        subtotal,
        deliveryFee,
        total,
        
        paymentMethod: body.paymentMethod,
        
        visitorId: body.visitorId,
        sessionId: body.sessionId,
        
        items: {
          create: body.items?.map(item => ({
            menuItemId: item.menuItemId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            notes: item.notes,
          })) || [],
        },
      },
      include: {
        items: true,
      },
    });
    
    return NextResponse.json({
      success: true,
      message: getOrderMessage(body.orderType),
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        items: order.items,
        createdAt: order.createdAt,
      },
    });
    
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Не удалось создать заказ' }, { status: 500 });
  }
}

function getOrderMessage(orderType: string): string {
  switch (orderType) {
    case 'delivery':
      return '🚗 Заказ на доставку принят! Мы свяжемся с вами для подтверждения.';
    case 'pickup':
      return '🏃 Заказ на самовывоз принят! Приходите к указанному времени.';
    case 'reservation':
      return '📅 Бронирование принято! Ожидайте подтверждения.';
    default:
      return 'Заказ принят!';
  }
}

// GET - получить заказы (для ресторана/админки)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get('restaurantId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const where: any = {};
    
    if (restaurantId) {
      where.restaurantId = restaurantId;
    }
    
    if (status) {
      where.status = status;
    }
    
    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    
    return NextResponse.json({
      orders,
      total: orders.length,
    });
    
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Не удалось загрузить заказы' }, { status: 500 });
  }
}

