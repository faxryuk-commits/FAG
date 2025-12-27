import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 секунд для импорта

// POST - Импорт лидов
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { source } = await request.json();
    
    if (source === 'amocrm') {
      return await importAmoCRM();
    } else if (source === 'google_maps') {
      return await importGoogleMaps();
    } else {
      return NextResponse.json({ error: 'Unknown source' }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ 
      error: 'Import failed',
      details: String(error),
    }, { status: 500 });
  }
}

// Импорт из AmoCRM Excel
async function importAmoCRM() {
  const startTime = Date.now();
  
  // Читаем Excel файл
  const filePath = path.join(process.cwd(), 'public', 'amocrm_export_contacts_2025-12-27.xlsx');
  
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'AmoCRM file not found' }, { status: 404 });
  }
  
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const contacts = XLSX.utils.sheet_to_json(sheet);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const contact of contacts as any[]) {
    try {
      // Извлекаем данные
      const phone = getPhone(contact);
      const email = getEmail(contact);
      
      // Пропускаем если нет контактов
      if (!phone && !email) {
        skipped++;
        continue;
      }
      
      const segment = determineSegment(contact);
      const score = calculateScore(contact, phone, email);
      
      // Создаём или обновляем лида
      await prisma.lead.upsert({
        where: {
          source_sourceId: {
            source: 'amocrm',
            sourceId: String(contact.ID),
          },
        },
        create: {
          name: contact['Наименование'] || `${contact['Имя'] || ''} ${contact['Фамилия'] || ''}`.trim() || null,
          firstName: contact['Имя'] || null,
          lastName: contact['Фамилия'] || null,
          company: contact['Компания'] || null,
          position: contact['Должность (контакт)'] || null,
          phone,
          email,
          telegram: contact['Whatsgroup_WZ (контакт)']?.startsWith('@') 
            ? contact['Whatsgroup_WZ (контакт)'] 
            : null,
          source: 'amocrm',
          sourceId: String(contact.ID),
          score,
          segment,
          tags: extractTags(contact),
          status: 'new',
          amoCrmData: contact,
        },
        update: {
          name: contact['Наименование'] || `${contact['Имя'] || ''} ${contact['Фамилия'] || ''}`.trim() || null,
          phone,
          email,
          company: contact['Компания'] || null,
          score,
          segment,
        },
      });
      
      imported++;
      
    } catch (error) {
      console.error(`Error importing contact ${contact.ID}:`, error);
      errors++;
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  return NextResponse.json({
    success: true,
    source: 'amocrm',
    imported,
    skipped,
    errors,
    total: contacts.length,
    duration,
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
function getPhone(contact: any): string | null {
  const phones = [
    contact['Мобильный телефон'],
    contact['Рабочий телефон'],
    contact['Рабочий прямой телефон'],
    contact['Домашний телефон'],
    contact['Другой телефон'],
  ];
  
  for (const phone of phones) {
    if (phone) {
      const cleaned = String(phone).replace(/[^\d+]/g, '').replace(/'/g, '');
      if (cleaned.length >= 7) return cleaned;
    }
  }
  
  return null;
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

function calculateScore(contact: any, phone: string | null, email: string | null): number {
  let score = 0;
  if (phone) score += 20;
  if (email) score += 15;
  if (contact['Компания']) score += 25;
  if (contact['Сделки']) score += 20;
  if (contact['Whatsgroup_WZ (контакт)']) score += 10;
  return Math.min(score, 100);
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

