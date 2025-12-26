import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * API для трекинга событий аналитики
 * 
 * События:
 * - view: просмотр в списке
 * - card_view: открытие карточки ресторана
 * - photo_view: просмотр фото
 * - menu_view: просмотр меню
 * - call: клик по телефону
 * - website: переход на сайт
 * - route: построение маршрута
 * - share: поделиться
 * - favorite: добавление в избранное
 * - search: поисковый запрос
 * - search_click: клик из поиска
 */

interface TrackEvent {
  eventType: string;
  restaurantId?: string;
  sessionId: string;
  visitorId?: string;
  
  // Геолокация
  userLat?: number;
  userLng?: number;
  userCity?: string;
  
  // Контекст
  searchQuery?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  
  // Платформа
  platform?: string;
  browser?: string;
  
  // Доп. данные
  eventData?: any;
}

// Генерация sessionId на клиенте если нет
function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// POST /api/analytics/track - записать событие
export async function POST(request: NextRequest) {
  try {
    const body: TrackEvent = await request.json();
    
    if (!body.eventType) {
      return NextResponse.json({ error: 'eventType is required' }, { status: 400 });
    }
    
    const sessionId = body.sessionId || generateSessionId();
    const now = new Date();
    
    // Записываем событие
    const event = await prisma.analyticsEvent.create({
      data: {
        restaurantId: body.restaurantId || null,
        eventType: body.eventType,
        eventData: body.eventData || null,
        source: 'web',
        platform: body.platform || detectPlatform(request),
        browser: body.browser || detectBrowser(request),
        sessionId,
        visitorId: body.visitorId || null,
        userLat: body.userLat || null,
        userLng: body.userLng || null,
        userCity: body.userCity || null,
        searchQuery: body.searchQuery || null,
        referrer: body.referrer || request.headers.get('referer') || null,
        utmSource: body.utmSource || null,
        utmMedium: body.utmMedium || null,
        utmCampaign: body.utmCampaign || null,
        dayOfWeek: now.getDay(),
        hourOfDay: now.getHours(),
      },
    });
    
    // Обновляем дневную статистику (async, не блокируем ответ)
    if (body.restaurantId) {
      updateDailyStats(body.restaurantId, body.eventType).catch(console.error);
    }
    
    // Обновляем статистику поиска
    if (body.eventType === 'search' && body.searchQuery) {
      updateSearchStats(body.searchQuery).catch(console.error);
    }
    
    return NextResponse.json({ 
      success: true, 
      eventId: event.id,
      sessionId,
    });
  } catch (error: any) {
    // Если таблица не существует, просто возвращаем успех (graceful degradation)
    if (error?.code === 'P2021') {
      return NextResponse.json({ success: true, message: 'Analytics tables not ready' });
    }
    
    console.error('Analytics track error:', error);
    return NextResponse.json({ error: 'Failed to track event' }, { status: 500 });
  }
}

// Batch tracking - множественные события
export async function PUT(request: NextRequest) {
  try {
    const body: { events: TrackEvent[] } = await request.json();
    
    if (!body.events || !Array.isArray(body.events)) {
      return NextResponse.json({ error: 'events array is required' }, { status: 400 });
    }
    
    const now = new Date();
    
    const events = await prisma.analyticsEvent.createMany({
      data: body.events.map(e => ({
        restaurantId: e.restaurantId || null,
        eventType: e.eventType,
        eventData: e.eventData || null,
        source: 'web',
        platform: e.platform || null,
        browser: e.browser || null,
        sessionId: e.sessionId || generateSessionId(),
        visitorId: e.visitorId || null,
        userLat: e.userLat || null,
        userLng: e.userLng || null,
        userCity: e.userCity || null,
        searchQuery: e.searchQuery || null,
        referrer: e.referrer || null,
        utmSource: e.utmSource || null,
        utmMedium: e.utmMedium || null,
        utmCampaign: e.utmCampaign || null,
        dayOfWeek: now.getDay(),
        hourOfDay: now.getHours(),
      })),
    });
    
    return NextResponse.json({ 
      success: true, 
      count: events.count,
    });
  } catch (error: any) {
    if (error?.code === 'P2021') {
      return NextResponse.json({ success: true, message: 'Analytics tables not ready' });
    }
    
    console.error('Analytics batch track error:', error);
    return NextResponse.json({ error: 'Failed to track events' }, { status: 500 });
  }
}

// Обновление дневной статистики
async function updateDailyStats(restaurantId: string, eventType: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const increment: any = {};
  
  switch (eventType) {
    case 'view': increment.views = 1; break;
    case 'card_view': increment.cardViews = 1; break;
    case 'photo_view': increment.photoViews = 1; break;
    case 'menu_view': increment.menuViews = 1; break;
    case 'call': increment.calls = 1; break;
    case 'website': increment.websiteClicks = 1; break;
    case 'route': increment.routeClicks = 1; break;
    case 'share': increment.shares = 1; break;
    case 'favorite': increment.favorites = 1; break;
    case 'search_appear': increment.searchAppears = 1; break;
    case 'search_click': increment.searchClicks = 1; break;
    case 'order': increment.orders = 1; break;
    case 'reservation': increment.reservations = 1; break;
  }
  
  if (Object.keys(increment).length === 0) return;
  
  try {
    await prisma.restaurantDailyStats.upsert({
      where: {
        restaurantId_date: {
          restaurantId,
          date: today,
        },
      },
      update: increment,
      create: {
        restaurantId,
        date: today,
        ...increment,
      },
    });
  } catch (error) {
    console.error('Failed to update daily stats:', error);
  }
}

// Обновление статистики поиска
async function updateSearchStats(query: string) {
  const normalized = query.toLowerCase().trim();
  
  try {
    await prisma.searchQuery.upsert({
      where: { normalizedQuery: normalized },
      update: {
        searchCount: { increment: 1 },
        lastSearched: new Date(),
      },
      create: {
        query,
        normalizedQuery: normalized,
        searchCount: 1,
      },
    });
  } catch (error) {
    console.error('Failed to update search stats:', error);
  }
}

// Определение платформы из User-Agent
function detectPlatform(request: NextRequest): string {
  const ua = request.headers.get('user-agent')?.toLowerCase() || '';
  
  if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
  if (ua.includes('android')) return 'android';
  if (ua.includes('mobile')) return 'mobile';
  return 'desktop';
}

// Определение браузера из User-Agent
function detectBrowser(request: NextRequest): string {
  const ua = request.headers.get('user-agent')?.toLowerCase() || '';
  
  if (ua.includes('chrome')) return 'chrome';
  if (ua.includes('safari')) return 'safari';
  if (ua.includes('firefox')) return 'firefox';
  if (ua.includes('edge')) return 'edge';
  return 'other';
}

