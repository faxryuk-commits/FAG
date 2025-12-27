import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - список мерчантов
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get('restaurantId');

    // Если указан ресторан - получаем его мерчантов
    if (restaurantId) {
      const merchants = await prisma.merchantRestaurant.findMany({
        where: { restaurantId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      });

      return NextResponse.json({ merchants });
    }

    // Иначе - все пользователи с ролью merchant
    const merchants = await prisma.user.findMany({
      where: { role: 'merchant' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        merchantRestaurants: {
          include: {
            // Получаем название ресторана через отдельный запрос
          },
        },
      },
    });

    return NextResponse.json({ merchants });
  } catch (error) {
    console.error('Error fetching merchants:', error);
    return NextResponse.json({ error: 'Failed to fetch merchants' }, { status: 500 });
  }
}

// POST - привязать мерчанта к ресторану
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, restaurantId, role = 'owner' } = body;

    if (!userId || !restaurantId) {
      return NextResponse.json({ error: 'userId and restaurantId required' }, { status: 400 });
    }

    // Проверяем существование пользователя и ресторана
    const [user, restaurant] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.restaurant.findUnique({ where: { id: restaurantId } }),
    ]);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    // Обновляем роль пользователя на merchant если customer
    if (user.role === 'customer') {
      await prisma.user.update({
        where: { id: userId },
        data: { role: 'merchant' },
      });
    }

    // Создаём или обновляем привязку
    const merchantRestaurant = await prisma.merchantRestaurant.upsert({
      where: {
        userId_restaurantId: { userId, restaurantId },
      },
      create: {
        userId,
        restaurantId,
        role,
        isActive: true,
      },
      update: {
        role,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, merchantRestaurant });
  } catch (error) {
    console.error('Error assigning merchant:', error);
    return NextResponse.json({ error: 'Failed to assign merchant' }, { status: 500 });
  }
}

// DELETE - отвязать мерчанта от ресторана
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const restaurantId = searchParams.get('restaurantId');

    if (!userId || !restaurantId) {
      return NextResponse.json({ error: 'userId and restaurantId required' }, { status: 400 });
    }

    await prisma.merchantRestaurant.delete({
      where: {
        userId_restaurantId: { userId, restaurantId },
      },
    });

    // Проверяем, остались ли у пользователя рестораны
    const remaining = await prisma.merchantRestaurant.count({
      where: { userId, isActive: true },
    });

    // Если нет - возвращаем роль customer
    if (remaining === 0) {
      await prisma.user.update({
        where: { id: userId },
        data: { role: 'customer' },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing merchant:', error);
    return NextResponse.json({ error: 'Failed to remove merchant' }, { status: 500 });
  }
}

