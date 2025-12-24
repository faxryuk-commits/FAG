import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - получить меню ресторана
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const menuItems = await prisma.menuItem.findMany({
      where: { restaurantId: params.id },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });

    // Группируем по категориям
    const grouped = menuItems.reduce((acc: Record<string, typeof menuItems>, item) => {
      const category = item.category || 'Другое';
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    }, {});

    return NextResponse.json({
      items: menuItems,
      grouped,
      total: menuItems.length
    });
  } catch (error) {
    console.error('Error fetching menu:', error);
    return NextResponse.json({ error: 'Failed to fetch menu' }, { status: 500 });
  }
}

// POST - добавить позицию в меню
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, description, price, category, image } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const menuItem = await prisma.menuItem.create({
      data: {
        restaurantId: params.id,
        name,
        description,
        price: price ? parseFloat(price) : null,
        category,
        image
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Позиция добавлена',
      item: menuItem
    });
  } catch (error) {
    console.error('Error creating menu item:', error);
    return NextResponse.json({ error: 'Failed to create menu item' }, { status: 500 });
  }
}

// PUT - массовое обновление меню
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { items } = body;

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Items array required' }, { status: 400 });
    }

    // Удаляем старое меню
    await prisma.menuItem.deleteMany({
      where: { restaurantId: params.id }
    });

    // Создаём новое
    if (items.length > 0) {
      await prisma.menuItem.createMany({
        data: items.map((item: any) => ({
          restaurantId: params.id,
          name: item.name,
          description: item.description || null,
          price: item.price ? parseFloat(item.price) : null,
          category: item.category || null,
          image: item.image || null
        }))
      });
    }

    return NextResponse.json({
      success: true,
      message: `Меню обновлено (${items.length} позиций)`
    });
  } catch (error) {
    console.error('Error updating menu:', error);
    return NextResponse.json({ error: 'Failed to update menu' }, { status: 500 });
  }
}

// DELETE - удалить позицию меню
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');

    if (itemId) {
      // Удаляем конкретную позицию
      await prisma.menuItem.delete({
        where: { id: itemId }
      });
      return NextResponse.json({
        success: true,
        message: 'Позиция удалена'
      });
    } else {
      // Удаляем всё меню
      const result = await prisma.menuItem.deleteMany({
        where: { restaurantId: params.id }
      });
      return NextResponse.json({
        success: true,
        message: `Удалено ${result.count} позиций`
      });
    }
  } catch (error) {
    console.error('Error deleting menu:', error);
    return NextResponse.json({ error: 'Failed to delete menu' }, { status: 500 });
  }
}

