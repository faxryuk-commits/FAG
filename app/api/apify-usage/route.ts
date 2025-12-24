import { NextResponse } from 'next/server';

/**
 * GET /api/apify-usage - Получение статистики использования Apify
 */
export async function GET() {
  try {
    const token = process.env.APIFY_API_TOKEN;
    
    if (!token) {
      return NextResponse.json({ error: 'APIFY_API_TOKEN not configured' }, { status: 500 });
    }

    // Получаем месячное использование
    const usageRes = await fetch(
      `https://api.apify.com/v2/users/me/usage/monthly?token=${token}`
    );
    
    // Получаем лимиты аккаунта
    const limitsRes = await fetch(
      `https://api.apify.com/v2/users/me/limits?token=${token}`
    );

    if (!usageRes.ok || !limitsRes.ok) {
      throw new Error('Failed to fetch Apify data');
    }

    const usage = await usageRes.json();
    const limits = await limitsRes.json();

    // Формируем ответ
    const response = {
      // Текущее использование
      currentUsage: {
        totalUsd: usage.data?.totalUsageUsd || 0,
        actorComputeUnits: usage.data?.actorComputeUnitsUsage || 0,
        dataTransferGb: usage.data?.dataTransferExternalGb || 0,
        proxyGb: usage.data?.proxySerpsUsage || 0,
        storageGb: usage.data?.datasetStorageGb || 0,
      },
      // Лимиты
      limits: {
        maxMonthlyUsd: limits.data?.limits?.maxMonthlyUsageUsd || 5,
        usedUsd: limits.data?.current?.monthlyUsageUsd || 0,
        remainingUsd: (limits.data?.limits?.maxMonthlyUsageUsd || 5) - (limits.data?.current?.monthlyUsageUsd || 0),
      },
      // Процент использования
      usagePercent: limits.data?.limits?.maxMonthlyUsageUsd 
        ? ((limits.data?.current?.monthlyUsageUsd || 0) / limits.data?.limits?.maxMonthlyUsageUsd) * 100 
        : 0,
      // Детализация по типам
      breakdown: {
        actors: usage.data?.dailyServiceUsages?.ACTOR_COMPUTE_UNITS || [],
        storage: usage.data?.dailyServiceUsages?.DATASET_READS || [],
        proxy: usage.data?.dailyServiceUsages?.PROXY_SERPS || [],
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Apify usage error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch usage' },
      { status: 500 }
    );
  }
}

