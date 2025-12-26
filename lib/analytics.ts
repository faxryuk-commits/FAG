/**
 * Клиентская библиотека аналитики
 * 
 * Использование:
 * import { trackEvent, useAnalytics } from '@/lib/analytics';
 * 
 * // Одиночное событие
 * trackEvent('card_view', { restaurantId: '123' });
 * 
 * // Хук для React компонентов
 * const { trackView, trackClick, trackSearch } = useAnalytics();
 */

// Генерация уникального ID сессии
function generateSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
}

// Генерация ID посетителя (сохраняется между сессиями)
function generateVisitorId(): string {
  if (typeof window === 'undefined') return '';
  
  let visitorId = localStorage.getItem('analytics_visitor_id');
  if (!visitorId) {
    visitorId = `vis_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('analytics_visitor_id', visitorId);
  }
  return visitorId;
}

// Получение UTM меток из URL
function getUtmParams(): { utmSource?: string; utmMedium?: string; utmCampaign?: string } {
  if (typeof window === 'undefined') return {};
  
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get('utm_source') || undefined,
    utmMedium: params.get('utm_medium') || undefined,
    utmCampaign: params.get('utm_campaign') || undefined,
  };
}

// Определение платформы
function detectPlatform(): string {
  if (typeof window === 'undefined') return 'server';
  
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
  if (ua.includes('android')) return 'android';
  if (window.innerWidth < 768) return 'mobile';
  if (window.innerWidth < 1024) return 'tablet';
  return 'desktop';
}

// Основная функция трекинга
export async function trackEvent(
  eventType: string,
  data?: {
    restaurantId?: string;
    searchQuery?: string;
    eventData?: any;
    userLat?: number;
    userLng?: number;
    userCity?: string;
  }
): Promise<void> {
  // Не трекаем на сервере
  if (typeof window === 'undefined') return;
  
  // Не трекаем в режиме разработки (опционально)
  // if (process.env.NODE_ENV === 'development') return;
  
  try {
    const utm = getUtmParams();
    
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType,
        restaurantId: data?.restaurantId,
        sessionId: generateSessionId(),
        visitorId: generateVisitorId(),
        searchQuery: data?.searchQuery,
        eventData: data?.eventData,
        userLat: data?.userLat,
        userLng: data?.userLng,
        userCity: data?.userCity,
        platform: detectPlatform(),
        referrer: document.referrer,
        ...utm,
      }),
    });
  } catch (error) {
    // Ошибки аналитики не должны влиять на UX
    console.debug('Analytics error:', error);
  }
}

// Batch трекинг (для множественных событий)
export async function trackEvents(
  events: Array<{
    eventType: string;
    restaurantId?: string;
    eventData?: any;
  }>
): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    const sessionId = generateSessionId();
    const visitorId = generateVisitorId();
    const platform = detectPlatform();
    const utm = getUtmParams();
    
    await fetch('/api/analytics/track', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: events.map(e => ({
          ...e,
          sessionId,
          visitorId,
          platform,
          referrer: document.referrer,
          ...utm,
        })),
      }),
    });
  } catch (error) {
    console.debug('Analytics batch error:', error);
  }
}

// ============================
// Готовые функции для типичных событий
// ============================

/** Просмотр ресторана в списке */
export const trackView = (restaurantId: string) => 
  trackEvent('view', { restaurantId });

/** Открытие карточки ресторана */
export const trackCardView = (restaurantId: string) => 
  trackEvent('card_view', { restaurantId });

/** Просмотр фотографии */
export const trackPhotoView = (restaurantId: string, photoIndex?: number) => 
  trackEvent('photo_view', { restaurantId, eventData: { photoIndex } });

/** Просмотр меню */
export const trackMenuView = (restaurantId: string) => 
  trackEvent('menu_view', { restaurantId });

/** Просмотр отзывов */
export const trackReviewView = (restaurantId: string) => 
  trackEvent('review_view', { restaurantId });

/** Клик по телефону */
export const trackCall = (restaurantId: string, phone?: string) => 
  trackEvent('call', { restaurantId, eventData: { phone } });

/** Переход на сайт */
export const trackWebsiteClick = (restaurantId: string, url?: string) => 
  trackEvent('website', { restaurantId, eventData: { url } });

/** Построение маршрута */
export const trackRoute = (restaurantId: string, userLat?: number, userLng?: number) => 
  trackEvent('route', { restaurantId, userLat, userLng });

/** Поделиться */
export const trackShare = (restaurantId: string, method?: string) => 
  trackEvent('share', { restaurantId, eventData: { method } });

/** Добавление в избранное */
export const trackFavorite = (restaurantId: string, action: 'add' | 'remove') => 
  trackEvent('favorite', { restaurantId, eventData: { action } });

/** Поисковый запрос */
export const trackSearch = (query: string, resultsCount?: number) => 
  trackEvent('search', { searchQuery: query, eventData: { resultsCount } });

/** Клик из поиска */
export const trackSearchClick = (restaurantId: string, query: string, position?: number) => 
  trackEvent('search_click', { restaurantId, searchQuery: query, eventData: { position } });

/** Заказ (если интегрирован) */
export const trackOrder = (restaurantId: string, orderData?: any) => 
  trackEvent('order', { restaurantId, eventData: orderData });

/** Бронирование */
export const trackReservation = (restaurantId: string, reservationData?: any) => 
  trackEvent('reservation', { restaurantId, eventData: reservationData });

// ============================
// React Hook для удобства
// ============================

export function useAnalytics() {
  return {
    trackEvent,
    trackEvents,
    trackView,
    trackCardView,
    trackPhotoView,
    trackMenuView,
    trackReviewView,
    trackCall,
    trackWebsiteClick,
    trackRoute,
    trackShare,
    trackFavorite,
    trackSearch,
    trackSearchClick,
    trackOrder,
    trackReservation,
  };
}

// ============================
// Автоматический трекинг просмотров
// ============================

/** 
 * Intersection Observer для автоматического трекинга просмотров в списке
 * 
 * Использование:
 * <div ref={el => el && observeView(el, restaurantId)}>
 */
let viewObserver: IntersectionObserver | null = null;
const viewedRestaurants = new Set<string>();

export function observeView(element: HTMLElement, restaurantId: string) {
  if (typeof window === 'undefined') return;
  
  // Создаём observer если ещё нет
  if (!viewObserver) {
    viewObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-restaurant-id');
            if (id && !viewedRestaurants.has(id)) {
              viewedRestaurants.add(id);
              trackView(id);
            }
          }
        });
      },
      { threshold: 0.5 } // 50% видимости
    );
  }
  
  element.setAttribute('data-restaurant-id', restaurantId);
  viewObserver.observe(element);
}

/** Очистка observer (вызывать при unmount) */
export function cleanupViewObserver() {
  if (viewObserver) {
    viewObserver.disconnect();
    viewObserver = null;
  }
  viewedRestaurants.clear();
}

