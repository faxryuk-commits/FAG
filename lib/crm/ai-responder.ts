/**
 * AI Auto-Responder для входящих сообщений
 * Автоматически отвечает на сообщения из Instagram, Telegram и т.д.
 */

import { prisma } from '@/lib/prisma';
import { PRODUCT_KNOWLEDGE } from './product-knowledge';
import { COMMUNICATION_MODELS, selectCommunicationModel } from './communication-models';

interface ConversationContext {
  conversationId: string;
  channel: string;
  userName: string | null;
  messages: Array<{
    direction: 'inbound' | 'outbound';
    content: string;
    createdAt: Date;
  }>;
  leadId?: string | null;
  leadData?: {
    name: string | null;
    company: string | null;
    segment: string | null;
  };
}

interface AIResponseResult {
  success: boolean;
  response?: string;
  shouldSend: boolean;  // Нужно ли отправлять (или лучше передать менеджеру)
  intent?: string;      // Определённое намерение клиента
  error?: string;
}

// Системный промпт для AI-ассистента
const AI_ASSISTANT_PROMPT = `Ты - вежливый и профессиональный AI-ассистент компании Delever.io.

📦 О КОМПАНИИ DELEVER:
${PRODUCT_KNOWLEDGE.description}

Мы помогаем ресторанам и кафе:
- Запустить свои каналы продаж (приложение, сайт, Telegram)
- Интегрироваться с агрегаторами (Wolt, Glovo, Yandex Eats)
- Управлять доставкой и курьерами
- Получать аналитику и увеличивать продажи

КЛЮЧЕВЫЕ ПРЕИМУЩЕСТВА:
- 0% комиссии на свои каналы (vs 15-30% у агрегаторов)
- Запуск за 1 день
- 40+ интеграций
- Поддержка 24/7

ЦЕНЫ: от $99/месяц, White Label приложение от 13,000,000 сум

ТВОЯ ЗАДАЧА:
1. Вежливо приветствовать и знакомиться
2. Понять потребности клиента
3. Рассказать о релевантных решениях Delever
4. Ответить на вопросы
5. Предложить демо или консультацию

ВАЖНЫЕ ПРАВИЛА:
- Общайся тепло и дружелюбно (узбекская культура)
- Не будь навязчивым - сначала пойми потребность
- Если не знаешь точный ответ - предложи связать с менеджером
- Пиши коротко и по делу (это мессенджер)
- Используй эмодзи умеренно
- Если человек просто здоровается - поздоровайся и спроси чем помочь

ЯЗЫК: Отвечай на том языке, на котором пишет клиент (русский, узбекский, английский)`;

// Определить намерение клиента
function detectIntent(message: string, history: Array<{ direction: string; content: string }>): string {
  const lowerMsg = message.toLowerCase();
  
  // Приветствие
  if (/^(привет|салом|здравствуй|hi|hello|добрый|ассалом)/i.test(lowerMsg)) {
    return 'greeting';
  }
  
  // Вопрос о цене
  if (/цен|стоим|сколько|прайс|тариф|price|cost/i.test(lowerMsg)) {
    return 'pricing_question';
  }
  
  // Вопрос о функционале
  if (/как работ|что дела|функци|возможност|умеет|how|what/i.test(lowerMsg)) {
    return 'feature_question';
  }
  
  // Запрос демо
  if (/демо|показ|презентац|demo|попробов/i.test(lowerMsg)) {
    return 'demo_request';
  }
  
  // Контакт с менеджером
  if (/менеджер|человек|оператор|позвон|связ|manager|call/i.test(lowerMsg)) {
    return 'human_request';
  }
  
  // Жалоба/проблема
  if (/проблем|не работ|ошибк|плохо|problem|issue|bug/i.test(lowerMsg)) {
    return 'complaint';
  }
  
  // Благодарность
  if (/спасибо|рахмат|thank|благодар/i.test(lowerMsg)) {
    return 'thanks';
  }
  
  return 'general';
}

// Проверить нужно ли автоматически отвечать
function shouldAutoRespond(intent: string, messagesCount: number): boolean {
  // Всегда отвечаем на приветствия
  if (intent === 'greeting') return true;
  
  // Отвечаем на общие вопросы в начале диалога
  if (messagesCount <= 4 && ['pricing_question', 'feature_question', 'general'].includes(intent)) {
    return true;
  }
  
  // Передаём менеджеру при запросе человека или жалобах
  if (['human_request', 'complaint'].includes(intent)) {
    return false;
  }
  
  // Демо-запросы - отвечаем но помечаем как важное
  if (intent === 'demo_request') {
    return true;
  }
  
  return true;
}

// Получить конфигурацию OpenAI
async function getOpenAIConfig() {
  const settings = await prisma.cRMSettings.findFirst();
  return {
    apiKey: settings?.openaiKey || process.env.OPENAI_API_KEY,
    model: settings?.openaiModel || 'gpt-4o-mini',
  };
}

// Генерировать AI ответ
export async function generateAIResponse(context: ConversationContext): Promise<AIResponseResult> {
  try {
    const config = await getOpenAIConfig();
    
    if (!config.apiKey) {
      return { success: false, shouldSend: false, error: 'OpenAI API key not configured' };
    }

    // Последнее сообщение от клиента
    const lastInbound = context.messages.filter(m => m.direction === 'inbound').pop();
    if (!lastInbound) {
      return { success: false, shouldSend: false, error: 'No inbound message' };
    }

    // Определяем намерение
    const intent = detectIntent(lastInbound.content, context.messages);
    
    // Проверяем нужно ли автоматически отвечать
    const inboundCount = context.messages.filter(m => m.direction === 'inbound').length;
    if (!shouldAutoRespond(intent, inboundCount)) {
      return { 
        success: true, 
        shouldSend: false, 
        intent,
        response: 'Требуется ответ менеджера' 
      };
    }

    // Формируем историю для контекста
    const messageHistory = context.messages.slice(-10).map(m => ({
      role: m.direction === 'inbound' ? 'user' : 'assistant',
      content: m.content,
    }));

    // Выбираем модель коммуникации
    const commModel = context.leadData 
      ? selectCommunicationModel({
          segment: context.leadData.segment,
          company: context.leadData.company,
        })
      : COMMUNICATION_MODELS.friendly;

    // Формируем промпт
    const systemPrompt = `${AI_ASSISTANT_PROMPT}

СТИЛЬ ОБЩЕНИЯ: ${commModel.nameRu}
${commModel.systemPromptAddition}

Имя клиента: ${context.userName || 'Неизвестно'}
${context.leadData?.company ? `Компания: ${context.leadData.company}` : ''}
Канал: ${context.channel}
Количество сообщений в диалоге: ${context.messages.length}`;

    // Вызываем OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messageHistory,
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return { success: false, shouldSend: false, error: data.error.message };
    }

    const aiMessage = data.choices?.[0]?.message?.content;
    
    if (!aiMessage) {
      return { success: false, shouldSend: false, error: 'Empty response from AI' };
    }

    return {
      success: true,
      response: aiMessage,
      shouldSend: true,
      intent,
    };

  } catch (error) {
    console.error('AI Response error:', error);
    return { success: false, shouldSend: false, error: String(error) };
  }
}

// Отправить сообщение через Instagram API
async function sendInstagramMessage(recipientId: string, text: string): Promise<boolean> {
  try {
    const settings = await prisma.cRMSettings.findFirst();
    if (!settings?.instagramAccessToken) {
      console.error('Instagram access token not configured');
      return false;
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text },
          access_token: settings.instagramAccessToken,
        }),
      }
    );

    const data = await response.json();
    
    if (data.error) {
      console.error('Instagram send error:', data.error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending Instagram message:', error);
    return false;
  }
}

// Главная функция - обработать входящее и отправить AI ответ
export async function processIncomingAndRespond(conversationId: string): Promise<{
  responded: boolean;
  response?: string;
  intent?: string;
  error?: string;
}> {
  try {
    // Получаем диалог с сообщениями
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 20,
        },
        lead: true,
      },
    });

    if (!conversation) {
      return { responded: false, error: 'Conversation not found' };
    }

    // Формируем контекст
    const context: ConversationContext = {
      conversationId: conversation.id,
      channel: conversation.channel,
      userName: conversation.name,
      messages: conversation.messages.map(m => ({
        direction: m.direction as 'inbound' | 'outbound',
        content: m.content,
        createdAt: m.createdAt,
      })),
      leadId: conversation.leadId,
      leadData: conversation.lead ? {
        name: conversation.lead.name,
        company: conversation.lead.company,
        segment: conversation.lead.segment,
      } : undefined,
    };

    // Генерируем AI ответ
    const aiResult = await generateAIResponse(context);

    if (!aiResult.success || !aiResult.shouldSend || !aiResult.response) {
      // Помечаем что требуется ответ менеджера
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          tags: { push: 'needs_human' },
        },
      });
      
      return { 
        responded: false, 
        intent: aiResult.intent,
        error: aiResult.error || 'AI decided not to respond' 
      };
    }

    // Отправляем сообщение
    let sent = false;
    
    if (conversation.channel === 'instagram') {
      sent = await sendInstagramMessage(conversation.externalId, aiResult.response);
    }
    // TODO: добавить telegram, whatsapp и т.д.

    if (sent) {
      // Сохраняем сообщение в базу
      await prisma.chatMessage.create({
        data: {
          conversationId,
          direction: 'outbound',
          content: aiResult.response,
          contentType: 'text',
          status: 'sent',
          sentBy: 'ai',
          metadata: {
            intent: aiResult.intent,
            autoResponded: true,
          },
        },
      });

      // Обновляем диалог
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageText: aiResult.response,
          lastMessageBy: 'us',
          lastMessageAt: new Date(),
          status: 'active',
        },
      });

      console.log(`🤖 AI responded to ${conversation.channel} conversation ${conversationId}`);
    }

    return {
      responded: sent,
      response: aiResult.response,
      intent: aiResult.intent,
    };

  } catch (error) {
    console.error('Error processing and responding:', error);
    return { responded: false, error: String(error) };
  }
}

