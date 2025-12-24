import { NextRequest, NextResponse } from 'next/server';
import { startRestaurantSync, checkSyncStatus, fetchAndSaveResults } from '@/lib/apify/sync';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/sync - Запуск синхронизации
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source, searchQuery, location, maxResults } = body;

    if (!source || !['yandex', 'google', '2gis'].includes(source)) {
      return NextResponse.json(
        { error: 'Invalid source. Must be: yandex, google, or 2gis' },
        { status: 400 }
      );
    }

    const result = await startRestaurantSync({
      source,
      searchQuery: searchQuery || 'рестораны',
      location: location || 'Москва',
      maxResults: maxResults || 50,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start sync' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync?jobId=xxx - Проверка статуса синхронизации
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      // Возвращаем список последних задач
      const jobs = await prisma.syncJob.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      return NextResponse.json({ jobs });
    }

    const job = await prisma.syncJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Если задача еще выполняется, проверяем статус в Apify
    if (job.status === 'running' && job.stats) {
      const stats = job.stats as { runId?: string };
      if (stats.runId) {
        const { status, isFinished } = await checkSyncStatus(stats.runId);
        
        if (isFinished && status === 'SUCCEEDED') {
          // Загружаем и сохраняем результаты
          const results = await fetchAndSaveResults(stats.runId, jobId, job.source as any);
          return NextResponse.json({ job: { ...job, status: 'completed' }, results });
        }
        
        if (isFinished && status !== 'SUCCEEDED') {
          await prisma.syncJob.update({
            where: { id: jobId },
            data: { status: 'failed', error: `Apify run ${status}` },
          });
          return NextResponse.json({ job: { ...job, status: 'failed' } });
        }
      }
    }

    return NextResponse.json({ job });
  } catch (error) {
    console.error('Get sync status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get status' },
      { status: 500 }
    );
  }
}
