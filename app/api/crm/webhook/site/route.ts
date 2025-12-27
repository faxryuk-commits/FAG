import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { detectPhoneType } from '@/lib/crm/phone-utils';

export const dynamic = 'force-dynamic';

// POST - Принять лида с сайта delever.io
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Валидация
    if (!data.name && !data.company && !data.phone && !data.email) {
      return NextResponse.json({ 
        error: 'Нужно хотя бы одно поле: name, company, phone или email' 
      }, { status: 400 });
    }

    // Проверяем дубликат по телефону или email
    let existingLead = null;
    if (data.phone) {
      existingLead = await prisma.lead.findFirst({
        where: { phone: data.phone },
      });
    }
    if (!existingLead && data.email) {
      existingLead = await prisma.lead.findFirst({
        where: { email: data.email },
      });
    }

    if (existingLead) {
      // Обновляем существующего лида
      const updated = await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          // Обновляем только если новые данные не пустые
          ...(data.name && { name: data.name }),
          ...(data.company && { company: data.company }),
          ...(data.position && { position: data.position }),
          ...(data.message && { 
            tags: { 
              push: `Сообщение: ${data.message.slice(0, 50)}...` 
            } 
          }),
          // Повышаем скор за повторное обращение
          score: Math.min(100, existingLead.score + 15),
          lastContactAt: new Date(),
        },
      });

      // Создаём touch
      await prisma.touch.create({
        data: {
          leadId: existingLead.id,
          channel: 'website',
          direction: 'inbound',
          content: data.message || 'Повторная заявка с сайта',
          status: 'completed',
          performedBy: 'website',
          metadata: {
            source: data.source || 'delever.io',
            page: data.page,
            utm: data.utm,
            referrer: data.referrer,
          },
        },
      });

      return NextResponse.json({ 
        success: true, 
        action: 'updated',
        leadId: existingLead.id,
        message: 'Лид обновлён',
      });
    }

    // Создаём нового лида
    const lead = await prisma.lead.create({
      data: {
        name: data.name || null,
        firstName: data.firstName || data.name?.split(' ')[0] || null,
        lastName: data.lastName || data.name?.split(' ').slice(1).join(' ') || null,
        company: data.company || null,
        position: data.position || null,
        phone: data.phone || null,
        phoneType: data.phone ? detectPhoneType(data.phone) : null,
        email: data.email || null,
        telegram: data.telegram || null,
        source: data.source || 'website',
        status: 'new',
        segment: 'warm', // Заявка с сайта = тёплый лид
        score: 60, // Базовый скор для заявки с сайта
        tags: data.tags || [],
        metadata: {
          formType: data.formType || 'contact',
          page: data.page,
          utm_source: data.utm?.source,
          utm_medium: data.utm?.medium,
          utm_campaign: data.utm?.campaign,
          referrer: data.referrer,
          userAgent: request.headers.get('user-agent'),
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          message: data.message,
        },
      },
    });

    // Создаём первый touch
    await prisma.touch.create({
      data: {
        leadId: lead.id,
        channel: 'website',
        direction: 'inbound',
        content: data.message || 'Заявка с сайта',
        status: 'completed',
        performedBy: 'website',
        metadata: {
          source: data.source || 'delever.io',
          page: data.page,
          utm: data.utm,
        },
      },
    });

    // Создаём заметку если есть сообщение
    if (data.message) {
      await prisma.leadNote.create({
        data: {
          leadId: lead.id,
          content: `📝 Сообщение из формы:\n\n${data.message}`,
          author: 'Сайт',
        },
      });
    }

    return NextResponse.json({ 
      success: true, 
      action: 'created',
      leadId: lead.id,
      message: 'Лид создан',
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ 
      error: 'Ошибка обработки заявки',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// GET - Проверка работы webhook
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Delever CRM Webhook',
    endpoints: {
      'POST /api/crm/webhook/site': {
        description: 'Принять лида с сайта',
        fields: {
          name: 'string - ФИО',
          company: 'string - Название компании',
          phone: 'string - Телефон',
          email: 'string - Email',
          telegram: 'string - @username',
          message: 'string - Сообщение',
          source: 'string - Источник (default: website)',
          page: 'string - Страница откуда отправлена форма',
          formType: 'string - Тип формы (contact, demo, pricing)',
          utm: '{ source, medium, campaign } - UTM метки',
        },
      },
    },
  });
}

