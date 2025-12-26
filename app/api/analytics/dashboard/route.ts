import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * API для общей аналитики платформы (админский дашборд)
 */

// GET /api/analytics/dashboard - общая статистика платформы
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';
    
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Общие счётчики событий
    const eventCounts = await prisma.analyticsEvent.groupBy({
      by: ['eventType'],
      where: { createdAt: { gte: startDate } },
      _count: true,
    });
    
    const events: Record<string, number> = {};
    eventCounts.forEach(e => {
      events[e.eventType] = e._count;
    });
    
    // Уникальные посетители
    const uniqueVisitors = await prisma.analyticsEvent.findMany({
      where: { 
        createdAt: { gte: startDate },
        visitorId: { not: null },
      },
      distinct: ['visitorId'],
      select: { visitorId: true },
    });
    
    // Уникальные сессии
    const uniqueSessions = await prisma.analyticsEvent.findMany({
      where: { createdAt: { gte: startDate } },
      distinct: ['sessionId'],
      select: { sessionId: true },
    });
    
    // Топ ресторанов по просмотрам
    const topRestaurants = await prisma.restaurantDailyStats.groupBy({
      by: ['restaurantId'],
      where: { date: { gte: startDate } },
      _sum: {
        views: true,
        cardViews: true,
        calls: true,
        routeClicks: true,
      },
      orderBy: { _sum: { cardViews: 'desc' } },
      take: 10,
    });
    
    // Получаем названия ресторанов
    const restaurantIds = topRestaurants.map(r => r.restaurantId);
    const restaurants = await prisma.restaurant.findMany({
      where: { id: { in: restaurantIds } },
      select: { id: true, name: true, slug: true },
    });
    const restaurantMap = new Map(restaurants.map(r => [r.id, r]));
    
    const topRestaurantsWithNames = topRestaurants.map(r => ({
      ...r,
      restaurant: restaurantMap.get(r.restaurantId),
    }));
    
    // Топ поисковых запросов
    const topSearches = await prisma.searchQuery.findMany({
      orderBy: { searchCount: 'desc' },
      take: 20,
    });
    
    // Распределение по платформам
    const platforms = await prisma.analyticsEvent.groupBy({
      by: ['platform'],
      where: { 
        createdAt: { gte: startDate },
        platform: { not: null },
      },
      _count: true,
    });
    
    // Распределение по часам
    const hourlyDistribution = await prisma.analyticsEvent.groupBy({
      by: ['hourOfDay'],
      where: { 
        createdAt: { gte: startDate },
        hourOfDay: { not: null },
      },
      _count: true,
      orderBy: { hourOfDay: 'asc' },
    });
    
    // Распределение по дням недели
    const dailyDistribution = await prisma.analyticsEvent.groupBy({
      by: ['dayOfWeek'],
      where: { 
        createdAt: { gte: startDate },
        dayOfWeek: { not: null },
      },
      _count: true,
      orderBy: { dayOfWeek: 'asc' },
    });
    
    // Города пользователей
    const userCities = await prisma.analyticsEvent.groupBy({
      by: ['userCity'],
      where: { 
        createdAt: { gte: startDate },
        userCity: { not: null },
      },
      _count: true,
      orderBy: { _count: { userCity: 'desc' } },
      take: 10,
    });
    
    // Тренд по дням
    const dailyTrend = await prisma.analyticsEvent.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: startDate } },
      _count: true,
    });
    
    // Агрегируем по дате
    const trendByDate = new Map<string, number>();
    dailyTrend.forEach(d => {
      const date = d.createdAt.toISOString().split('T')[0];
      trendByDate.set(date, (trendByDate.get(date) || 0) + d._count);
    });
    
    return NextResponse.json({
      period: { days, startDate, endDate: new Date() },
      
      // Общие метрики
      summary: {
        totalEvents: Object.values(events).reduce((a, b) => a + b, 0),
        uniqueVisitors: uniqueVisitors.length,
        uniqueSessions: uniqueSessions.length,
        avgEventsPerSession: uniqueSessions.length > 0 
          ? Math.round(Object.values(events).reduce((a, b) => a + b, 0) / uniqueSessions.length)
          : 0,
      },
      
      // События по типам
      events,
      
      // Топ ресторанов
      topRestaurants: topRestaurantsWithNames,
      
      // Поисковые запросы
      topSearches: topSearches.map(s => ({
        query: s.query,
        count: s.searchCount,
        clicks: s.clickCount,
        ctr: s.searchCount > 0 ? Math.round((s.clickCount / s.searchCount) * 100) : 0,
      })),
      
      // Платформы
      platforms: platforms.map(p => ({
        platform: p.platform,
        count: p._count,
      })),
      
      // Распределения
      hourlyDistribution: hourlyDistribution.map(h => ({
        hour: h.hourOfDay,
        count: h._count,
      })),
      
      dailyDistribution: dailyDistribution.map(d => ({
        day: d.dayOfWeek,
        dayName: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][d.dayOfWeek || 0],
        count: d._count,
      })),
      
      // География
      userCities: userCities.map(c => ({
        city: c.userCity,
        count: c._count,
      })),
      
      // Тренд
      trend: Array.from(trendByDate.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    });
    
  } catch (error: any) {
    if (error?.code === 'P2021') {
      return NextResponse.json({ 
        error: 'Analytics not available',
        message: 'Analytics tables not ready',
      }, { status: 503 });
    }
    
    console.error('Dashboard analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

