import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 минут для обработки большой базы

/**
 * Проверка номеров телефонов в Telegram через MTProto API
 * 
 * Для работы нужны:
 * - TELEGRAM_API_ID
 * - TELEGRAM_API_HASH  
 * - TELEGRAM_SESSION (строка сессии MTProto)
 */

interface CheckResult {
  total: number;
  checked: number;
  withTelegram: number;
  withoutTelegram: number;
  errors: number;
  details: Array<{
    leadId: string;
    phone: string;
    hasTelegram: boolean;
    telegramId?: string;
    username?: string;
  }>;
}

// POST - Проверить номера в базе
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { limit = 100, offset = 0, testMode = true } = body;
    
    // Получаем настройки Telegram
    const settings = await prisma.cRMSettings.findFirst();
    
    if (!settings?.telegramApiId || !settings?.telegramApiHash || !settings?.telegramSession) {
      return NextResponse.json({
        error: 'Telegram MTProto не настроен',
        needsConfiguration: true,
        help: 'Для проверки номеров нужна авторизация через личный Telegram аккаунт. Перейдите в Настройки → Telegram MTProto',
      }, { status: 400 });
    }
    
    // Получаем лидов с номерами телефонов БЕЗ telegram
    const leads = await prisma.lead.findMany({
      where: {
        phone: { not: null },
        phoneType: 'mobile', // Только мобильные
        telegram: null, // Только те, у кого ещё нет telegram
      },
      select: {
        id: true,
        phone: true,
        telegram: true,
        name: true,
        company: true,
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });
    
    if (leads.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Нет номеров для проверки',
        result: { total: 0, checked: 0, withTelegram: 0, withoutTelegram: 0, errors: 0, details: [] },
      });
    }
    
    // В тестовом режиме просто возвращаем статистику без реальной проверки
    if (testMode) {
      // Считаем уже известные Telegram контакты
      const withKnownTelegram = leads.filter(l => l.telegram).length;
      
      return NextResponse.json({
        success: true,
        testMode: true,
        message: `Найдено ${leads.length} номеров для проверки`,
        currentStats: {
          total: leads.length,
          alreadyHaveTelegram: withKnownTelegram,
          needCheck: leads.length - withKnownTelegram,
        },
        samplePhones: leads.slice(0, 5).map(l => ({
          phone: l.phone?.replace(/(\d{3})\d{4}(\d{2})/, '$1****$2'), // Маскируем
          name: l.company || l.name,
          hasTelegram: !!l.telegram,
        })),
        help: 'Для реальной проверки отправьте запрос с testMode: false',
      });
    }
    
    // Реальная проверка через Telegram MTProto
    const result = await checkPhonesTelegram(
      leads.map(l => ({ id: l.id, phone: l.phone! })),
      {
        apiId: parseInt(settings.telegramApiId),
        apiHash: settings.telegramApiHash,
        session: settings.telegramSession,
      }
    );
    
    // Обновляем базу данных
    for (const detail of result.details) {
      if (detail.hasTelegram && (detail.telegramId || detail.username)) {
        await prisma.lead.update({
          where: { id: detail.leadId },
          data: {
            telegram: detail.username ? `@${detail.username}` : detail.telegramId,
          },
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      result,
      message: `Проверено ${result.checked} номеров. Telegram есть у ${result.withTelegram}.`,
    });
    
  } catch (error) {
    console.error('Error checking Telegram contacts:', error);
    return NextResponse.json({ 
      error: 'Ошибка проверки',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// GET - Получить статистику по Telegram контактам
export async function GET() {
  try {
    // Всего лидов с мобильными номерами
    const totalMobile = await prisma.lead.count({
      where: {
        phone: { not: null },
        phoneType: 'mobile',
      },
    });
    
    // Лидов с известным Telegram
    const withTelegram = await prisma.lead.count({
      where: {
        telegram: { not: null },
      },
    });
    
    // Лидов с мобильным БЕЗ Telegram (потенциальные для проверки)
    const mobileWithoutTelegram = await prisma.lead.count({
      where: {
        phone: { not: null },
        phoneType: 'mobile',
        telegram: null,
      },
    });
    
    // Всего лидов
    const totalLeads = await prisma.lead.count();
    
    return NextResponse.json({
      totalLeads,
      totalMobile,
      withTelegram,
      mobileWithoutTelegram,
      telegramCoverage: totalMobile > 0 ? ((withTelegram / totalMobile) * 100).toFixed(1) : 0,
      canCheckMore: mobileWithoutTelegram,
    });
    
  } catch (error) {
    console.error('Error fetching Telegram stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

// Функция проверки через Telegram MTProto
async function checkPhonesTelegram(
  phones: Array<{ id: string; phone: string }>,
  config: { apiId: number; apiHash: string; session: string }
): Promise<CheckResult> {
  // Динамический импорт telegram библиотеки
  const { TelegramClient, Api } = await import('telegram');
  const { StringSession } = await import('telegram/sessions');
  const bigInt = (await import('big-integer')).default;
  
  const result: CheckResult = {
    total: phones.length,
    checked: 0,
    withTelegram: 0,
    withoutTelegram: 0,
    errors: 0,
    details: [],
  };
  
  try {
    const client = new TelegramClient(
      new StringSession(config.session),
      config.apiId,
      config.apiHash,
      { connectionRetries: 3 }
    );
    
    await client.connect();
    
    // Проверяем пачками по 100 номеров
    const batchSize = 100;
    for (let i = 0; i < phones.length; i += batchSize) {
      const batch = phones.slice(i, i + batchSize);
      
      try {
        // Формируем контакты для импорта используя Api класс
        const contacts = batch.map((p, idx) => new Api.InputPhoneContact({
          clientId: bigInt(idx),
          phone: p.phone.replace(/[^\d+]/g, ''), // Очищаем номер
          firstName: `Lead_${p.id.slice(0, 8)}`,
          lastName: '',
        }));
        
        // Импортируем контакты
        const imported = await client.invoke(
          new Api.contacts.ImportContacts({ contacts })
        );
        
        // Обрабатываем результаты
        const userMap = new Map();
        if (imported.users) {
          for (const user of imported.users) {
            if ('phone' in user && user.phone) {
              userMap.set(user.phone, {
                id: user.id?.toString(),
                username: 'username' in user ? user.username : undefined,
              });
            }
          }
        }
        
        // Заполняем результаты
        for (const p of batch) {
          const cleanPhone = p.phone.replace(/[^\d]/g, '');
          const telegramUser = userMap.get(cleanPhone) || userMap.get(`+${cleanPhone}`);
          
          result.checked++;
          
          if (telegramUser) {
            result.withTelegram++;
            result.details.push({
              leadId: p.id,
              phone: p.phone,
              hasTelegram: true,
              telegramId: telegramUser.id,
              username: telegramUser.username,
            });
          } else {
            result.withoutTelegram++;
            result.details.push({
              leadId: p.id,
              phone: p.phone,
              hasTelegram: false,
            });
          }
        }
        
        // Удаляем импортированные контакты чтобы не засорять
        if (imported.users && imported.users.length > 0) {
          try {
            const userIds = (imported.users as any[])
              .filter((u) => 'accessHash' in u && u.accessHash)
              .map((u) => new Api.InputUser({
                userId: u.id,
                accessHash: u.accessHash || bigInt(0),
              }));
            
            if (userIds.length > 0) {
              await client.invoke(
                new Api.contacts.DeleteContacts({ id: userIds })
              );
            }
          } catch (e) {
            // Игнорируем ошибки удаления
          }
        }
        
        // Пауза между пачками
        if (i + batchSize < phones.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (batchError) {
        console.error(`Error processing batch ${i}:`, batchError);
        result.errors += batch.length;
      }
    }
    
    await client.disconnect();
    
  } catch (error) {
    console.error('Telegram client error:', error);
    throw error;
  }
  
  return result;
}

