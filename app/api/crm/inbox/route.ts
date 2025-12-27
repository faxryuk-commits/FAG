import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - Получить список диалогов
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const channel = searchParams.get('channel');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = {};
    
    if (status !== 'all') {
      where.status = status;
    }
    
    if (channel) {
      where.channel = channel;
    }

    const [conversations, total, unreadTotal] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          lead: {
            select: {
              id: true,
              name: true,
              company: true,
              status: true,
            },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.conversation.count({ where }),
      prisma.conversation.aggregate({
        where: { status: { in: ['new', 'active'] } },
        _sum: { unreadCount: true },
      }),
    ]);

    return NextResponse.json({
      conversations,
      total,
      unreadTotal: unreadTotal._sum.unreadCount || 0,
      hasMore: offset + conversations.length < total,
    });

  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}

