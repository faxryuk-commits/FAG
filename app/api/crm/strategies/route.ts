import { NextResponse } from 'next/server';
import { ENTRY_STRATEGIES, FIRST_CONTACT_RULES } from '@/lib/crm/entry-strategies';

export const dynamic = 'force-dynamic';

// GET - Получить список стратегий входа
export async function GET() {
  try {
    const strategies = ENTRY_STRATEGIES.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      methodology: s.methodology,
      successRate: s.successRate,
      followUpDelay: s.followUpDelay,
      useCase: s.useCase,
      openingTypes: s.openingTypes.map(o => ({
        type: o.type,
        template: o.template,
        psychology: o.psychology,
        example: o.example,
      })),
    }));

    return NextResponse.json({
      strategies,
      rules: FIRST_CONTACT_RULES,
    });
  } catch (error) {
    console.error('Error fetching strategies:', error);
    return NextResponse.json({ error: 'Failed to fetch strategies' }, { status: 500 });
  }
}

