import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSystemPrompt, SALES_STAGES, OBJECTION_RESPONSES } from '@/lib/crm/ai-prompts';

export const dynamic = 'force-dynamic';

// POST - Обработать ответ клиента и сгенерировать ответ AI
export async function POST(request: NextRequest) {
  try {
    const { conversationId, userMessage } = await request.json();
    
    if (!conversationId || !userMessage) {
      return NextResponse.json({ 
        error: 'conversationId and userMessage are required' 
      }, { status: 400 });
    }
    
    // Получаем диалог с историей
    const conversation = await prisma.aIConversation.findUnique({
      where: { id: conversationId },
      include: {
        lead: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 20,
        },
      },
    });
    
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    
    // Сохраняем сообщение пользователя
    const userIntent = analyzeIntent(userMessage);
    
    await prisma.aIMessage.create({
      data: {
        conversationId,
        role: 'user',
        content: userMessage,
        intent: userIntent,
      },
    });
    
    // Определяем следующий этап
    let nextStage = conversation.stage;
    let shouldEscalate = false;
    
    // Логика перехода между этапами
    if (userIntent === 'positive' || userIntent === 'interested') {
      if (conversation.stage === 'introduction') {
        nextStage = 'qualification';
      } else if (conversation.stage === 'qualification') {
        nextStage = 'demo_pitch';
      } else if (conversation.stage === 'demo_pitch') {
        nextStage = 'closing';
      }
    } else if (userIntent === 'objection') {
      nextStage = 'objection_handling';
    } else if (userIntent === 'negative') {
      // Клиент отказывается — эскалируем или завершаем
      shouldEscalate = true;
    } else if (userIntent === 'demo_request') {
      nextStage = 'demo_pitch';
      shouldEscalate = true; // Человек хочет демо — передаём менеджеру
    }
    
    // Генерируем ответ
    let aiResponse = '';
    let technique = '';
    
    if (shouldEscalate) {
      // Эскалируем на менеджера
      await prisma.aIConversation.update({
        where: { id: conversationId },
        data: {
          status: 'escalated',
          escalatedAt: new Date(),
          escalationReason: userIntent === 'negative' ? 'Клиент отказал' : 'Запрос демо',
        },
      });
      
      aiResponse = userIntent === 'demo_request' 
        ? 'Отлично! Сейчас передам ваш контакт менеджеру — он свяжется с вами в ближайшее время для организации демо. 🙌'
        : 'Понял вас! Если что-то изменится — напишите, буду рад помочь. Хорошего дня! 👋';
      
      technique = 'escalation';
      
    } else {
      // Генерируем ответ на основе этапа
      const context = {
        lead: conversation.lead,
        previousMessages: conversation.messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        currentMessage: userMessage,
        userIntent,
      };
      
      // Проверяем на возражения
      if (userIntent === 'objection') {
        const objectionType = detectObjectionType(userMessage);
        const responses = OBJECTION_RESPONSES[objectionType] || OBJECTION_RESPONSES['подумаю'];
        aiResponse = responses[Math.floor(Math.random() * responses.length)];
        technique = 'objection_handling';
      } else {
        // Генерируем ответ по этапу (в реальности здесь будет вызов GPT)
        aiResponse = generateResponse(nextStage, context);
        technique = nextStage;
      }
      
      // Обновляем этап диалога
      if (nextStage !== conversation.stage) {
        await prisma.aIConversation.update({
          where: { id: conversationId },
          data: { stage: nextStage },
        });
      }
    }
    
    // Персонализируем ответ
    aiResponse = aiResponse
      .replace(/\{\{name\}\}/g, conversation.lead.firstName || conversation.lead.name || '')
      .replace(/\{\{company\}\}/g, conversation.lead.company || 'вашем заведении');
    
    // Сохраняем ответ AI
    await prisma.aIMessage.create({
      data: {
        conversationId,
        role: 'assistant',
        content: aiResponse,
        technique,
      },
    });
    
    // Обновляем касание
    await prisma.touch.create({
      data: {
        leadId: conversation.leadId,
        channel: conversation.channel,
        direction: 'outbound',
        content: aiResponse,
        status: 'sent',
        performedBy: 'ai_robot',
      },
    });
    
    // Обновляем лида
    await prisma.lead.update({
      where: { id: conversation.leadId },
      data: {
        lastContactAt: new Date(),
      },
    });
    
    return NextResponse.json({
      success: true,
      response: aiResponse,
      stage: nextStage,
      intent: userIntent,
      escalated: shouldEscalate,
    });
    
  } catch (error) {
    console.error('Error processing AI response:', error);
    return NextResponse.json({ error: 'Failed to process response' }, { status: 500 });
  }
}

// Анализ намерения пользователя
function analyzeIntent(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  // Позитивные сигналы
  if (/да|конечно|интересно|расскажите|хочу|давайте|окей|хорошо|супер|отлично/i.test(lowerMessage)) {
    return 'positive';
  }
  
  // Запрос демо
  if (/демо|показать|посмотреть|встреча|созвон/i.test(lowerMessage)) {
    return 'demo_request';
  }
  
  // Возражения
  if (/дорого|нет времени|подумаю|есть решение|не надо|не интересно|пришлите/i.test(lowerMessage)) {
    return 'objection';
  }
  
  // Негатив
  if (/нет|не нужно|отстаньте|спам|отписаться|удалите/i.test(lowerMessage)) {
    return 'negative';
  }
  
  // Вопрос
  if (/\?|как|что|сколько|когда|где|почему/i.test(lowerMessage)) {
    return 'question';
  }
  
  return 'neutral';
}

// Определение типа возражения
function detectObjectionType(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (/дорого|цена|стоимость|бюджет|денег нет/i.test(lowerMessage)) {
    return 'дорого';
  }
  if (/времени нет|занят|не сейчас|позже/i.test(lowerMessage)) {
    return 'нет времени';
  }
  if (/подумаю|обдумать|надо решить/i.test(lowerMessage)) {
    return 'подумаю';
  }
  if (/есть|уже|пользуемся|работаем/i.test(lowerMessage)) {
    return 'есть решение';
  }
  if (/пришлите|отправьте|email|презентация/i.test(lowerMessage)) {
    return 'пришлите информацию';
  }
  
  return 'подумаю';
}

// Генерация ответа по этапу (упрощённо, в реальности — GPT)
function generateResponse(stage: string, context: any): string {
  const responses: Record<string, string[]> = {
    qualification: [
      'Интересно! А сколько примерно заказов в день у вас сейчас?',
      'Понял. А как клиенты сейчас делают заказы — звонят или есть онлайн-меню?',
      'А если бы можно было принимать заказы через приложение без оператора — это было бы полезно?',
    ],
    demo_pitch: [
      '{{name}}, отлично!\n\nДавайте покажу, как это работает — буквально 15 минут демо.\n\nКогда удобнее: завтра в 11:00 или послезавтра в 15:00?',
      'Круто! Недавно запустили похожее кафе — теперь 60% заказов идут автоматически.\n\nМогу показать за 15 минут. Как насчёт завтра в 14:00?',
    ],
    closing: [
      'Супер! Тогда давайте начинать.\n\nКакой тариф вам подходит — Starter за $99 или Business за $249?\n\nОтправлю договор, и завтра можем запустить!',
    ],
    objection_handling: [
      'Понимаю! А с чем сравниваете? Обычно наши клиенты экономят больше, чем платят.',
    ],
  };
  
  const stageResponses = responses[stage] || responses.qualification;
  return stageResponses[Math.floor(Math.random() * stageResponses.length)];
}

