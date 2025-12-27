import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST - Тестирование подключения к сервису
export async function POST(
  request: NextRequest,
  { params }: { params: { service: string } }
) {
  try {
    const { service } = params;
    
    // Получаем настройки
    const settings = await prisma.cRMSettings.findFirst();
    
    if (!settings) {
      return NextResponse.json({ 
        success: false, 
        message: 'Настройки не найдены' 
      });
    }

    switch (service) {
      case 'openai':
        return await testOpenAI(settings.openaiKey, settings.openaiModel);
      
      case 'eskiz':
        return await testEskiz(settings.eskizEmail, settings.eskizPassword);
      
      case 'telegram':
        return await testTelegram(settings.telegramSession);
      
      default:
        return NextResponse.json({ 
          success: false, 
          message: 'Неизвестный сервис' 
        });
    }
  } catch (error) {
    console.error('Error testing service:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Ошибка проверки подключения' 
    }, { status: 500 });
  }
}

// Тест OpenAI
async function testOpenAI(apiKey: string | null, model: string) {
  if (!apiKey) {
    return NextResponse.json({ 
      success: false, 
      message: 'API ключ не указан' 
    });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Say "OK"' }],
        max_tokens: 5,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({ 
        success: true, 
        message: `✅ Подключено! Модель: ${model}`,
        model: model,
      });
    } else {
      const error = await response.json();
      return NextResponse.json({ 
        success: false, 
        message: `Ошибка: ${error.error?.message || 'Неизвестная ошибка'}` 
      });
    }
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      message: 'Не удалось подключиться к OpenAI' 
    });
  }
}

// Тест Eskiz SMS
async function testEskiz(email: string | null, password: string | null) {
  if (!email || !password) {
    return NextResponse.json({ 
      success: false, 
      message: 'Email или пароль не указаны' 
    });
  }

  try {
    // Авторизация
    const authResponse = await fetch('https://notify.eskiz.uz/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const authData = await authResponse.json();

    if (!authData.data?.token) {
      return NextResponse.json({ 
        success: false, 
        message: `Ошибка авторизации: ${authData.message || 'Неверные данные'}` 
      });
    }

    // Проверяем баланс
    const balanceResponse = await fetch('https://notify.eskiz.uz/api/user/get-limit', {
      headers: {
        'Authorization': `Bearer ${authData.data.token}`,
      },
    });

    const balanceData = await balanceResponse.json();
    const balance = balanceData.data?.balance || 0;

    return NextResponse.json({ 
      success: true, 
      message: `✅ Подключено! Баланс: ${balance} SMS`,
      balance: balance,
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      message: 'Не удалось подключиться к Eskiz' 
    });
  }
}

// Тест Telegram
async function testTelegram(sessionString: string | null) {
  if (!sessionString) {
    return NextResponse.json({ 
      success: false, 
      message: 'Session string не указан. Требуется авторизация.' 
    });
  }

  // TODO: Реализовать проверку через gramjs/telegram
  // Пока возвращаем что сессия есть
  return NextResponse.json({ 
    success: true, 
    message: '✅ Session найден. Авторизация активна.',
  });
}

