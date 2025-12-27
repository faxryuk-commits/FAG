/**
 * Скрипт импорта лидов из AmoCRM Excel
 * Запуск: npx ts-node scripts/import-amocrm.ts
 */

import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import path from 'path';

const prisma = new PrismaClient();

interface AmoCrmContact {
  ID: string;
  'Тип': string;
  'Наименование': string;
  'Имя': string;
  'Фамилия': string;
  'Компания': string;
  'Дата создания': string;
  'Создатель': string;
  'Дата изменения': string;
  'Автор изменения': string;
  'Теги': string;
  'Ближайшая задача': string;
  'Ответственный': string;
  'Сделки': string;
  'Должность (контакт)': string;
  'Рабочий email': string;
  'Личный email': string;
  'Другой email': string;
  'Рабочий телефон': string;
  'Рабочий прямой телефон': string;
  'Мобильный телефон': string;
  'Факс': string;
  'Домашний телефон': string;
  'Другой телефон': string;
  'Адрес (компания)': string;
  'Web (компания)': string;
  'Whatsgroup_WZ (контакт)': string;
  'Примечание 1': string;
  'Примечание 2': string;
  'Примечание 3': string;
  'Примечание 4': string;
  'Примечание 5': string;
}

// Нормализация телефона
function normalizePhone(phone: string | undefined): string | null {
  if (!phone) return null;
  
  // Убираем все кроме цифр и +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Убираем кавычки
  cleaned = cleaned.replace(/'/g, '');
  
  if (cleaned.length < 7) return null;
  
  return cleaned;
}

// Получить первый доступный email
function getEmail(contact: AmoCrmContact): string | null {
  return contact['Рабочий email'] || 
         contact['Личный email'] || 
         contact['Другой email'] || 
         null;
}

// Получить первый доступный телефон
function getPhone(contact: AmoCrmContact): string | null {
  const phones = [
    contact['Мобильный телефон'],
    contact['Рабочий телефон'],
    contact['Рабочий прямой телефон'],
    contact['Домашний телефон'],
    contact['Другой телефон'],
  ];
  
  for (const phone of phones) {
    const normalized = normalizePhone(phone);
    if (normalized) return normalized;
  }
  
  return null;
}

// Определить сегмент по данным
function determineSegment(contact: AmoCrmContact): string {
  const company = contact['Компания']?.toLowerCase() || '';
  const deals = contact['Сделки']?.toLowerCase() || '';
  
  // Enterprise признаки
  if (company.includes('сеть') || company.includes('network') || 
      company.includes('group') || company.includes('холдинг')) {
    return 'enterprise';
  }
  
  // Горячий лид - есть сделка
  if (deals && deals.includes('заявка')) {
    return 'hot';
  }
  
  // Тёплый - есть компания
  if (company) {
    return 'warm';
  }
  
  return 'cold';
}

// Рассчитать скоринг
function calculateScore(contact: AmoCrmContact): number {
  let score = 0;
  
  // Есть телефон +20
  if (getPhone(contact)) score += 20;
  
  // Есть email +15
  if (getEmail(contact)) score += 15;
  
  // Есть компания +25
  if (contact['Компания']) score += 25;
  
  // Есть сделка +20
  if (contact['Сделки']) score += 20;
  
  // Есть Telegram/WhatsApp +10
  if (contact['Whatsgroup_WZ (контакт)']) score += 10;
  
  // Недавняя активность +10
  const lastChange = contact['Дата изменения'];
  if (lastChange) {
    const changeDate = parseRussianDate(lastChange);
    const daysSince = (Date.now() - changeDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 30) score += 10;
  }
  
  return Math.min(score, 100);
}

// Парсинг даты в формате "24.12.2025 23:20:01"
function parseRussianDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  
  const parts = dateStr.split(' ');
  const dateParts = parts[0].split('.');
  const timeParts = parts[1]?.split(':') || ['00', '00', '00'];
  
  return new Date(
    parseInt(dateParts[2]), // год
    parseInt(dateParts[1]) - 1, // месяц (0-11)
    parseInt(dateParts[0]), // день
    parseInt(timeParts[0]), // часы
    parseInt(timeParts[1]), // минуты
    parseInt(timeParts[2] || '0') // секунды
  );
}

// Определить страну по телефону
function getCountryByPhone(phone: string | null): string | null {
  if (!phone) return null;
  
  if (phone.startsWith('+998') || phone.startsWith('998')) return 'Узбекистан';
  if (phone.startsWith('+77') || phone.startsWith('77')) return 'Казахстан';
  if (phone.startsWith('+7') || phone.startsWith('7')) return 'Россия';
  if (phone.startsWith('+971')) return 'ОАЭ';
  if (phone.startsWith('+962')) return 'Иордания';
  if (phone.startsWith('+91')) return 'Индия';
  
  return null;
}

async function importContacts() {
  console.log('🚀 Начинаем импорт AmoCRM...\n');
  
  // Читаем Excel файл
  const filePath = path.join(process.cwd(), 'public', 'amocrm_export_contacts_2025-12-27.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Конвертируем в JSON
  const contacts: AmoCrmContact[] = XLSX.utils.sheet_to_json(sheet);
  
  console.log(`📊 Найдено контактов: ${contacts.length}\n`);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  const stats = {
    byCountry: {} as Record<string, number>,
    bySegment: {} as Record<string, number>,
    withEmail: 0,
    withPhone: 0,
    withCompany: 0,
  };
  
  for (const contact of contacts) {
    try {
      const phone = getPhone(contact);
      const email = getEmail(contact);
      
      // Пропускаем если нет контактов
      if (!phone && !email) {
        skipped++;
        continue;
      }
      
      const segment = determineSegment(contact);
      const score = calculateScore(contact);
      const country = getCountryByPhone(phone);
      
      // Обновляем статистику
      if (country) {
        stats.byCountry[country] = (stats.byCountry[country] || 0) + 1;
      }
      stats.bySegment[segment] = (stats.bySegment[segment] || 0) + 1;
      if (email) stats.withEmail++;
      if (phone) stats.withPhone++;
      if (contact['Компания']) stats.withCompany++;
      
      // Собираем все данные из AmoCRM
      const amoCrmData = {
        originalId: contact.ID,
        type: contact['Тип'],
        createdAt: contact['Дата создания'],
        creator: contact['Создатель'],
        updatedAt: contact['Дата изменения'],
        updatedBy: contact['Автор изменения'],
        responsible: contact['Ответственный'],
        deals: contact['Сделки'],
        position: contact['Должность (контакт)'],
        address: contact['Адрес (компания)'],
        website: contact['Web (компания)'],
        notes: [
          contact['Примечание 1'],
          contact['Примечание 2'],
          contact['Примечание 3'],
          contact['Примечание 4'],
          contact['Примечание 5'],
        ].filter(Boolean),
        country,
      };
      
      // Собираем теги
      const tags: string[] = [];
      if (contact['Теги']) {
        tags.push(...contact['Теги'].split(',').map(t => t.trim()));
      }
      if (country) tags.push(country);
      if (contact['Сделки']?.includes('Заявка с сайта')) tags.push('website_lead');
      if (contact['Сделки']?.includes('Telegram')) tags.push('telegram_lead');
      
      // Создаём или обновляем лида
      await prisma.lead.upsert({
        where: {
          source_sourceId: {
            source: 'amocrm',
            sourceId: contact.ID,
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
          whatsapp: contact['Whatsgroup_WZ (контакт)']?.match(/^\d/) 
            ? contact['Whatsgroup_WZ (контакт)'] 
            : null,
          source: 'amocrm',
          sourceId: contact.ID,
          score,
          segment,
          tags,
          status: 'new',
          amoCrmData,
          createdAt: parseRussianDate(contact['Дата создания']),
        },
        update: {
          name: contact['Наименование'] || `${contact['Имя'] || ''} ${contact['Фамилия'] || ''}`.trim() || null,
          phone,
          email,
          company: contact['Компания'] || null,
          score,
          segment,
          tags,
          amoCrmData,
        },
      });
      
      imported++;
      
      // Прогресс
      if (imported % 100 === 0) {
        console.log(`  Импортировано: ${imported}/${contacts.length}`);
      }
      
    } catch (error: any) {
      console.error(`❌ Ошибка при импорте ${contact.ID}:`, error.message);
      errors++;
    }
  }
  
  console.log('\n✅ Импорт завершён!\n');
  console.log('📈 Статистика:');
  console.log(`   Импортировано: ${imported}`);
  console.log(`   Пропущено (нет контактов): ${skipped}`);
  console.log(`   Ошибок: ${errors}`);
  console.log(`\n   С email: ${stats.withEmail}`);
  console.log(`   С телефоном: ${stats.withPhone}`);
  console.log(`   С компанией: ${stats.withCompany}`);
  console.log('\n   По странам:');
  Object.entries(stats.byCountry).forEach(([country, count]) => {
    console.log(`     ${country}: ${count}`);
  });
  console.log('\n   По сегментам:');
  Object.entries(stats.bySegment).forEach(([segment, count]) => {
    console.log(`     ${segment}: ${count}`);
  });
}

// Запуск
importContacts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

