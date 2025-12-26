import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - получить статистику использования API
export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Получаем статистику за текущий месяц
    const currentMonth = await prisma.apiUsage.findMany({
      where: { year, month },
    });

    // Получаем статистику за прошлый месяц
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const previousMonth = await prisma.apiUsage.findMany({
      where: { year: prevYear, month: prevMonth },
    });

    // Получаем всю историю
    const allTime = await prisma.apiUsage.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    // Считаем итоги
    const currentMonthTotal = currentMonth.reduce((sum, u) => sum + u.totalCost, 0);
    const currentMonthRequests = currentMonth.reduce((sum, u) => sum + u.requests, 0);
    
    const previousMonthTotal = previousMonth.reduce((sum, u) => sum + u.totalCost, 0);
    const previousMonthRequests = previousMonth.reduce((sum, u) => sum + u.requests, 0);

    const allTimeTotal = allTime.reduce((sum, u) => sum + u.totalCost, 0);
    const allTimeRequests = allTime.reduce((sum, u) => sum + u.requests, 0);

    // Google бесплатный лимит $200/месяц
    const freeLimit = 200;
    const remainingFree = Math.max(0, freeLimit - currentMonthTotal);
    const usagePercent = (currentMonthTotal / freeLimit) * 100;

    // Группируем по сервису
    const byService: Record<string, { requests: number; cost: number }> = {};
    for (const usage of currentMonth) {
      if (!byService[usage.service]) {
        byService[usage.service] = { requests: 0, cost: 0 };
      }
      byService[usage.service].requests += usage.requests;
      byService[usage.service].cost += usage.totalCost;
    }

    // Группируем по endpoint
    const byEndpoint: Record<string, { requests: number; cost: number }> = {};
    for (const usage of currentMonth) {
      const key = `${usage.service}:${usage.endpoint}`;
      if (!byEndpoint[key]) {
        byEndpoint[key] = { requests: 0, cost: 0 };
      }
      byEndpoint[key].requests += usage.requests;
      byEndpoint[key].cost += usage.totalCost;
    }

    // История по месяцам
    const monthlyHistory: Array<{
      year: number;
      month: number;
      requests: number;
      cost: number;
    }> = [];

    const grouped = allTime.reduce((acc, u) => {
      const key = `${u.year}-${u.month}`;
      if (!acc[key]) {
        acc[key] = { year: u.year, month: u.month, requests: 0, cost: 0 };
      }
      acc[key].requests += u.requests;
      acc[key].cost += u.totalCost;
      return acc;
    }, {} as Record<string, { year: number; month: number; requests: number; cost: number }>);

    for (const key of Object.keys(grouped).sort().reverse().slice(0, 12)) {
      monthlyHistory.push(grouped[key]);
    }

    return NextResponse.json({
      currentMonth: {
        year,
        month,
        requests: currentMonthRequests,
        cost: currentMonthTotal,
        freeLimit,
        remainingFree,
        usagePercent: Math.round(usagePercent * 10) / 10,
      },
      previousMonth: {
        year: prevYear,
        month: prevMonth,
        requests: previousMonthRequests,
        cost: previousMonthTotal,
      },
      allTime: {
        requests: allTimeRequests,
        cost: allTimeTotal,
      },
      byService,
      byEndpoint,
      monthlyHistory,
    });
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    return NextResponse.json({
      error: 'Failed to fetch usage stats',
    }, { status: 500 });
  }
}

