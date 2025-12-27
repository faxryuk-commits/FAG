import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendSMSViaGateway } from '@/lib/crm/sms-gateway';

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

// Отправка SMS (сначала SMS Gateway, потом Eskiz)
async function sendSMS(
  settings: any,
  phone: string | null,
  message: string
): Promise<{ success: boolean; error?: string; messageId?: string; via?: string }> {
  if (!phone) {
    return { success: false, error: 'Номер телефона не указан' };
  }

  // Способ 1: SMS Gateway (с телефона) - предпочтительный
  if (settings?.smsDevices) {
    try {
      const result = await sendSMSViaGateway(phone, message);
      if (result.success) {
        return {
          success: true,
          messageId: result.messageId,
          via: `SMS Gateway (${result.device})`,
        };
      }
      // Если SMS Gateway не сработал - пробуем Eskiz
      console.log('SMS Gateway failed, trying Eskiz:', result.error);
    } catch (error) {
      console.log('SMS Gateway error, trying Eskiz:', error);
    }
  }

  // Способ 2: Eskiz API
  if (!settings?.eskizEmail || !settings?.eskizPassword) {
    return { success: false, error: 'SMS не настроен. Добавьте устройство или Eskiz в настройках.' };
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
        via: 'Eskiz',
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

  // Вариант 1: Bot API (если есть токен бота)
  if (settings?.telegramBotToken) {
    try {
      // Определяем chat_id - если это username, нужно сначала получить id
      let chatId = telegram;
      
      // Если это username (@username), используем его напрямую
      // Но бот может писать только тем, кто ему написал первым!
      if (telegram.startsWith('@')) {
        chatId = telegram;
      }

      const response = await fetch(
        `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
          }),
        }
      );

      const data = await response.json();

      if (data.ok) {
        return {
          success: true,
          messageId: data.result.message_id?.toString(),
        };
      } else {
        // Типичная ошибка - бот не может писать первым или юзер не найден
        const botError = data.description || 'Ошибка отправки';
        // Если есть MTProto — пробуем им
        if (settings.telegramSession && settings.telegramApiId && settings.telegramApiHash) {
          console.log('Bot send failed, trying MTProto:', botError);
        } else {
          // Если MTProto нет, отдаем ошибку бота
          if (data.error_code === 403) {
            return {
              success: false,
              error: 'Бот не может писать первым. Пользователь должен сначала написать боту.',
            };
          }
          return {
            success: false,
            error: `Telegram: ${botError}`,
          };
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
      };
    }
  }

  // Вариант 2: MTProto (user account) - может писать первым!
  if (settings?.telegramSession && settings?.telegramApiId && settings?.telegramApiHash) {
    try {
      const { TelegramClient, Api } = await import('telegram');
      const { StringSession } = await import('telegram/sessions');
      
      const client = new TelegramClient(
        new StringSession(settings.telegramSession),
        settings.telegramApiId,
        settings.telegramApiHash,
        { connectionRetries: 3 }
      );
      
      await client.connect();
      
      // telegram может быть @username или phone number / chat_id
      let peer: any = telegram;
      if (!telegram.startsWith('@')) {
        peer = telegram.replace(/[^\d]/g, '');
      }
      
      const result = await client.sendMessage(peer, { message });
      
      await client.disconnect();
      
      return {
        success: true,
        messageId: result.id?.toString(),
      };
    } catch (error) {
      console.error('MTProto send error:', error);
      return {
        success: false,
        error: `MTProto: ${error instanceof Error ? error.message : 'Ошибка отправки'}`,
      };
    }
  }

  return { 
    success: false, 
    error: 'Telegram не настроен. Добавьте Bot Token или Session в настройках.',
  };
}

