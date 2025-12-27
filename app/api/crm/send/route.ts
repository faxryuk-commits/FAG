import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST - Отправить сообщение лиду
export async function POST(request: NextRequest) {
  try {
    const { leadId, touchId, channel, message } = await request.json();
    
    if (!leadId || !message || !channel) {
      return NextResponse.json({ 
        error: 'leadId, message и channel обязательны' 
      }, { status: 400 });
    }

    // Получаем лида
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Лид не найден' }, { status: 404 });
    }

    // Получаем настройки
    const settings = await prisma.cRMSettings.findFirst();

    let result;

    switch (channel) {
      case 'sms':
        result = await sendSMS(settings, lead.phone, message);
        break;
      case 'telegram':
        result = await sendTelegram(settings, lead.telegram, message);
        break;
      case 'email':
        result = { success: false, error: 'Email рассылка пока не реализована' };
        break;
      default:
        result = { success: false, error: 'Неизвестный канал' };
    }

    // Обновляем touch если он есть
    if (touchId && result.success) {
      await prisma.touch.update({
        where: { id: touchId },
        data: {
          status: 'sent',
          metadata: {
            sentAt: new Date().toISOString(),
            messageId: result.messageId,
          },
        },
      });
    }

    // Создаём новый touch если нет
    if (!touchId) {
      await prisma.touch.create({
        data: {
          leadId,
          channel,
          direction: 'outbound',
          content: message,
          status: result.success ? 'sent' : 'failed',
          performedBy: 'manual',
          metadata: result.success ? {
            sentAt: new Date().toISOString(),
            messageId: result.messageId,
          } : {
            error: result.error,
          },
        },
      });
    }

    // Обновляем лида
    if (result.success) {
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          lastContactAt: new Date(),
          status: lead.status === 'new' ? 'contacted' : lead.status,
        },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Ошибка отправки сообщения',
    }, { status: 500 });
  }
}

// Отправка SMS через Eskiz
async function sendSMS(
  settings: any,
  phone: string | null,
  message: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  if (!phone) {
    return { success: false, error: 'Номер телефона не указан' };
  }

  if (!settings?.eskizEmail || !settings?.eskizPassword) {
    return { success: false, error: 'Eskiz не настроен. Перейдите в настройки.' };
  }

  try {
    // Авторизация
    const authRes = await fetch('https://notify.eskiz.uz/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: settings.eskizEmail,
        password: settings.eskizPassword,
      }),
    });

    const authData = await authRes.json();

    if (!authData.data?.token) {
      return { success: false, error: 'Ошибка авторизации в Eskiz' };
    }

    // Нормализуем номер
    const normalizedPhone = phone.replace(/[+\s-]/g, '');

    // Отправка SMS
    const smsRes = await fetch('https://notify.eskiz.uz/api/message/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.data.token}`,
      },
      body: JSON.stringify({
        mobile_phone: normalizedPhone,
        message: message,
        from: settings.eskizSender || '4546',
      }),
    });

    const smsData = await smsRes.json();

    if (smsData.status === 'success' || smsData.id) {
      return { 
        success: true, 
        messageId: smsData.id?.toString(),
      };
    }

    return { 
      success: false, 
      error: smsData.message || 'Ошибка отправки SMS',
    };
  } catch (error) {
    return { 
      success: false, 
      error: `Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
    };
  }
}

// Отправка в Telegram
async function sendTelegram(
  settings: any,
  telegram: string | null,
  message: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  if (!telegram) {
    return { success: false, error: 'Telegram не указан' };
  }

  if (!settings?.telegramSession) {
    return { 
      success: false, 
      error: 'Telegram не авторизован. Перейдите в настройки для авторизации.',
    };
  }

  // TODO: Реализовать отправку через gramjs/telegram MTProto
  // Пока возвращаем ошибку что не реализовано
  return { 
    success: false, 
    error: 'Telegram рассылка через user account требует дополнительной настройки. Свяжитесь с разработчиком.',
  };
}

