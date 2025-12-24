import { NextRequest, NextResponse } from 'next/server';
import { startSync, getSyncResults, processSyncResults } from '@/lib/apify/sync';

/**
 * POST /api/sync - Запуск синхронизации данных
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source, city, actorId, input } = body;

    if (!source || !['yandex', 'google', '2gis'].includes(source)) {
      return NextResponse.json(
        { error: 'Invalid source. Must be yandex, google, or 2gis' },
        { status: 400 }
      );
    }

    const result = await startSync({ source, city, actorId, input });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync - Получение статуса синхронизации
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId');

    if (!runId) {
      return NextResponse.json(
        { error: 'runId parameter is required' },
        { status: 400 }
      );
    }

    const results = await getSyncResults(runId);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Get sync results error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

