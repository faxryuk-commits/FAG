import { NextResponse } from 'next/server';
import { ENTRY_STRATEGIES, FIRST_CONTACT_RULES } from '@/lib/crm/entry-strategies';

export const dynamic = 'force-dynamic';

// GET - Получить список стратегий входа
export async function GET() {
  try {
    const strategies = ENTRY_STRATEGIES.map(s => {
      // Извлекаем эмодзи и название из s.name (формат: "🔍 Разведка")
      const nameParts = s.name.split(' ');
      const icon = nameParts[0] || '💬';
      const nameRu = nameParts.slice(1).join(' ') || s.name;
      
      return {
        id: s.id,
        name: s.name,
        nameRu: nameRu,
        icon: icon,
        description: s.description,
        methodology: s.methodology,
        successRate: s.successRate,
        followUpDelay: s.followUpDelay,
        useCase: s.useCase,
        bestFor: s.useCase, // Alias для UI
        openingTypes: s.openingTypes.map(o => ({
          type: o.type,
          template: o.template,
          psychology: o.psychology,
          example: o.example,
        })),
      };
    });

    return NextResponse.json({
      strategies,
      rules: FIRST_CONTACT_RULES,
    });
  } catch (error) {
    console.error('Error fetching strategies:', error);
    return NextResponse.json({ error: 'Failed to fetch strategies' }, { status: 500 });
  }
}

