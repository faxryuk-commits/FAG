import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - Проверить все подключения
export async function GET() {
  try {
    const settings = await prisma.cRMSettings.findFirst();
    
    const statuses = [];

    // OpenAI
    if (settings?.openaiKey) {
      try {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${settings.openaiKey}` },
        });
        statuses.push({
          service: 'OpenAI',
          status: res.ok ? 'connected' : 'error',
          message: res.ok ? 'Подключено' : 'Ошибка авторизации',
        });
      } catch {
        statuses.push({ service: 'OpenAI', status: 'error', message: 'Ошибка подключения' });
      }
    } else {
      statuses.push({ service: 'OpenAI', status: 'not_configured', message: 'Не настроено' });
    }

    // Eskiz
    if (settings?.eskizEmail && settings?.eskizPassword) {
      try {
        const res = await fetch('https://notify.eskiz.uz/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: settings.eskizEmail, 
            password: settings.eskizPassword 
          }),
        });
        const data = await res.json();
        
        if (data.data?.token) {
          // Проверяем баланс
          const balanceRes = await fetch('https://notify.eskiz.uz/api/user/get-limit', {
            headers: { 'Authorization': `Bearer ${data.data.token}` },
          });
          const balanceData = await balanceRes.json();
          
          statuses.push({
            service: 'Eskiz SMS',
            status: 'connected',
            message: `Баланс: ${balanceData.data?.balance || 0} SMS`,
          });
        } else {
          statuses.push({ service: 'Eskiz SMS', status: 'error', message: data.message || 'Ошибка авторизации' });
        }
      } catch {
        statuses.push({ service: 'Eskiz SMS', status: 'error', message: 'Ошибка подключения' });
      }
    } else {
      statuses.push({ service: 'Eskiz SMS', status: 'not_configured', message: 'Не настроено' });
    }

    // Telegram
    if (settings?.telegramSession) {
      statuses.push({ service: 'Telegram', status: 'connected', message: 'Session найден' });
    } else if (settings?.telegramApiId) {
      statuses.push({ service: 'Telegram', status: 'error', message: 'Требуется авторизация' });
    } else {
      statuses.push({ service: 'Telegram', status: 'not_configured', message: 'Не настроено' });
    }

    return NextResponse.json({ statuses });
  } catch (error) {
    console.error('Error checking connections:', error);
    return NextResponse.json({ 
      statuses: [
        { service: 'OpenAI', status: 'error', message: 'Ошибка проверки' },
        { service: 'Eskiz SMS', status: 'error', message: 'Ошибка проверки' },
        { service: 'Telegram', status: 'error', message: 'Ошибка проверки' },
      ]
    });
  }
}

