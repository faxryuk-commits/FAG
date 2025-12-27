import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST - Конвертировать диалог в лида
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, company, phone, email, segment = 'warm', tags = [] } = body;

    // Получаем диалог
    const conversation = await prisma.conversation.findUnique({
      where: { id: params.id },
      include: { messages: true },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (conversation.leadId) {
      return NextResponse.json({ 
        error: 'Already converted', 
        leadId: conversation.leadId 
      }, { status: 400 });
    }

    // Создаём лида
    const lead = await prisma.lead.create({
      data: {
        name: name || conversation.name || `${conversation.channel} User`,
        company,
        phone,
        email,
        telegram: conversation.channel === 'telegram' ? conversation.externalId : null,
        source: `${conversation.channel}_chat`,
        sourceId: conversation.externalId,
        status: 'qualified',
        segment,
        score: segment === 'hot' ? 80 : segment === 'warm' ? 60 : 40,
        tags: [...tags, conversation.channel, 'from_chat'],
        lastContactAt: conversation.lastMessageAt,
        metadata: {
          conversationId: conversation.id,
          instagramId: conversation.channel === 'instagram' ? conversation.externalId : null,
          username: conversation.username,
          avatarUrl: conversation.avatarUrl,
        },
      },
    });

    // Связываем диалог с лидом
    await prisma.conversation.update({
      where: { id: params.id },
      data: {
        leadId: lead.id,
        status: 'qualified',
      },
    });

    // Создаём touch с историей сообщений
    const messagesText = conversation.messages
      .map(m => `[${m.direction === 'inbound' ? '←' : '→'}] ${m.content}`)
      .join('\n');

    await prisma.touch.create({
      data: {
        leadId: lead.id,
        channel: conversation.channel,
        direction: 'inbound',
        content: `📱 История чата:\n\n${messagesText}`,
        status: 'completed',
        performedBy: 'system',
        metadata: {
          conversationId: conversation.id,
          messagesCount: conversation.messages.length,
        },
      },
    });

    return NextResponse.json({
      success: true,
      lead,
      message: 'Диалог успешно конвертирован в лида',
    });

  } catch (error) {
    console.error('Error converting conversation to lead:', error);
    return NextResponse.json({ error: 'Failed to convert' }, { status: 500 });
  }
}

