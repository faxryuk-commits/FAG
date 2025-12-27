import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';
import { detectPhoneType, normalizePhone } from '@/lib/crm/phone-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST - Импорт через загрузку файла
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    
    console.log(`[Import] File received: ${file.name}, size: ${file.size}`);
    
    // Читаем файл в ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Парсим Excel
    let workbook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch (xlsxError) {
      console.error('[Import] Error parsing Excel:', xlsxError);
      return NextResponse.json({ 
        error: 'Failed to parse Excel file',
        details: String(xlsxError),
      }, { status: 400 });
    }
    
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const contacts = XLSX.utils.sheet_to_json(sheet);
    
    console.log(`[Import] Found ${contacts.length} contacts in sheet "${sheetName}"`);
    
    // Если пусто - показываем структуру для отладки
    if (contacts.length === 0) {
      return NextResponse.json({ 
        error: 'No contacts found in file',
        sheets: workbook.SheetNames,
      }, { status: 400 });
    }
    
    // Показываем первую строку для отладки
    console.log('[Import] First row keys:', Object.keys(contacts[0] as object));
    
    // Статистика
    let stats = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      mobilePhones: 0,
      landlinePhones: 0,
      noPhone: 0,
    };
    
    const errorDetails: string[] = [];
    
    for (const contact of contacts as any[]) {
      try {
        // Извлекаем данные
        const phoneData = getPhoneWithType(contact);
        const email = getEmail(contact);
        const name = getName(contact);
        const company = getCompany(contact);
        
        // Пропускаем если нет контактов
        if (!phoneData.phone && !email && !name) {
          stats.skipped++;
          continue;
        }
        
        // Статистика телефонов
        if (phoneData.type === 'mobile') stats.mobilePhones++;
        else if (phoneData.type === 'landline') stats.landlinePhones++;
        else if (!phoneData.phone) stats.noPhone++;
        
        // Генерируем уникальный ID
        const sourceId = String(
          contact.ID || 
          contact['ID'] || 
          contact['id'] || 
          contact['№'] ||
          `${name}_${phoneData.phone || email || Date.now()}`
        );
        
        const segment = determineSegment(contact, phoneData.type);
        const score = calculateScore(contact, phoneData.phone, email, phoneData.type);
        
        // Создаём или обновляем лида
        const result = await prisma.lead.upsert({
          where: {
            source_sourceId: {
              source: 'amocrm',
              sourceId,
            },
          },
          create: {
            name,
            firstName: contact['Имя'] || contact['First Name'] || null,
            lastName: contact['Фамилия'] || contact['Last Name'] || null,
            company,
            position: contact['Должность'] || contact['Position'] || null,
            phone: phoneData.phone,
            phoneType: phoneData.type,
            email,
            telegram: extractTelegram(contact),
            source: 'amocrm',
            sourceId,
            score,
            segment,
            tags: extractTags(contact),
            status: 'new',
            amoCrmData: contact,
          },
          update: {
            name,
            phone: phoneData.phone,
            phoneType: phoneData.type,
            email,
            company,
            score,
            segment,
          },
        });
        
        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          stats.imported++;
        } else {
          stats.updated++;
        }
        
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[Import] Error:', errMsg);
        errorDetails.push(errMsg);
        stats.errors++;
        
        if (stats.errors > 100) {
          console.error('[Import] Too many errors, stopping');
          break;
        }
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('[Import] Complete:', stats);
    
    return NextResponse.json({
      success: stats.errors < stats.imported + stats.updated,
      source: 'amocrm',
      ...stats,
      total: contacts.length,
      duration,
      errorSamples: errorDetails.slice(0, 5),
    });
    
  } catch (error) {
    console.error('[Import] Fatal error:', error);
    return NextResponse.json({ 
      error: 'Import failed',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

// Вспомогательные функции

function getPhoneWithType(contact: any): { phone: string | null; type: string | null } {
  const phoneFields = [
    'Мобильный телефон', 'Рабочий телефон', 'Телефон', 'Phone', 
    'phone', 'mobile', 'Mobile', 'Мобильный', 'Рабочий прямой телефон'
  ];
  
  for (const field of phoneFields) {
    const phone = contact[field];
    if (phone) {
      const normalized = normalizePhone(String(phone));
      if (normalized.length >= 10) {
        return { phone: normalized, type: detectPhoneType(normalized) };
      }
    }
  }
  
  // Ищем по всем полям
  for (const [key, value] of Object.entries(contact)) {
    if (key.toLowerCase().includes('телефон') || key.toLowerCase().includes('phone')) {
      if (value && (typeof value === 'string' || typeof value === 'number')) {
        const normalized = normalizePhone(String(value));
        if (normalized.length >= 10) {
          return { phone: normalized, type: detectPhoneType(normalized) };
        }
      }
    }
  }
  
  return { phone: null, type: null };
}

function getEmail(contact: any): string | null {
  const emailFields = ['Email', 'email', 'Рабочий email', 'Личный email', 'E-mail'];
  
  for (const field of emailFields) {
    const email = contact[field];
    if (email && String(email).includes('@')) {
      return String(email).trim();
    }
  }
  
  return null;
}

function getName(contact: any): string | null {
  return contact['Наименование'] || 
         contact['Название'] || 
         contact['Name'] || 
         contact['name'] ||
         `${contact['Имя'] || ''} ${contact['Фамилия'] || ''}`.trim() || 
         null;
}

function getCompany(contact: any): string | null {
  return contact['Компания'] || 
         contact['Организация'] || 
         contact['Company'] || 
         contact['company'] ||
         null;
}

function extractTelegram(contact: any): string | null {
  const telegramFields = ['Telegram', 'telegram', 'Телеграм', 'Whatsgroup_WZ (контакт)'];
  
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

function determineSegment(contact: any, phoneType: string | null): string {
  const company = String(contact['Компания'] || contact['Company'] || '').toLowerCase();
  const deals = String(contact['Сделки'] || '').toLowerCase();
  
  if (company.includes('сеть') || company.includes('group') || company.includes('chain')) {
    return 'enterprise';
  }
  if (deals.includes('заявка') || deals.includes('demo')) {
    return 'hot';
  }
  // Мобильный телефон = теплее
  if (phoneType === 'mobile') {
    return company ? 'warm' : 'cold';
  }
  return 'cold';
}

function calculateScore(contact: any, phone: string | null, email: string | null, phoneType: string | null): number {
  let score = 0;
  
  if (phone) {
    if (phoneType === 'mobile') score += 25;
    else if (phoneType === 'landline') score += 10;
    else score += 15;
  }
  
  if (email) score += 15;
  if (contact['Компания'] || contact['Company']) score += 25;
  if (contact['Сделки']) score += 20;
  if (contact['Telegram'] || contact['Whatsgroup_WZ (контакт)']) score += 10;
  
  return Math.min(score, 100);
}

function extractTags(contact: any): string[] {
  const tags: string[] = [];
  
  if (contact['Теги']) {
    tags.push(...String(contact['Теги']).split(',').map((t: string) => t.trim()));
  }
  
  const phone = getPhoneWithType(contact).phone;
  if (phone) {
    if (phone.startsWith('+998') || phone.startsWith('998')) tags.push('Узбекистан');
    else if (phone.startsWith('+77') || phone.startsWith('77')) tags.push('Казахстан');
    else if (phone.startsWith('+7')) tags.push('Россия');
  }
  
  return [...new Set(tags)];
}

