import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - получить детали ресторана
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: params.id },
      include: {
        workingHours: true,
        reviews: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    return NextResponse.json({ restaurant });
  } catch (error) {
    console.error('Error fetching restaurant:', error);
    return NextResponse.json({ error: 'Failed to fetch restaurant' }, { status: 500 });
  }
}

// PUT - обновить ресторан
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      address,
      city,
      phone,
      website,
      email,
      priceRange,
      cuisine,
      images,
      menuUrl,
      menuItems, // Новое поле для товаров меню
      workingHours,
      isActive,
      isVerified
    } = body;

    // Обновляем основные данные
    const updateData: any = {};
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (phone !== undefined) updateData.phone = phone;
    if (website !== undefined) updateData.website = website;
    if (email !== undefined) updateData.email = email;
    if (priceRange !== undefined) updateData.priceRange = priceRange;
    if (cuisine !== undefined) updateData.cuisine = cuisine;
    if (images !== undefined) updateData.images = images;
    if (menuUrl !== undefined) updateData.menuUrl = menuUrl;
    if (menuItems !== undefined) updateData.menuItems = menuItems;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isVerified !== undefined) updateData.isVerified = isVerified;

    const restaurant = await prisma.restaurant.update({
      where: { id: params.id },
      data: updateData
    });

    // Обновляем время работы если передано
    if (workingHours && Array.isArray(workingHours)) {
      // Удаляем старые записи
      await prisma.workingHours.deleteMany({
        where: { restaurantId: params.id }
      });

      // Создаем новые
      if (workingHours.length > 0) {
        await prisma.workingHours.createMany({
          data: workingHours.map((wh: any) => ({
            restaurantId: params.id,
            dayOfWeek: wh.dayOfWeek,
            openTime: wh.openTime,
            closeTime: wh.closeTime
          }))
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Ресторан обновлён',
      restaurant
    });
  } catch (error) {
    console.error('Error updating restaurant:', error);
    return NextResponse.json({ error: 'Failed to update restaurant' }, { status: 500 });
  }
}

// DELETE - удалить ресторан
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Удаляем связанные данные
    await prisma.workingHours.deleteMany({ where: { restaurantId: params.id } });
    await prisma.review.deleteMany({ where: { restaurantId: params.id } });
    
    // Удаляем ресторан
    await prisma.restaurant.delete({ where: { id: params.id } });

    return NextResponse.json({
      success: true,
      message: 'Ресторан удалён'
    });
  } catch (error) {
    console.error('Error deleting restaurant:', error);
    return NextResponse.json({ error: 'Failed to delete restaurant' }, { status: 500 });
  }
}

