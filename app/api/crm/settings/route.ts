import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - Получить настройки CRM
export async function GET() {
  try {
    // Ищем или создаём настройки
    let settings = await prisma.cRMSettings.findFirst();
    
    if (!settings) {
      // Создаём дефолтные настройки
      settings = await prisma.cRMSettings.create({
        data: {
          openaiKey: '',
          openaiModel: 'gpt-4o-mini',
          eskizEmail: '',
          eskizPassword: '',
          eskizSender: '4546',
          telegramApiId: '',
          telegramApiHash: '',
          telegramPhone: '',
          telegramSession: '',
        },
      });
    }

    // Возвращаем настройки (маскируем sensitive данные)
    return NextResponse.json({
      settings: {
        openai: {
          apiKey: settings.openaiKey ? '••••' + settings.openaiKey.slice(-4) : '',
          model: settings.openaiModel,
          connected: !!settings.openaiKey,
        },
        eskiz: {
          email: settings.eskizEmail,
          password: settings.eskizPassword ? '••••••••' : '',
          sender: settings.eskizSender,
          balance: 0, // TODO: fetch from Eskiz
          connected: !!(settings.eskizEmail && settings.eskizPassword),
        },
        telegram: {
          botToken: settings.telegramBotToken ? '••••' + settings.telegramBotToken.slice(-4) : '',
          sessionString: settings.telegramSession ? '••••session••••' : '',
          apiId: settings.telegramApiId,
          apiHash: settings.telegramApiHash ? '••••' + settings.telegramApiHash.slice(-4) : '',
          phone: settings.telegramPhone,
          connected: !!(settings.telegramBotToken || settings.telegramSession),
          mode: settings.telegramBotToken ? 'bot' : 'user',
        },
      },
    });
  } catch (error) {
    console.error('Error fetching CRM settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// POST - Сохранить настройки CRM
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { openai, eskiz, telegram } = body;

    // Получаем текущие настройки
    let settings = await prisma.cRMSettings.findFirst();
    
    const updateData: any = {};

    // OpenAI
    if (openai) {
      if (openai.apiKey && !openai.apiKey.includes('••••')) {
        updateData.openaiKey = openai.apiKey;
      }
      if (openai.model) {
        updateData.openaiModel = openai.model;
      }
    }

    // Eskiz
    if (eskiz) {
      if (eskiz.email) {
        updateData.eskizEmail = eskiz.email;
      }
      if (eskiz.password && !eskiz.password.includes('••••')) {
        updateData.eskizPassword = eskiz.password;
      }
      if (eskiz.sender) {
        updateData.eskizSender = eskiz.sender;
      }
    }

    // Telegram
    if (telegram) {
      if (telegram.botToken && !telegram.botToken.includes('••••')) {
        updateData.telegramBotToken = telegram.botToken;
      }
      if (telegram.apiId) {
        updateData.telegramApiId = telegram.apiId;
      }
      if (telegram.apiHash && !telegram.apiHash.includes('••••')) {
        updateData.telegramApiHash = telegram.apiHash;
      }
      if (telegram.phone) {
        updateData.telegramPhone = telegram.phone;
      }
      if (telegram.sessionString && !telegram.sessionString.includes('••••')) {
        updateData.telegramSession = telegram.sessionString;
      }
    }

    if (settings) {
      await prisma.cRMSettings.update({
        where: { id: settings.id },
        data: updateData,
      });
    } else {
      await prisma.cRMSettings.create({
        data: {
          openaiKey: updateData.openaiKey || '',
          openaiModel: updateData.openaiModel || 'gpt-4o-mini',
          eskizEmail: updateData.eskizEmail || '',
          eskizPassword: updateData.eskizPassword || '',
          eskizSender: updateData.eskizSender || '4546',
          telegramApiId: updateData.telegramApiId || '',
          telegramApiHash: updateData.telegramApiHash || '',
          telegramPhone: updateData.telegramPhone || '',
          telegramSession: updateData.telegramSession || '',
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving CRM settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}

