import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - Получить статистику мониторинга
export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalTouches,
      todayTouches,
      pendingResponses,
      activeConversations,
      messagesSent,
      repliesReceived,
    ] = await Promise.all([
      // Всего касаний
      prisma.touch.count(),
      
      // Касаний сегодня
      prisma.touch.count({
        where: {
          createdAt: { gte: today },
        },
      }),
      
      // Ожидают ответа (отправлено но нет ответа)
      prisma.touch.count({
        where: {
          direction: 'outbound',
          status: { in: ['sent', 'delivered'] },
          response: null,
        },
      }),
      
      // Активных AI диалогов
      prisma.aIConversation.count({
        where: {
          status: 'active',
        },
      }),
      
      // Отправлено исходящих
      prisma.touch.count({
        where: {
          direction: 'outbound',
        },
      }),
      
      // Получено ответов
      prisma.touch.count({
        where: {
          response: { not: null },
        },
      }),
    ]);

    return NextResponse.json({
      stats: {
        totalTouches,
        todayTouches,
        pendingResponses,
        activeConversations,
        messagesSent,
        repliesReceived,
      },
    });
  } catch (error) {
    console.error('Error fetching monitor stats:', error);
    return NextResponse.json({
      stats: {
        totalTouches: 0,
        todayTouches: 0,
        pendingResponses: 0,
        activeConversations: 0,
        messagesSent: 0,
        repliesReceived: 0,
      },
    });
  }
}

