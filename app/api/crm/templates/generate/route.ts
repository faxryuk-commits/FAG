import { NextRequest, NextResponse } from 'next/server';
import { generateTemplate } from '@/lib/crm/openai-service';

export const dynamic = 'force-dynamic';

// POST - Сгенерировать шаблон через AI
export async function POST(request: NextRequest) {
  try {
    const { type, channel, targetAudience } = await request.json();

    if (!type || !channel) {
      return NextResponse.json({ 
        error: 'type и channel обязательны' 
      }, { status: 400 });
    }

    const result = await generateTemplate({
      type: type as any,
      channel: channel as any,
      targetAudience,
    });

    if (!result.success) {
      return NextResponse.json({ 
        success: false,
        error: result.error,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      template: result.message,
      tokensUsed: result.tokensUsed,
    });
  } catch (error) {
    console.error('Error generating template:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Ошибка генерации шаблона',
    }, { status: 500 });
  }
}

