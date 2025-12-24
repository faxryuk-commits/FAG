import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Helper: найти ресторан по slug или id
async function findRestaurant(slugOrId: string) {
  // Сначала пробуем по slug
  let restaurant = await prisma.restaurant.findUnique({
    where: { slug: slugOrId },
    include: {
      workingHours: true,
      menuItems: { orderBy: { category: 'asc' } },
      reviews: { orderBy: { date: 'desc' }, take: 50 },
    },
  });

  // Если не нашли, пробуем по id
  if (!restaurant) {
    restaurant = await prisma.restaurant.findUnique({
      where: { id: slugOrId },
      include: {
        workingHours: true,
        menuItems: { orderBy: { category: 'asc' } },
        reviews: { orderBy: { date: 'desc' }, take: 50 },
      },
    });
  }

  return restaurant;
}

// GET - получить ресторан по slug или id
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const restaurant = await findRestaurant(params.slug);

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
  { params }: { params: { slug: string } }
) {
  try {
    const restaurant = await findRestaurant(params.slug);

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

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
      workingHours,
      isActive,
      isVerified,
      isArchived,
      brand
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
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isVerified !== undefined) updateData.isVerified = isVerified;
    if (isArchived !== undefined) updateData.isArchived = isArchived;
    if (brand !== undefined) updateData.brand = brand;

    const updated = await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: updateData
    });

    // Обновляем время работы если передано
    if (workingHours && Array.isArray(workingHours)) {
      await prisma.workingHours.deleteMany({
        where: { restaurantId: restaurant.id }
      });

      if (workingHours.length > 0) {
        await prisma.workingHours.createMany({
          data: workingHours.map((wh: any) => ({
            restaurantId: restaurant.id,
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
      restaurant: updated
    });
  } catch (error) {
    console.error('Error updating restaurant:', error);
    return NextResponse.json({ error: 'Failed to update restaurant' }, { status: 500 });
  }
}

// DELETE - удалить ресторан
export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const restaurant = await findRestaurant(params.slug);

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    // Удаляем связанные данные
    await prisma.workingHours.deleteMany({ where: { restaurantId: restaurant.id } });
    await prisma.menuItem.deleteMany({ where: { restaurantId: restaurant.id } });
    await prisma.review.deleteMany({ where: { restaurantId: restaurant.id } });

    // Удаляем ресторан
    await prisma.restaurant.delete({ where: { id: restaurant.id } });

    return NextResponse.json({
      success: true,
      message: 'Ресторан удалён'
    });
  } catch (error) {
    console.error('Error deleting restaurant:', error);
    return NextResponse.json({ error: 'Failed to delete restaurant' }, { status: 500 });
  }
}
