import { NextResponse } from 'next/server';
import { getCommunicationModels, getTemplateForModel } from '@/lib/crm/openai-service';
import { COMMUNICATION_MODELS, MESSAGE_TEMPLATES_BY_MODEL } from '@/lib/crm/communication-models';

export const dynamic = 'force-dynamic';

// GET - Получить все модели коммуникации
export async function GET() {
  try {
    const models = COMMUNICATION_MODELS.map(m => ({
      id: m.id,
      name: m.nameRu,
      description: m.description,
      tone: m.tone,
      businessLevel: m.businessLevel,
      cultureStyle: m.cultureStyle,
      useEmoji: m.useEmoji,
      useFormalGreeting: m.useFormalGreeting,
      greetings: m.greetings,
      templates: MESSAGE_TEMPLATES_BY_MODEL[m.id] || null,
    }));

    return NextResponse.json({ 
      models,
      // Описания для UI
      tones: {
        respectful: 'Уважительная',
        friendly: 'Дружеская',
        professional: 'Профессиональная',
        casual: 'Простая',
      },
      businessLevels: {
        premium: 'Премиум',
        business: 'Бизнес',
        casual: 'Средний',
        street: 'Уличный',
      },
      cultureStyles: {
        eastern: 'Восточная',
        western: 'Западная',
        mixed: 'Смешанная',
      },
    });
  } catch (error) {
    console.error('Error fetching communication models:', error);
    return NextResponse.json({ error: 'Ошибка загрузки моделей' }, { status: 500 });
  }
}

