import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSystemPrompt, OUTREACH_TEMPLATES } from '@/lib/crm/ai-prompts';

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
    });
    
    if (existingConversation) {
      return NextResponse.json({ 
        error: 'Active conversation already exists',
        conversationId: existingConversation.id,
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
        },
      },
    });
    
    // Генерируем первое сообщение
    const template = OUTREACH_TEMPLATES.cold_telegram;
    let firstMessage = template.body
      .replace(/\{\{name\}\}/g, lead.firstName || lead.name || 'Привет')
      .replace(/\{\{company\}\}/g, lead.company || 'вашем заведении')
      .replace(/\{\{competitor\}\}/g, 'сеть ресторанов');
    
    // Сохраняем первое сообщение
    await prisma.aIMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: firstMessage,
        technique: 'cold_outreach',
      },
    });
    
    // Создаём касание
    await prisma.touch.create({
      data: {
        leadId,
        channel,
        direction: 'outbound',
        content: firstMessage,
        status: 'pending',
        performedBy: 'ai_robot',
      },
    });
    
    // Обновляем статус лида
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: 'contacted',
        lastContactAt: new Date(),
        nextAction: 'Ожидание ответа',
        nextActionAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // +1 день
      },
    });
    
    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
      message: firstMessage,
    });
    
  } catch (error) {
    console.error('Error starting AI robot:', error);
    return NextResponse.json({ error: 'Failed to start AI robot' }, { status: 500 });
  }
}

