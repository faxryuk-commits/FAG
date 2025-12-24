/**
 * Скрипт для импорта JSON файла из Apify в базу данных
 * 
 * Использование:
 * npx ts-node scripts/import-json.ts /path/to/file.json [source]
 * 
 * Примеры:
 * npx ts-node scripts/import-json.ts ~/Downloads/dataset.json google
 * npx ts-node scripts/import-json.ts ~/Downloads/dataset.json yandex
 */

import * as fs from 'fs';
import * as path from 'path';

async function importData() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('❌ Укажите путь к JSON файлу');
    console.log('Использование: npx ts-node scripts/import-json.ts /path/to/file.json [source]');
    process.exit(1);
  }

  const filePath = args[0];
  const source = args[1] || 'google';

  // Проверяем существование файла
  if (!fs.existsSync(filePath)) {
    console.log(`❌ Файл не найден: ${filePath}`);
    process.exit(1);
  }

  console.log(`📂 Загружаю файл: ${filePath}`);
  console.log(`📍 Источник: ${source}`);

  // Читаем файл
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  let data: any[];
  
  try {
    data = JSON.parse(fileContent);
  } catch (e) {
    console.log('❌ Ошибка парсинга JSON');
    process.exit(1);
  }

  if (!Array.isArray(data)) {
    console.log('❌ JSON должен быть массивом');
    process.exit(1);
  }

  console.log(`📊 Найдено записей: ${data.length}`);

  // Определяем URL API
  const apiUrl = process.env.API_URL || 'http://localhost:3000';
  
  console.log(`🚀 Отправляю на ${apiUrl}/api/import...`);
  console.log('⏳ Это может занять несколько минут...\n');

  try {
    const response = await fetch(`${apiUrl}/api/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, source }),
    });

    const result = await response.json();

    if (response.ok) {
      console.log('\n✅ Импорт завершён!');
      console.log(`📊 Статистика:`);
      console.log(`   Всего: ${result.stats.total}`);
      console.log(`   Обработано: ${result.stats.processed}`);
      console.log(`   Ошибок: ${result.stats.errors}`);
      console.log(`   Пропущено: ${result.stats.skipped}`);
      
      if (result.stats.errorMessages?.length > 0) {
        console.log('\n⚠️ Примеры ошибок:');
        result.stats.errorMessages.forEach((msg: string) => {
          console.log(`   - ${msg}`);
        });
      }
    } else {
      console.log(`❌ Ошибка: ${result.error}`);
    }
  } catch (error) {
    console.log(`❌ Ошибка соединения: ${error}`);
    console.log('\n💡 Убедитесь что сервер запущен (npm run dev)');
  }
}

importData();

