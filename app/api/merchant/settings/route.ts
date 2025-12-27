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

    // Получаем настройки или возвращаем дефолтные
    let settings = await prisma.restaurantSettings.findUnique({
      where: { restaurantId },
    });

    if (!settings) {
      // Дефолтные настройки
      settings = {
        id: '',
        restaurantId,
        deliveryEnabled: true,
        deliveryRadius: null,
        deliveryMinOrder: null,
        deliveryFee: null,
        deliveryTime: null,
        pickupEnabled: true,
        pickupDiscount: null,
        reservationEnabled: true,
        reservationDeposit: null,
        tablesCount: null,
        cashEnabled: true,
        cardEnabled: true,
        onlineEnabled: false,
        orderNotifyPhone: null,
        orderNotifyEmail: null,
        orderNotifyTelegram: null,
        autoConfirmOrders: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    const { restaurantId, settings } = await request.json();

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

    // Upsert настроек
    const updatedSettings = await prisma.restaurantSettings.upsert({
      where: { restaurantId },
      create: {
        restaurantId,
        ...settings,
        deliveryMinOrder: settings.deliveryMinOrder ? parseFloat(settings.deliveryMinOrder) : null,
        deliveryFee: settings.deliveryFee ? parseFloat(settings.deliveryFee) : null,
      },
      update: {
        ...settings,
        deliveryMinOrder: settings.deliveryMinOrder ? parseFloat(settings.deliveryMinOrder) : null,
        deliveryFee: settings.deliveryFee ? parseFloat(settings.deliveryFee) : null,
      },
    });

    return NextResponse.json({ success: true, settings: updatedSettings });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

