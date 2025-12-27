import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateOutreachMessage } from '@/lib/crm/openai-service';

export const dynamic = 'force-dynamic';

// POST - Запустить AI-робота для лида
export async function POST(request: NextRequest) {
  try {
    const { leadId, channel = 'telegram', stage = 'introduction' } = await request.json();
    
    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    }
    
    // Получаем лида
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });
    
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    
    // Проверяем, есть ли уже активный диалог
    const existingConversation = await prisma.aIConversation.findFirst({
      where: {
        leadId,
        status: 'active',
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    
    if (existingConversation) {
      // Возвращаем существующий диалог
      return NextResponse.json({ 
        success: true,
        conversationId: existingConversation.id,
        message: existingConversation.messages[0]?.content || 'Диалог уже активен',
        isExisting: true,
        stage: existingConversation.stage,
      });
    }
    
    // Генерируем сообщение через OpenAI
    const generation = await generateOutreachMessage({
      lead: {
        id: lead.id,
        name: lead.name,
        firstName: lead.firstName,
        lastName: lead.lastName,
        company: lead.company,
        segment: lead.segment,
        score: lead.score,
        tags: lead.tags,
        source: lead.source,
      },
      stage: stage as any,
      channel: channel as any,
    });

    if (!generation.success) {
      return NextResponse.json({ 
        success: false,
        error: generation.error,
        needsConfiguration: generation.error?.includes('не настроен'),
      }, { status: 400 });
    }
    
    // Создаём новый диалог
    const conversation = await prisma.aIConversation.create({
      data: {
        leadId,
        channel,
        status: 'active',
        stage,
        context: {
          lead: {
            name: lead.name,
            firstName: lead.firstName,
            company: lead.company,
            segment: lead.segment,
            score: lead.score,
            tags: lead.tags,
          },
          tokensUsed: generation.tokensUsed || 0,
        },
      },
    });
    
    // Сохраняем сгенерированное сообщение
    await prisma.aIMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: generation.message!,
        technique: 'cold_outreach',
        promptTokens: generation.tokensUsed ? Math.floor(generation.tokensUsed * 0.3) : undefined,
        completionTokens: generation.tokensUsed ? Math.floor(generation.tokensUsed * 0.7) : undefined,
      },
    });
    
    // Создаём касание
    await prisma.touch.create({
      data: {
        leadId,
        channel,
        direction: 'outbound',
        content: generation.message,
        status: 'pending', // Ещё не отправлено
        performedBy: 'ai_robot',
        metadata: {
          conversationId: conversation.id,
          generatedAt: new Date().toISOString(),
          suggestedNextAction: generation.suggestedNextAction,
        },
      },
    });
    
    // Обновляем статус лида
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: lead.status === 'new' ? 'contacted' : lead.status,
        lastContactAt: new Date(),
        nextAction: generation.suggestedNextAction || 'Ожидание ответа',
        nextActionAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // +1 день
      },
    });
    
    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
      message: generation.message,
      tokensUsed: generation.tokensUsed,
      suggestedNextAction: generation.suggestedNextAction,
      // Флаг что сообщение готово к отправке
      readyToSend: true,
      channel,
    });
    
  } catch (error) {
    console.error('Error starting AI robot:', error);
    return NextResponse.json({ 
      error: 'Failed to start AI robot',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
