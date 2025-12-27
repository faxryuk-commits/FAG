import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - Получить AI диалоги
export async function GET() {
  try {
    const conversations = await prisma.aIConversation.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            firstName: true,
            company: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ conversations: [] });
  }
}

