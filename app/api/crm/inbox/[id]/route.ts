import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - Получить диалог с сообщениями
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: params.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        lead: true,
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Отмечаем как прочитанное
    if (conversation.unreadCount > 0) {
      await prisma.conversation.update({
        where: { id: params.id },
        data: { unreadCount: 0 },
      });
    }

    return NextResponse.json({ conversation });

  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 });
  }
}

// PATCH - Обновить диалог (статус, назначение, теги)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { status, assignedTo, tags } = body;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (tags) updateData.tags = tags;

    const conversation = await prisma.conversation.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({ conversation });

  } catch (error) {
    console.error('Error updating conversation:', error);
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
  }
}

