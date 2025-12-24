import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSyncResults } from '@/lib/apify/sync';
import { triggerWebhook } from '@/lib/apify/webhook';

/**
 * POST /api/webhook/apify - Принимает webhook от Apify
 * 
 * Apify отправляет webhook когда:
 * - Актер завершил работу (ACTOR.RUN.SUCCEEDED)
 * - Актер провалился (ACTOR.RUN.FAILED)
 * - Актер прерван (ACTOR.RUN.ABORTED)
 * 
 * Настройка в Apify Console:
 * 1. Перейти в Actor → Settings → Integrations
 * 2. Add webhook → URL: https://your-domain.com/api/webhook/apify
 * 3. Event types: ACTOR.RUN.SUCCEEDED, ACTOR.RUN.FAILED
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Apify webhook received:', JSON.stringify(body, null, 2));
    
    const { eventType, eventData } = body;
    const runId = eventData?.actorRunId || eventData?.runId;
    
    if (!runId) {
      return NextResponse.json({ error: 'Missing runId' }, { status: 400 });
    }
    
    // Находим задачу по runId
    const syncJob = await prisma.syncJob.findFirst({
      where: {
        stats: {
          path: ['runId'],
          equals: runId,
        },
      },
    });
    
    if (!syncJob) {
      console.log(`No sync job found for runId: ${runId}`);
      return NextResponse.json({ message: 'Job not found, webhook ignored' });
    }
    
    // Обрабатываем событие
    switch (eventType) {
      case 'ACTOR.RUN.SUCCEEDED': {
        // Получаем результаты и сохраняем
        try {
          const results = await getSyncResults(syncJob.id);
          
          // Триггерим наши webhook'и
          await triggerWebhook('sync.completed', {
            jobId: syncJob.id,
            source: syncJob.source,
            ...results,
          });
          
          return NextResponse.json({
            success: true,
            message: 'Results processed',
            ...results,
          });
        } catch (error) {
          console.error('Error processing Apify results:', error);
          
          await prisma.syncJob.update({
            where: { id: syncJob.id },
            data: {
              status: 'failed',
              error: error instanceof Error ? error.message : 'Failed to process results',
            },
          });
          
          await triggerWebhook('sync.failed', {
            jobId: syncJob.id,
            source: syncJob.source,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          
          return NextResponse.json({ error: 'Failed to process results' }, { status: 500 });
        }
      }
      
      case 'ACTOR.RUN.FAILED':
      case 'ACTOR.RUN.ABORTED': {
        await prisma.syncJob.update({
          where: { id: syncJob.id },
          data: {
            status: 'failed',
            error: `Apify run ${eventType.split('.').pop()?.toLowerCase()}`,
          },
        });
        
        await triggerWebhook('sync.failed', {
          jobId: syncJob.id,
          source: syncJob.source,
          error: eventType,
        });
        
        return NextResponse.json({ success: true, message: 'Job marked as failed' });
      }
      
      default:
        return NextResponse.json({ message: 'Event type not handled' });
    }
  } catch (error) {
    console.error('Apify webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhook/apify - Проверка работоспособности endpoint'а
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Apify webhook endpoint is ready',
    usage: {
      method: 'POST',
      events: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.ABORTED'],
      setup: 'Configure in Apify Console → Actor → Settings → Integrations → Add webhook',
    },
  });
}

