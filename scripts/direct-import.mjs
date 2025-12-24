/**
 * Прямой импорт JSON в базу (без API)
 * 
 * Запуск: node scripts/direct-import.mjs /path/to/file.json
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Маппинг ключевых слов на категории
const CUISINE_MAPPING = {
  'Узбекская кухня': ['uzbek', 'plov', 'samsa', 'lagman', 'shurpa', 'chaikhana', 'плов', 'самса', 'лагман'],
  'Европейская кухня': ['european', 'italian', 'french', 'mediterranean', 'continental'],
  'Азиатская кухня': ['asian', 'chinese', 'japanese', 'korean', 'thai', 'vietnamese', 'wok', 'sushi'],
  'Кафе': ['cafe', 'coffee', 'кафе', 'кофе'],
  'Ресторан': ['restaurant', 'ресторан', 'dining'],
  'Фастфуд': ['fast food', 'burger', 'pizza', 'фастфуд', 'бургер'],
  'Бар': ['bar', 'pub', 'бар', 'паб'],
};

function normalizeCuisine(categories, name) {
  const result = new Set();
  const allText = [...categories, name].join(' ').toLowerCase();
  
  // Добавляем оригинальные категории
  for (const cat of categories) {
    if (cat && typeof cat === 'string' && cat.length < 50) {
      result.add(cat.trim());
    }
  }
  
  // Добавляем стандартизированные на основе ключевых слов
  for (const [standard, keywords] of Object.entries(CUISINE_MAPPING)) {
    for (const keyword of keywords) {
      if (allText.includes(keyword.toLowerCase())) {
        result.add(standard);
        break;
      }
    }
  }
  
  return [...result].slice(0, 10);
}

function generateSlug(name, sourceId) {
  const base = name
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s]/gi, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
  const suffix = sourceId.substring(0, 8);
  return `${base}-${suffix}`;
}

function normalizeCity(item) {
  let city = item.city || '';
  
  if (!city || city === 'null') {
    if (item.state?.includes('Tashkent')) city = 'Ташкент';
    else if (item.address?.includes('Tashkent')) city = 'Ташкент';
    else if (item.neighborhood) city = item.neighborhood;
    else city = 'Неизвестно';
  }
  
  // Нормализация
  const cityMap = {
    'Tashkent': 'Ташкент',
    'Toshkent': 'Ташкент', 
    'Тоshkent': 'Ташкент',
    'Dustlik': 'Дустлик',
  };
  
  return cityMap[city] || city;
}

async function importFile(filePath) {
  console.log(`📂 Загружаю: ${filePath}`);
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  console.log(`📊 Записей в файле: ${data.length}`);
  
  let processed = 0;
  let errors = 0;
  let skipped = 0;
  let duplicates = 0;

  const startTime = Date.now();

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    
    try {
      // Пропускаем без названия или координат
      if (!item.title || !item.location?.lat || !item.location?.lng) {
        skipped++;
        continue;
      }

      const sourceId = item.placeId || item.cid || `gm-${Date.now()}-${i}`;
      
      // Проверяем дубликат
      const existing = await prisma.restaurant.findFirst({
        where: { source: 'google', sourceId },
      });
      
      if (existing) {
        duplicates++;
        continue;
      }

      // Подготовка данных
      const categories = item.categoryName ? [item.categoryName] : [];
      const cuisine = normalizeCuisine(categories, item.title);
      
      let images = [];
      if (item.imageUrls) images = item.imageUrls;
      else if (item.imageUrl) images = [item.imageUrl];
      else if (item.thumbnail) images = [item.thumbnail];

      // Создаём запись
      await prisma.restaurant.create({
        data: {
          name: item.title,
          slug: generateSlug(item.title, sourceId),
          address: item.address || item.street || '',
          city: normalizeCity(item),
          country: item.countryCode === 'UZ' ? 'Узбекистан' : item.countryCode || null,
          latitude: item.location.lat,
          longitude: item.location.lng,
          phone: item.phone || item.phoneUnformatted || null,
          website: item.website || null,
          rating: item.totalScore || item.rating || null,
          ratingCount: item.reviewsCount || 0,
          priceRange: item.price || null,
          cuisine,
          images: images.slice(0, 10),
          source: 'google',
          sourceId,
          sourceUrl: item.url || null,
          isActive: true,
          isVerified: false,
          lastSynced: new Date(),
        },
      });
      
      processed++;
      
      // Прогресс каждые 100 записей
      if (processed % 100 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = (processed / parseFloat(elapsed)).toFixed(1);
        console.log(`  ✓ ${processed} обработано (${rate}/сек) | ${errors} ошибок | ${duplicates} дубликатов`);
      }
    } catch (error) {
      errors++;
      if (errors <= 5) {
        console.log(`  ✗ Ошибка "${item.title}": ${error.message?.substring(0, 80)}`);
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ ИМПОРТ ЗАВЕРШЁН');
  console.log('='.repeat(50));
  console.log(`📊 Всего в файле:    ${data.length}`);
  console.log(`✓  Импортировано:    ${processed}`);
  console.log(`⏭  Пропущено:        ${skipped}`);
  console.log(`🔄 Дубликатов:       ${duplicates}`);
  console.log(`✗  Ошибок:           ${errors}`);
  console.log(`⏱  Время:            ${elapsed} сек`);
  console.log('='.repeat(50));
}

// Запуск
const filePath = process.argv[2];

if (!filePath) {
  console.log('❌ Укажите путь к JSON файлу');
  console.log('Использование: node scripts/direct-import.mjs /path/to/file.json');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.log(`❌ Файл не найден: ${filePath}`);
  process.exit(1);
}

importFile(filePath)
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });

