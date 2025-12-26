import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * API для получения аналитики ресторана
 * 
 * Уникальные ценности (которых нет у конкурентов):
 * 1. Воронка конверсии с процентами
 * 2. Сравнение с конкурентами в районе
 * 3. Анализ поисковых запросов
 * 4. Прогноз загруженности
 * 5. Рекомендации по улучшению
 * 6. Тренды и сезонность
 */

// GET /api/analytics/restaurant/[id] - получить аналитику ресторана
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d'; // 7d, 30d, 90d, 1y
    
    const restaurantId = params.id;
    
    // Проверяем существование ресторана
    const restaurant = await prisma.restaurant.findFirst({
      where: {
        OR: [
          { id: restaurantId },
          { slug: restaurantId },
        ],
      },
      select: {
        id: true,
        name: true,
        city: true,
        district: true,
        cuisine: true,
        rating: true,
        ratingCount: true,
      },
    });
    
    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }
    
    // Определяем период
    const days = period === '7d' ? 7 : period === '90d' ? 90 : period === '1y' ? 365 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    // Получаем дневную статистику
    const dailyStats = await prisma.restaurantDailyStats.findMany({
      where: {
        restaurantId: restaurant.id,
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });
    
    // Агрегируем данные
    const totals = {
      views: 0,
      cardViews: 0,
      photoViews: 0,
      menuViews: 0,
      calls: 0,
      websiteClicks: 0,
      routeClicks: 0,
      shares: 0,
      favorites: 0,
      orders: 0,
      reservations: 0,
      searchAppears: 0,
      searchClicks: 0,
      uniqueVisitors: 0,
    };
    
    dailyStats.forEach(day => {
      totals.views += day.views;
      totals.cardViews += day.cardViews;
      totals.photoViews += day.photoViews;
      totals.menuViews += day.menuViews;
      totals.calls += day.calls;
      totals.websiteClicks += day.websiteClicks;
      totals.routeClicks += day.routeClicks;
      totals.shares += day.shares;
      totals.favorites += day.favorites;
      totals.orders += day.orders;
      totals.reservations += day.reservations;
      totals.searchAppears += day.searchAppears;
      totals.searchClicks += day.searchClicks;
      totals.uniqueVisitors += day.uniqueVisitors;
    });
    
    // Рассчитываем воронку конверсии
    const funnel = {
      searchImpressions: totals.searchAppears,
      listViews: totals.views,
      cardOpens: totals.cardViews,
      engagements: totals.photoViews + totals.menuViews,
      intents: totals.calls + totals.routeClicks + totals.websiteClicks,
      conversions: totals.orders + totals.reservations,
      
      // Конверсии между этапами
      searchToList: totals.searchAppears > 0 
        ? Math.round((totals.views / totals.searchAppears) * 100) 
        : 0,
      listToCard: totals.views > 0 
        ? Math.round((totals.cardViews / totals.views) * 100) 
        : 0,
      cardToEngage: totals.cardViews > 0 
        ? Math.round(((totals.photoViews + totals.menuViews) / totals.cardViews) * 100) 
        : 0,
      engageToIntent: (totals.photoViews + totals.menuViews) > 0 
        ? Math.round(((totals.calls + totals.routeClicks) / (totals.photoViews + totals.menuViews)) * 100) 
        : 0,
    };
    
    // График по дням
    const chart = dailyStats.map(day => ({
      date: day.date,
      views: day.views,
      cardViews: day.cardViews,
      calls: day.calls,
      routes: day.routeClicks,
    }));
    
    // Пиковые часы (из событий)
    const hourlyStats = await prisma.analyticsEvent.groupBy({
      by: ['hourOfDay'],
      where: {
        restaurantId: restaurant.id,
        createdAt: { gte: startDate },
        eventType: 'card_view',
      },
      _count: true,
      orderBy: { _count: { hourOfDay: 'desc' } },
    });
    
    const peakHours = hourlyStats.slice(0, 3).map(h => h.hourOfDay).filter(Boolean);
    
    // Пиковые дни
    const dailyOfWeek = await prisma.analyticsEvent.groupBy({
      by: ['dayOfWeek'],
      where: {
        restaurantId: restaurant.id,
        createdAt: { gte: startDate },
        eventType: 'card_view',
      },
      _count: true,
      orderBy: { _count: { dayOfWeek: 'desc' } },
    });
    
    const peakDays = dailyOfWeek.slice(0, 2).map(d => d.dayOfWeek).filter(Boolean);
    
    // Топ поисковых запросов, по которым находят этот ресторан
    const topSearchQueries = await prisma.analyticsEvent.groupBy({
      by: ['searchQuery'],
      where: {
        restaurantId: restaurant.id,
        createdAt: { gte: startDate },
        eventType: 'search_click',
        searchQuery: { not: null },
      },
      _count: true,
      orderBy: { _count: { searchQuery: 'desc' } },
      take: 10,
    });
    
    // Сравнение с конкурентами (рестораны того же района и категории)
    // Сначала получаем ID конкурентов
    const competitorRestaurants = await prisma.restaurant.findMany({
      where: {
        city: restaurant.city,
        cuisine: { hasSome: restaurant.cuisine },
        id: { not: restaurant.id },
      },
      select: { id: true },
      take: 50, // Лимит для производительности
    });
    
    const competitorIds = competitorRestaurants.map(r => r.id);
    
    // Затем получаем их статистику
    const competitors = competitorIds.length > 0 
      ? await prisma.restaurantDailyStats.groupBy({
          by: ['restaurantId'],
          where: {
            date: { gte: startDate },
            restaurantId: { in: competitorIds },
          },
          _sum: {
            views: true,
            cardViews: true,
            calls: true,
          },
        })
      : [];
    
    const avgCompetitorViews = competitors.length > 0
      ? Math.round(competitors.reduce((sum, c) => sum + (c._sum.views || 0), 0) / competitors.length)
      : 0;
    
    const comparison = {
      competitorsCount: competitors.length,
      yourViews: totals.views,
      avgCompetitorViews,
      viewsVsAvg: avgCompetitorViews > 0 
        ? Math.round(((totals.views - avgCompetitorViews) / avgCompetitorViews) * 100)
        : 0,
      rank: competitors.filter(c => (c._sum.views || 0) > totals.views).length + 1,
    };
    
    // Рекомендации
    const recommendations = generateRecommendations(restaurant, totals, funnel);
    
    // Insights (оценки)
    const insights = await prisma.restaurantInsights.findUnique({
      where: { restaurantId: restaurant.id },
    });
    
    return NextResponse.json({
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        rating: restaurant.rating,
        ratingCount: restaurant.ratingCount,
      },
      period: { days, startDate, endDate: new Date() },
      totals,
      funnel,
      chart,
      peakHours,
      peakDays,
      topSearchQueries: topSearchQueries.map(q => ({
        query: q.searchQuery,
        count: q._count,
      })),
      comparison,
      recommendations,
      insights,
    });
    
  } catch (error: any) {
    // Graceful degradation если таблицы не существуют
    if (error?.code === 'P2021') {
      return NextResponse.json({ 
        error: 'Analytics not available',
        message: 'Analytics tables not ready. Please run database migration.',
      }, { status: 503 });
    }
    
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

// Генерация рекомендаций на основе данных
function generateRecommendations(
  restaurant: any, 
  totals: any, 
  funnel: any
): Array<{ type: string; priority: string; title: string; description: string; impact: string }> {
  const recommendations: Array<{ type: string; priority: string; title: string; description: string; impact: string }> = [];
  
  // Низкая конверсия из списка в карточку
  if (funnel.listToCard < 5) {
    recommendations.push({
      type: 'photos',
      priority: 'high',
      title: 'Добавьте привлекательные фото',
      description: 'Рестораны с качественными фото получают в 3 раза больше кликов',
      impact: '+200% кликов',
    });
  }
  
  // Мало звонков относительно просмотров
  if (totals.cardViews > 100 && totals.calls < 5) {
    recommendations.push({
      type: 'contact',
      priority: 'high',
      title: 'Проверьте номер телефона',
      description: 'Убедитесь что номер телефона актуален и хорошо виден',
      impact: '+50% звонков',
    });
  }
  
  // Низкий рейтинг
  if (restaurant.rating && restaurant.rating < 4.0) {
    recommendations.push({
      type: 'reviews',
      priority: 'medium',
      title: 'Работайте с отзывами',
      description: 'Отвечайте на негативные отзывы и просите довольных клиентов оставить отзыв',
      impact: '+0.3 к рейтингу',
    });
  }
  
  // Мало отзывов
  if (restaurant.ratingCount && restaurant.ratingCount < 50) {
    recommendations.push({
      type: 'reviews',
      priority: 'medium',
      title: 'Увеличьте количество отзывов',
      description: 'Рестораны с 50+ отзывами получают больше доверия',
      impact: '+25% конверсии',
    });
  }
  
  // Мало просмотров меню
  if (totals.menuViews < totals.cardViews * 0.1) {
    recommendations.push({
      type: 'menu',
      priority: 'medium',
      title: 'Добавьте меню',
      description: 'Загрузите меню с ценами - это увеличит вовлечённость',
      impact: '+40% вовлечённости',
    });
  }
  
  // Мало маршрутов
  if (totals.routeClicks < totals.cardViews * 0.05) {
    recommendations.push({
      type: 'location',
      priority: 'low',
      title: 'Уточните местоположение',
      description: 'Проверьте точность адреса и добавьте ориентиры',
      impact: '+20% маршрутов',
    });
  }
  
  return recommendations;
}

