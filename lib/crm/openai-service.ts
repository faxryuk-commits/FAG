/**
 * OpenAI Service для CRM
 * Генерация персонализированных сообщений для продаж
 * Адаптировано под культуру Узбекистана
 */

import { prisma } from '@/lib/prisma';
import { 
  selectCommunicationModel, 
  applyModelToPrompt, 
  CommunicationModel,
  COMMUNICATION_MODELS,
  MESSAGE_TEMPLATES_BY_MODEL,
} from './communication-models';
import {
  selectEntryStrategy,
  ENTRY_STRATEGIES,
  FIRST_CONTACT_RULES,
  FIRST_CONTACT_AI_PROMPT,
  EntryStrategy,
} from './entry-strategies';

interface Lead {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  segment: string | null;
  score: number;
  tags: string[];
  source: string;
}

interface GenerateMessageOptions {
  lead: Lead;
  stage: 'introduction' | 'follow_up' | 'demo_pitch' | 'objection_handling' | 'closing';
  channel: 'telegram' | 'sms' | 'email';
  previousMessages?: Array<{ role: string; content: string }>;
  customInstructions?: string;
  communicationModelId?: string;  // Явно указанная модель коммуникации
}

interface GenerateResponseOptions {
  lead: Lead;
  incomingMessage: string;
  conversationHistory: Array<{ role: string; content: string }>;
  channel: 'telegram' | 'sms' | 'email';
}

interface GenerationResult {
  success: boolean;
  message?: string;
  error?: string;
  tokensUsed?: number;
  intent?: string;
  suggestedNextAction?: string;
  metadata?: {
    communicationModel?: string;
    communicationModelName?: string;
    entryStrategy?: string;
    entryStrategyName?: string;
  };
}

// Получить API ключ из настроек
async function getOpenAIConfig() {
  const settings = await prisma.cRMSettings.findFirst();
  return {
    apiKey: settings?.openaiKey || process.env.OPENAI_API_KEY || null,
    model: settings?.openaiModel || 'gpt-4o-mini',
  };
}

// Системный промпт для холодного outreach (СТАРЫЙ - для follow-up)
const COLD_OUTREACH_PROMPT = `Ты - AI помощник менеджера по продажам в компании Delever.io.
Delever.io - это SaaS платформа для ресторанов и кафе, которая помогает:
- Принимать онлайн-заказы через сайт и приложение
- Управлять доставкой и самовывозом
- Интегрироваться с POS системами (iiko, R-Keeper)
- Принимать оплату (Click, Payme)
- Анализировать продажи и клиентов

Твоя задача - написать персонализированное сообщение потенциальному клиенту.

Правила:
1. Будь кратким и конкретным (2-3 предложения для Telegram/SMS)
2. Персонализируй сообщение под компанию и контекст
3. Используй дружеский, но профессиональный тон
4. НЕ используй официальный язык типа "Добрый день", "С уважением"
5. Добавь конкретную выгоду или кейс
6. Закончи вопросом или призывом к действию
7. Пиши на русском языке

Примеры хороших сообщений:
- "Привет! Видел ваш ресторан на картах — отличные отзывы 🔥 Хотел предложить попробовать Delever — многие рестораны в Ташкенте уже используют для онлайн-заказов. Интересно было бы глянуть?"
- "Привет! Мы помогаем ресторанам принимать заказы онлайн и увеличивать выручку на 20-30%. Видел что у вас нет доставки — это же упущенная выручка. Можем обсудить?"`;

// ⚡ НОВЫЙ промпт для умного первого контакта
const SMART_FIRST_CONTACT_PROMPT = `Ты опытный менеджер по продажам из Узбекистана. 
Твоя задача — написать ПЕРВОЕ сообщение новому лиду.

⚠️ КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА:

❌ НИКОГДА:
${FIRST_CONTACT_RULES.never.map(r => `- ${r}`).join('\n')}

✅ ВСЕГДА:
${FIRST_CONTACT_RULES.always.map(r => `- ${r}`).join('\n')}

🎯 ТВОЯ ЦЕЛЬ В ПЕРВОМ КАСАНИИ:
${FIRST_CONTACT_RULES.goals.map(r => `- ${r}`).join('\n')}

КОНТЕКСТ:
Ты продаёшь Delever.io — платформу для онлайн-заказов ресторанов.
Но в ПЕРВОМ сообщении ты НЕ продаёшь! Ты устанавливаешь контакт.

Пиши на русском с узбекскими словами (Салом, Ассалому алайкум, рахмат, ака, опа).
Максимум 2-3 предложения. Разговорный стиль.`;

// Системный промпт для обработки ответов
const RESPONSE_HANDLER_PROMPT = `Ты - AI помощник менеджера по продажам в Delever.io.

Твоя задача - ответить на сообщение потенциального клиента.

Правила:
1. Определи намерение клиента (интерес, возражение, вопрос, отказ)
2. Если интерес - продвигай к демо
3. Если возражение - обработай мягко, не давя
4. Если вопрос - ответь кратко и верни к теме
5. Если отказ - поблагодари и предложи вернуться позже
6. Будь человечным, не роботизированным
7. Используй технику SPIN если нужно узнать больше о клиенте

Техники обработки возражений:
- "Дорого" → Покажи ROI, предложи расчёт окупаемости
- "Нет времени" → Предложи короткий 15-мин звонок, покажи что экономит время
- "Уже есть решение" → Уточни какое, покажи отличия
- "Не нужно" → Уточни почему, возможно не понял ценность

Ответь коротко, 1-3 предложения.`;

/**
 * 🎯 УМНАЯ генерация первого контакта
 * Использует стратегии входа и культурные модели
 */
export async function generateSmartFirstContact(lead: Lead): Promise<GenerationResult> {
  const { apiKey, model } = await getOpenAIConfig();
  
  if (!apiKey) {
    return { 
      success: false, 
      error: 'OpenAI API ключ не настроен. Перейдите в Настройки CRM.',
    };
  }

  // 1. Выбираем стратегию входа
  const strategy = selectEntryStrategy({
    source: lead.source,
    tags: lead.tags,
    segment: lead.segment || undefined,
    company: lead.company || undefined,
    score: lead.score,
  });

  // 2. Выбираем модель коммуникации
  const commModel = selectCommunicationModel(lead);

  // 3. Формируем примеры из стратегии
  const examples = strategy.openingTypes
    .map(o => `- ${o.example}\n  (Психология: ${o.psychology})`)
    .join('\n\n');

  // 4. Формируем промпт
  const userPrompt = `
СТРАТЕГИЯ ВХОДА: ${strategy.name}
${strategy.description}
Методология: ${strategy.methodology}

МОДЕЛЬ КОММУНИКАЦИИ: ${commModel.nameRu}
Тональность: ${commModel.tone}
Культурный стиль: ${commModel.cultureStyle}

ДАННЫЕ О ЛИДЕ:
- Имя: ${lead.firstName || 'Неизвестно'}
- Компания: ${lead.company || 'Не указана'}
- Сегмент: ${lead.segment || 'Не определён'}
- Теги: ${lead.tags?.join(', ') || 'Нет'}
- Источник: ${lead.source}
- Скоринг: ${lead.score}/100

ПРИМЕРЫ ХОРОШИХ ОТКРЫТИЙ ДЛЯ ЭТОЙ СТРАТЕГИИ:
${examples}

ДОПОЛНИТЕЛЬНЫЕ ПРАВИЛА ДЛЯ МОДЕЛИ "${commModel.nameRu}":
${commModel.promptModifier}

Напиши ОДНО сообщение для первого контакта. Только текст сообщения, без пояснений.
`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SMART_FIRST_CONTACT_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 200,
        temperature: 0.9, // Больше креативности
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { 
        success: false, 
        error: `OpenAI ошибка: ${error.error?.message || 'Неизвестная ошибка'}`,
      };
    }

    const data = await response.json();
    const generatedMessage = data.choices[0]?.message?.content;

    if (!generatedMessage) {
      return { success: false, error: 'OpenAI не вернул сообщение' };
    }

    return {
      success: true,
      message: generatedMessage.trim(),
      tokensUsed: data.usage?.total_tokens,
      suggestedNextAction: `Ожидание ответа (follow-up через ${strategy.followUpDelay}ч)`,
      metadata: {
        communicationModel: commModel.id,
        communicationModelName: commModel.nameRu,
        entryStrategy: strategy.id,
        entryStrategyName: strategy.name,
      } as GenerationResult['metadata'],
    };
  } catch (error) {
    return { 
      success: false, 
      error: `Ошибка генерации: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
    };
  }
}

/**
 * Получить список стратегий входа
 */
export function getEntryStrategies() {
  return ENTRY_STRATEGIES.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    methodology: s.methodology,
    successRate: s.successRate,
  }));
}

/**
 * Генерация холодного сообщения с учётом культурной модели (для follow-up и других этапов)
 */
export async function generateOutreachMessage(options: GenerateMessageOptions): Promise<GenerationResult> {
  const { apiKey, model } = await getOpenAIConfig();
  
  if (!apiKey) {
    return { 
      success: false, 
      error: 'OpenAI API ключ не настроен. Перейдите в Настройки CRM.',
    };
  }

  const { lead, stage, channel, communicationModelId } = options;

  // Выбираем модель коммуникации
  let commModel: CommunicationModel;
  if (communicationModelId) {
    commModel = COMMUNICATION_MODELS.find(m => m.id === communicationModelId) || selectCommunicationModel(lead);
  } else {
    commModel = selectCommunicationModel(lead);
  }

  // Формируем контекст о лиде
  const leadContext = `
Информация о лиде:
- Имя: ${lead.firstName || lead.name || 'Неизвестно'}
- Компания: ${lead.company || 'Не указана'}
- Сегмент: ${lead.segment || 'Не определён'}
- Скоринг: ${lead.score}/100
- Источник: ${lead.source}
- Теги: ${lead.tags.join(', ') || 'Нет'}
- Канал отправки: ${channel}

ВЫБРАННАЯ МОДЕЛЬ КОММУНИКАЦИИ: ${commModel.nameRu}
- Тональность: ${commModel.tone}
- Уровень бизнеса: ${commModel.businessLevel}
- Культурный стиль: ${commModel.cultureStyle}
`;

  const stageInstructions: Record<string, string> = {
    introduction: 'Напиши первое холодное сообщение. Цель - заинтересовать и получить ответ.',
    follow_up: 'Напиши follow-up сообщение. Клиент не ответил на первое сообщение.',
    demo_pitch: 'Напиши приглашение на демо. Клиент проявил интерес.',
    objection_handling: 'Клиент высказал возражение. Обработай его мягко.',
    closing: 'Напиши сообщение для закрытия сделки.',
  };

  // Применяем культурную модель к промпту
  const enhancedPrompt = applyModelToPrompt(COLD_OUTREACH_PROMPT, commModel);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: enhancedPrompt },
          { role: 'user', content: `${leadContext}\n\n${stageInstructions[stage] || stageInstructions.introduction}` },
        ],
        max_tokens: 400,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { 
        success: false, 
        error: `OpenAI ошибка: ${error.error?.message || 'Неизвестная ошибка'}`,
      };
    }

    const data = await response.json();
    const generatedMessage = data.choices[0]?.message?.content;

    if (!generatedMessage) {
      return { success: false, error: 'OpenAI не вернул сообщение' };
    }

    return {
      success: true,
      message: generatedMessage.trim(),
      tokensUsed: data.usage?.total_tokens,
      suggestedNextAction: 'Ожидание ответа',
      // Добавляем информацию о использованной модели
      metadata: {
        communicationModel: commModel.id,
        communicationModelName: commModel.nameRu,
      },
    };
  } catch (error) {
    return { 
      success: false, 
      error: `Ошибка генерации: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
    };
  }
}

/**
 * Получить список доступных моделей коммуникации
 */
export function getCommunicationModels() {
  return COMMUNICATION_MODELS.map(m => ({
    id: m.id,
    name: m.nameRu,
    description: m.description,
    tone: m.tone,
    businessLevel: m.businessLevel,
  }));
}

/**
 * Получить готовый шаблон для модели
 */
export function getTemplateForModel(modelId: string, stage: 'cold_outreach' | 'follow_up' | 'demo_invite'): string | null {
  const templates = MESSAGE_TEMPLATES_BY_MODEL[modelId];
  if (!templates) return null;
  return templates[stage] || null;
}

/**
 * Генерация ответа на сообщение клиента
 */
export async function generateResponse(options: GenerateResponseOptions): Promise<GenerationResult> {
  const { apiKey, model } = await getOpenAIConfig();
  
  if (!apiKey) {
    return { 
      success: false, 
      error: 'OpenAI API ключ не настроен',
    };
  }

  const { lead, incomingMessage, conversationHistory, channel } = options;

  // Формируем контекст
  const leadContext = `
Информация о лиде:
- Имя: ${lead.firstName || lead.name || 'Неизвестно'}
- Компания: ${lead.company || 'Не указана'}
- Сегмент: ${lead.segment || 'Не определён'}
- Канал: ${channel}
`;

  try {
    // Сначала определяем намерение
    const intentResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { 
            role: 'system', 
            content: 'Определи намерение клиента. Ответь ОДНИМ словом: interested, objection, question, rejection, positive, neutral' 
          },
          { role: 'user', content: `Сообщение клиента: "${incomingMessage}"` },
        ],
        max_tokens: 10,
        temperature: 0,
      }),
    });

    const intentData = await intentResponse.json();
    const intent = intentData.choices[0]?.message?.content?.trim().toLowerCase() || 'neutral';

    // Теперь генерируем ответ
    const messages = [
      { role: 'system', content: RESPONSE_HANDLER_PROMPT },
      { role: 'user', content: leadContext },
      ...conversationHistory.slice(-6), // Последние 6 сообщений для контекста
      { role: 'user', content: `Клиент написал: "${incomingMessage}"\n\nНамерение: ${intent}. Напиши ответ.` },
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    const generatedMessage = data.choices[0]?.message?.content;

    // Определяем следующее действие
    const nextActions: Record<string, string> = {
      interested: 'Назначить демо',
      positive: 'Назначить демо',
      objection: 'Обработать возражение',
      question: 'Ответить на вопрос',
      rejection: 'Отложить на 30 дней',
      neutral: 'Продолжить диалог',
    };

    return {
      success: true,
      message: generatedMessage?.trim(),
      tokensUsed: data.usage?.total_tokens,
      intent,
      suggestedNextAction: nextActions[intent] || 'Продолжить диалог',
    };
  } catch (error) {
    return { 
      success: false, 
      error: `Ошибка генерации: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
    };
  }
}

/**
 * Автогенерация шаблона сообщения
 */
export async function generateTemplate(options: {
  type: 'cold_outreach' | 'follow_up' | 'demo_invite' | 'proposal';
  channel: 'telegram' | 'sms' | 'email';
  targetAudience?: string;
}): Promise<GenerationResult> {
  const { apiKey, model } = await getOpenAIConfig();
  
  if (!apiKey) {
    return { success: false, error: 'OpenAI API ключ не настроен' };
  }

  const { type, channel, targetAudience = 'рестораны и кафе' } = options;

  const typeInstructions: Record<string, string> = {
    cold_outreach: 'Холодное первое сообщение. Цель - заинтересовать.',
    follow_up: 'Follow-up после первого сообщения без ответа.',
    demo_invite: 'Приглашение на демонстрацию продукта.',
    proposal: 'Отправка коммерческого предложения.',
  };

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: COLD_OUTREACH_PROMPT },
          { 
            role: 'user', 
            content: `Создай шаблон сообщения.

Тип: ${typeInstructions[type]}
Канал: ${channel}
Целевая аудитория: ${targetAudience}

Используй переменные:
- {{name}} - имя контакта
- {{company}} - название компании

Напиши только текст шаблона, без пояснений.` 
          },
        ],
        max_tokens: 400,
        temperature: 0.9,
      }),
    });

    const data = await response.json();
    return {
      success: true,
      message: data.choices[0]?.message?.content?.trim(),
      tokensUsed: data.usage?.total_tokens,
    };
  } catch (error) {
    return { success: false, error: 'Ошибка генерации шаблона' };
  }
}

