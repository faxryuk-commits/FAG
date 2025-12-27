import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { detectPhoneType, normalizePhone, analyzePhone } from '@/lib/crm/phone-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 секунд для импорта

// POST - Импорт лидов
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { source } = await request.json();
    
    console.log(`[Import] Starting import from: ${source}`);
    
    if (source === 'amocrm') {
      return await importAmoCRM();
    } else if (source === 'google_maps') {
      return await importGoogleMaps();
    } else {
      return NextResponse.json({ error: 'Unknown source' }, { status: 400 });
    }
    
  } catch (error) {
    console.error('[Import] Fatal error:', error);
    return NextResponse.json({ 
      error: 'Import failed',
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}

// Импорт из AmoCRM Excel
async function importAmoCRM() {
  const startTime = Date.now();
  
  // Читаем Excel файл
  const filePath = path.join(process.cwd(), 'public', 'amocrm_export_contacts_2025-12-27.xlsx');
  
  console.log(`[Import] Looking for file: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`[Import] File not found: ${filePath}`);
    return NextResponse.json({ 
      error: 'AmoCRM file not found',
      path: filePath,
    }, { status: 404 });
  }
  
  console.log(`[Import] File found, reading...`);
  
  let workbook;
  try {
    workbook = XLSX.readFile(filePath);
  } catch (xlsxError) {
    console.error(`[Import] Error reading Excel:`, xlsxError);
    return NextResponse.json({ 
      error: 'Failed to read Excel file',
      details: String(xlsxError),
    }, { status: 500 });
  }
  
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const contacts = XLSX.utils.sheet_to_json(sheet);
  
  console.log(`[Import] Found ${contacts.length} contacts in sheet "${sheetName}"`);
  
  // Статистика по типам телефонов
  let stats = {
    imported: 0,
    skipped: 0,
    errors: 0,
    mobilePhones: 0,
    landlinePhones: 0,
    unknownPhones: 0,
    noContact: 0,
  };
  
  const errorDetails: string[] = [];
  
  for (const contact of contacts as any[]) {
    try {
      // Извлекаем данные
      const phoneData = getPhoneWithType(contact);
      const email = getEmail(contact);
      
      // Пропускаем если нет контактов
      if (!phoneData.phone && !email) {
        stats.skipped++;
        stats.noContact++;
        continue;
      }
      
      // Статистика по типам телефонов
      if (phoneData.type === 'mobile') stats.mobilePhones++;
      else if (phoneData.type === 'landline') stats.landlinePhones++;
      else if (phoneData.phone) stats.unknownPhones++;
      
      const segment = determineSegment(contact);
      const score = calculateScore(contact, phoneData.phone, email, phoneData.type);
      
      // Создаём или обновляем лида
      await prisma.lead.upsert({
        where: {
          source_sourceId: {
            source: 'amocrm',
            sourceId: String(contact.ID || contact['ID'] || Date.now()),
          },
        },
        create: {
          name: contact['Наименование'] || contact['Название'] || 
                `${contact['Имя'] || ''} ${contact['Фамилия'] || ''}`.trim() || null,
          firstName: contact['Имя'] || null,
          lastName: contact['Фамилия'] || null,
          company: contact['Компания'] || contact['Организация'] || null,
          position: contact['Должность (контакт)'] || contact['Должность'] || null,
          phone: phoneData.phone,
          phoneType: phoneData.type,
          email,
          telegram: extractTelegram(contact),
          source: 'amocrm',
          sourceId: String(contact.ID || contact['ID'] || Date.now()),
          score,
          segment,
          tags: extractTags(contact),
          status: 'new',
          amoCrmData: contact,
        },
        update: {
          name: contact['Наименование'] || contact['Название'] || 
                `${contact['Имя'] || ''} ${contact['Фамилия'] || ''}`.trim() || null,
          phone: phoneData.phone,
          phoneType: phoneData.type,
          email,
          company: contact['Компания'] || contact['Организация'] || null,
          score,
          segment,
        },
      });
      
      stats.imported++;
      
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Import] Error importing contact:`, error);
      errorDetails.push(errMsg);
      stats.errors++;
      
      // Прекращаем если слишком много ошибок
      if (stats.errors > 50) {
        console.error(`[Import] Too many errors, stopping`);
        break;
      }
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log(`[Import] Complete:`, stats);
  
  return NextResponse.json({
    success: stats.errors < stats.imported,
    source: 'amocrm',
    ...stats,
    total: contacts.length,
    duration,
    errorSamples: errorDetails.slice(0, 5),
  });
}

// Импорт из базы ресторанов
async function importGoogleMaps() {
  const startTime = Date.now();
  
  // Получаем рестораны с контактами
  const restaurants = await prisma.restaurant.findMany({
    where: {
      isArchived: false,
      isActive: true,
      OR: [
        { phone: { not: null } },
        { email: { not: null } },
      ],
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      website: true,
      city: true,
      country: true,
      cuisine: true,
      rating: true,
    },
  });
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const restaurant of restaurants) {
    try {
      // Проверяем, есть ли уже такой лид
      const existingLead = await prisma.lead.findFirst({
        where: {
          restaurantId: restaurant.id,
        },
      });
      
      if (existingLead) {
        skipped++;
        continue;
      }
      
      // Определяем скоринг
      let score = 30; // Базовый
      if (restaurant.phone) score += 20;
      if (restaurant.email) score += 15;
      if (restaurant.website) score += 10;
      if (restaurant.rating && restaurant.rating >= 4) score += 15;
      
      // Создаём лида
      await prisma.lead.create({
        data: {
          name: restaurant.name,
          company: restaurant.name,
          phone: restaurant.phone,
          email: restaurant.email,
          source: 'google_maps',
          sourceId: restaurant.id,
          restaurantId: restaurant.id,
          score: Math.min(score, 100),
          segment: score >= 70 ? 'hot' : score >= 50 ? 'warm' : 'cold',
          tags: [
            restaurant.city,
            restaurant.country,
            ...(restaurant.cuisine || []),
          ].filter(Boolean) as string[],
          status: 'new',
        },
      });
      
      imported++;
      
    } catch (error) {
      console.error(`Error importing restaurant ${restaurant.id}:`, error);
      errors++;
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  return NextResponse.json({
    success: true,
    source: 'google_maps',
    imported,
    skipped,
    errors,
    total: restaurants.length,
    duration,
  });
}

// Вспомогательные функции

// Получить телефон с определением типа
function getPhoneWithType(contact: any): { phone: string | null; type: string | null } {
  // Приоритет: мобильный > рабочий > другой
  const phoneFields = [
    { field: 'Мобильный телефон', expectedType: 'mobile' },
    { field: 'Рабочий телефон', expectedType: null },
    { field: 'Рабочий прямой телефон', expectedType: null },
    { field: 'Телефон', expectedType: null },
    { field: 'Phone', expectedType: null },
    { field: 'Домашний телефон', expectedType: 'landline' },
    { field: 'Другой телефон', expectedType: null },
  ];
  
  for (const { field, expectedType } of phoneFields) {
    const phone = contact[field];
    if (phone) {
      const normalized = normalizePhone(String(phone));
      if (normalized.length >= 10) {
        const detectedType = expectedType || detectPhoneType(normalized);
        return { phone: normalized, type: detectedType };
      }
    }
  }
  
  // Поиск по всем полям которые могут содержать телефон
  for (const [key, value] of Object.entries(contact)) {
    if (key.toLowerCase().includes('телефон') || key.toLowerCase().includes('phone')) {
      if (value && typeof value === 'string' || typeof value === 'number') {
        const normalized = normalizePhone(String(value));
        if (normalized.length >= 10) {
          return { phone: normalized, type: detectPhoneType(normalized) };
        }
      }
    }
  }
  
  return { phone: null, type: null };
}

// Старая функция для обратной совместимости
function getPhone(contact: any): string | null {
  return getPhoneWithType(contact).phone;
}

function getEmail(contact: any): string | null {
  return contact['Рабочий email'] || 
         contact['Личный email'] || 
         contact['Другой email'] || 
         null;
}

function determineSegment(contact: any): string {
  const company = (contact['Компания'] || '').toLowerCase();
  const deals = (contact['Сделки'] || '').toLowerCase();
  
  if (company.includes('сеть') || company.includes('group')) return 'enterprise';
  if (deals.includes('заявка')) return 'hot';
  if (company) return 'warm';
  return 'cold';
}

function calculateScore(contact: any, phone: string | null, email: string | null, phoneType?: string | null): number {
  let score = 0;
  
  // Телефон: мобильный важнее стационарного
  if (phone) {
    if (phoneType === 'mobile') {
      score += 25; // Мобильный - можно SMS/WhatsApp/Telegram
    } else if (phoneType === 'landline') {
      score += 10; // Стационарный - только звонок
    } else {
      score += 15; // Неизвестный
    }
  }
  
  if (email) score += 15;
  if (contact['Компания'] || contact['Организация']) score += 25;
  if (contact['Сделки']) score += 20;
  if (contact['Whatsgroup_WZ (контакт)'] || contact['Telegram']) score += 10;
  
  return Math.min(score, 100);
}

function extractTelegram(contact: any): string | null {
  // Ищем telegram в разных полях
  const telegramFields = [
    'Whatsgroup_WZ (контакт)',
    'Telegram',
    'telegram',
    'Телеграм',
  ];
  
  for (const field of telegramFields) {
    const value = contact[field];
    if (value && typeof value === 'string') {
      if (value.startsWith('@')) return value;
      if (value.startsWith('t.me/')) return '@' + value.replace('t.me/', '');
      if (value.match(/^[a-zA-Z0-9_]{5,}$/)) return '@' + value;
    }
  }
  
  return null;
}

function extractTags(contact: any): string[] {
  const tags: string[] = [];
  
  if (contact['Теги']) {
    tags.push(...String(contact['Теги']).split(',').map((t: string) => t.trim()));
  }
  
  // Определяем страну по телефону
  const phone = getPhone(contact);
  if (phone) {
    if (phone.startsWith('+998') || phone.startsWith('998')) tags.push('Узбекистан');
    else if (phone.startsWith('+77') || phone.startsWith('77')) tags.push('Казахстан');
    else if (phone.startsWith('+7')) tags.push('Россия');
  }
  
  if (contact['Сделки']?.includes('Заявка с сайта')) tags.push('website_lead');
  if (contact['Сделки']?.includes('Telegram')) tags.push('telegram_lead');
  
  return [...new Set(tags)]; // Уникальные
}

