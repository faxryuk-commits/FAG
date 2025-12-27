import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// POST - Тестировать соединение с устройством
export async function POST(request: NextRequest) {
  try {
    const { device } = await request.json();
    
    if (!device || !device.apiUrl) {
      return NextResponse.json({ success: false, error: 'Invalid device' }, { status: 400 });
    }
    
    const start = Date.now();
    
    try {
      // Пробуем подключиться к устройству
      // Для SMS Gateway App проверяем статус
      const statusUrl = device.apiUrl.replace(/\/send$/, '').replace(/\/$/, '') + '/status';
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(statusUrl, {
        method: 'GET',
        headers: device.apiKey ? { 'Authorization': device.apiKey } : {},
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      const latency = Date.now() - start;
      
      if (response.ok) {
        return NextResponse.json({ 
          success: true, 
          latency,
          message: `Устройство доступно (${latency}ms)`,
        });
      } else {
        // Попробуем просто ping основной URL
        const pingResponse = await fetch(device.apiUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(3000),
        }).catch(() => null);
        
        if (pingResponse) {
          return NextResponse.json({ 
            success: true, 
            latency: Date.now() - start,
            message: 'Сервер доступен',
          });
        }
        
        return NextResponse.json({ 
          success: false, 
          error: `HTTP ${response.status}`,
        });
      }
    } catch (fetchError) {
      // Если /status не работает, пробуем просто пингануть
      try {
        const pingResponse = await fetch(device.apiUrl.replace(/\/send$/, ''), {
          method: 'GET',
          signal: AbortSignal.timeout(3000),
        });
        
        if (pingResponse) {
          return NextResponse.json({ 
            success: true, 
            latency: Date.now() - start,
            message: 'Сервер отвечает',
          });
        }
      } catch {
        // ignore
      }
      
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Connection failed';
      
      if (errorMessage.includes('abort') || errorMessage.includes('timeout')) {
        return NextResponse.json({ 
          success: false, 
          error: 'Таймаут подключения (5 сек). Проверьте IP и порт.',
        });
      }
      
      return NextResponse.json({ 
        success: false, 
        error: `Не удалось подключиться: ${errorMessage}`,
      });
    }
  } catch (error) {
    console.error('Error testing SMS device:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

