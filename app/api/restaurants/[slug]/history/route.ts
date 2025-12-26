import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - получить историю изменений ресторана
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    // Находим ресторан по slug или id
    const restaurant = await prisma.restaurant.findFirst({
      where: {
        OR: [
          { slug: params.slug },
          { id: params.slug },
        ],
      },
      select: { id: true },
    });

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    // Получаем историю изменений
    const logs = await prisma.changeLog.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: 'desc' },
      take: 50, // Последние 50 записей
    });

    return NextResponse.json({ logs });
  } catch (error: any) {
    // Если таблица не существует, возвращаем пустой массив
    if (error?.code === 'P2021') {
      return NextResponse.json({ logs: [] });
    }
    
    console.error('Error fetching change history:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}

// POST - добавить запись в историю (для ручных изменений)
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const restaurant = await prisma.restaurant.findFirst({
      where: {
        OR: [
          { slug: params.slug },
          { id: params.slug },
        ],
      },
      select: { id: true },
    });

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    const body = await request.json();

    const log = await prisma.changeLog.create({
      data: {
        restaurantId: restaurant.id,
        action: body.action || 'manual_edit',
        source: body.source || 'manual',
        requestType: body.requestType || null,
        requestData: body.requestData || null,
        responseData: body.responseData || null,
        success: body.success ?? true,
        errorMessage: body.errorMessage || null,
        cost: body.cost || null,
        changedFields: body.changedFields || [],
      },
    });

    return NextResponse.json({ log });
  } catch (error: any) {
    // Если таблица не существует, пропускаем
    if (error?.code === 'P2021') {
      return NextResponse.json({ log: null, message: 'Table not exists' });
    }
    
    console.error('Error creating change log:', error);
    return NextResponse.json({ error: 'Failed to create log' }, { status: 500 });
  }
}

