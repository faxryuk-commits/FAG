import { NextRequest, NextResponse } from 'next/server';
import { runScheduledTasks } from '@/lib/apify/scheduler';

/**
 * GET /api/cron - Запускает запланированные задачи
 * 
 * Вызывается Vercel Cron Jobs или внешним сервисом
 * 
 * Настройка в vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron",
 *     "schedule": "0 * * * *"  // каждый час
 *   }]
 * }
 * 
 * Или через внешний сервис (cron-job.org, easycron.com):
 * URL: https://your-domain.com/api/cron?secret=YOUR_CRON_SECRET
 */
export async function GET(request: NextRequest) {
  try {
    // Проверяем секретный ключ (опционально)
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const expectedSecret = process.env.CRON_SECRET;
    
    // Если настроен CRON_SECRET - проверяем
    // Также пропускаем если запрос от Vercel Cron (есть заголовок)
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';
    
    if (expectedSecret && !isVercelCron && secret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Запускаем задачи
    const result = await runScheduledTasks();
    
    console.log(`Cron executed: ran=${result.ran}, errors=${result.errors}`);
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cron execution failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron - Ручной запуск cron
 */
export async function POST(request: NextRequest) {
  // Проверяем авторизацию через API ключ
  const authHeader = request.headers.get('authorization');
  const expectedKey = process.env.ADMIN_API_KEY;
  
  if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  try {
    const result = await runScheduledTasks();
    
    return NextResponse.json({
      success: true,
      message: 'Manual cron execution completed',
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error('Manual cron error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Manual cron execution failed' },
      { status: 500 }
    );
  }
}

