import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateMenuForRestaurant, detectCuisineType, CUISINE_TEMPLATES } from '@/lib/menu-templates';

/**
 * API для автоматической генерации меню ресторанам
 * 
 * GET - статистика по меню
 * POST - генерация меню для одного ресторана
 * PUT - массовая генерация для всех ресторанов без меню
 */

// GET - статистика
export async function GET(request: NextRequest) {
  try {
    // Подсчёт ресторанов без меню
    const [totalRestaurants, withMenu, withoutMenu] = await Promise.all([
      prisma.restaurant.count({ where: { isActive: true } }),
      prisma.restaurant.count({
        where: {
          isActive: true,
          menuItems: { some: {} },
        },
      }),
      prisma.restaurant.count({
        where: {
          isActive: true,
          menuItems: { none: {} },
        },
      }),
    ]);
    
    // Распределение по типам кухни
    const restaurants = await prisma.restaurant.findMany({
      where: { isActive: true },
      select: { name: true, cuisine: true },
    });
    
    const cuisineDistribution: Record<string, number> = {};
    restaurants.forEach(r => {
      const template = detectCuisineType(r.name, r.cuisine);
      const type = template?.name || 'Неизвестно';
      cuisineDistribution[type] = (cuisineDistribution[type] || 0) + 1;
    });
    
    return NextResponse.json({
      stats: {
        total: totalRestaurants,
        withMenu,
        withoutMenu,
        coverage: totalRestaurants > 0 ? Math.round((withMenu / totalRestaurants) * 100) : 0,
      },
      cuisineDistribution,
      templates: CUISINE_TEMPLATES.map(t => ({
        id: t.id,
        name: t.name,
        itemsCount: t.items.length,
        categories: t.categories,
      })),
    });
    
  } catch (error) {
    console.error('Error fetching menu stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

// POST - генерация для одного ресторана
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { restaurantId, templateId, priceMultiplier = 1, force = false } = body;
    
    if (!restaurantId) {
      return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
    }
    
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { menuItems: true },
    });
    
    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }
    
    // Проверяем есть ли уже меню
    if (restaurant.menuItems.length > 0 && !force) {
      return NextResponse.json({ 
        error: 'Restaurant already has menu', 
        menuCount: restaurant.menuItems.length,
        message: 'Use force=true to overwrite',
      }, { status: 400 });
    }
    
    // Определяем шаблон
    let template;
    if (templateId) {
      template = CUISINE_TEMPLATES.find(t => t.id === templateId);
    } else {
      template = detectCuisineType(restaurant.name, restaurant.cuisine);
    }
    
    if (!template) {
      return NextResponse.json({ error: 'No suitable template found' }, { status: 400 });
    }
    
    // Генерируем меню
    const menuItems = generateMenuForRestaurant(restaurant.name, restaurant.cuisine, priceMultiplier);
    
    // Удаляем старое меню если force
    if (force && restaurant.menuItems.length > 0) {
      await prisma.menuItem.deleteMany({
        where: { restaurantId: restaurant.id },
      });
    }
    
    // Создаём новое меню
    await prisma.menuItem.createMany({
      data: menuItems.map(item => ({
        restaurantId: restaurant.id,
        name: item.name,
        description: item.description || null,
        price: item.price,
        category: item.category,
      })),
    });
    
    return NextResponse.json({
      success: true,
      restaurant: restaurant.name,
      template: template.name,
      itemsCreated: menuItems.length,
      categories: [...new Set(menuItems.map(i => i.category))],
    });
    
  } catch (error) {
    console.error('Error generating menu:', error);
    return NextResponse.json({ error: 'Failed to generate menu' }, { status: 500 });
  }
}

// PUT - массовая генерация
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { limit = 100, priceMultiplier = 1, city, dryRun = false } = body;
    
    // Находим рестораны без меню
    const where: any = {
      isActive: true,
      menuItems: { none: {} },
    };
    
    if (city) {
      where.city = city;
    }
    
    const restaurants = await prisma.restaurant.findMany({
      where,
      select: { id: true, name: true, cuisine: true, priceRange: true },
      take: limit,
    });
    
    if (dryRun) {
      // Показываем что будет сгенерировано
      const preview = restaurants.slice(0, 10).map(r => {
        const template = detectCuisineType(r.name, r.cuisine);
        return {
          name: r.name,
          template: template?.name || 'Узбекская кухня',
          itemsCount: template?.items.length || 0,
        };
      });
      
      return NextResponse.json({
        dryRun: true,
        restaurantsFound: restaurants.length,
        preview,
      });
    }
    
    // Генерируем меню
    let generated = 0;
    let errors = 0;
    
    for (const restaurant of restaurants) {
      try {
        // Определяем множитель цены по priceRange
        let priceMult = priceMultiplier;
        if (restaurant.priceRange) {
          if (restaurant.priceRange.includes('$$$$')) priceMult *= 2;
          else if (restaurant.priceRange.includes('$$$')) priceMult *= 1.5;
          else if (restaurant.priceRange === '$') priceMult *= 0.7;
        }
        
        const menuItems = generateMenuForRestaurant(restaurant.name, restaurant.cuisine, priceMult);
        
        if (menuItems.length > 0) {
          await prisma.menuItem.createMany({
            data: menuItems.map(item => ({
              restaurantId: restaurant.id,
              name: item.name,
              description: item.description || null,
              price: item.price,
              category: item.category,
            })),
          });
          generated++;
        }
      } catch (error) {
        errors++;
        console.error(`Error generating menu for ${restaurant.name}:`, error);
      }
    }
    
    return NextResponse.json({
      success: true,
      processed: restaurants.length,
      generated,
      errors,
      message: `Меню сгенерировано для ${generated} ресторанов`,
    });
    
  } catch (error) {
    console.error('Error in bulk menu generation:', error);
    return NextResponse.json({ error: 'Failed to generate menus' }, { status: 500 });
  }
}

