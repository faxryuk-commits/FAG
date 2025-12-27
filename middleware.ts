import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware для установки куки посетителя
 * 
 * Куки (cookies) - это небольшие файлы, которые браузер сохраняет на устройстве пользователя.
 * Это позволяет идентифицировать посетителя между сессиями.
 * 
 * Мы устанавливаем:
 * - _fag_vid (visitor id) - уникальный ID посетителя (на 1 год)
 * - _fag_sid (session id) - ID текущей сессии (на 30 минут)
 * 
 * Это законно при соблюдении условий:
 * 1. Уведомление пользователя о куки (cookie banner)
 * 2. Возможность отказаться от отслеживания
 * 3. Не храним персональные данные без согласия
 */

// Генерация уникального ID
function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `${prefix}_${timestamp}_${random}`;
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Проверяем и устанавливаем visitor ID (постоянный)
  const existingVisitorId = request.cookies.get('_fag_vid')?.value;
  
  if (!existingVisitorId) {
    const newVisitorId = generateId('v');
    response.cookies.set('_fag_vid', newVisitorId, {
      httpOnly: false, // Доступен из JS для отправки в аналитику
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 год
      path: '/',
    });
  }
  
  // Проверяем и устанавливаем session ID (временный)
  const existingSessionId = request.cookies.get('_fag_sid')?.value;
  
  if (!existingSessionId) {
    const newSessionId = generateId('s');
    response.cookies.set('_fag_sid', newSessionId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 30, // 30 минут
      path: '/',
    });
  } else {
    // Продлеваем сессию при активности
    response.cookies.set('_fag_sid', existingSessionId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 30, // 30 минут
      path: '/',
    });
  }
  
  // Добавляем заголовки для аналитики на сервере
  const visitorId = existingVisitorId || request.cookies.get('_fag_vid')?.value;
  const sessionId = existingSessionId || request.cookies.get('_fag_sid')?.value;
  
  if (visitorId) {
    response.headers.set('x-visitor-id', visitorId);
  }
  if (sessionId) {
    response.headers.set('x-session-id', sessionId);
  }
  
  return response;
}

// Применяем middleware ко всем страницам (кроме API и статики)
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (they handle cookies themselves)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

