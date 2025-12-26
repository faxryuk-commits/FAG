import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

// Функция для поиска ближайшего совпадения
function findBestMatch(
  enrichedItem: any,
  candidates: Array<{ id: string; name: string; latitude: number; longitude: number }>
): string | null {
  const itemLat = enrichedItem.location?.lat || enrichedItem.latitude;
  const itemLng = enrichedItem.location?.lng || enrichedItem.longitude;
  const itemName = (enrichedItem.title || enrichedItem.name || '').toLowerCase();

  if (!itemLat || !itemLng) return null;

  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    // Расстояние в метрах
    const distance = Math.sqrt(
      Math.pow((itemLat - candidate.latitude) * 111000, 2) +
      Math.pow((itemLng - candidate.longitude) * 111000 * Math.cos(itemLat * Math.PI / 180), 2)
    );

    // Сходство названий
    const candName = candidate.name.toLowerCase();
    const nameMatch = itemName.includes(candName) || candName.includes(itemName) ||
      levenshteinSimilarity(itemName, candName) > 0.5;

    // Если близко (<100м) и название похоже
    if (distance < 100 && nameMatch) {
      const score = 1 / (distance + 1);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate.id;
      }
    }
  }

  return bestMatch;
}

// Расстояние Левенштейна
function levenshteinSimilarity(a: string, b: string): number {
  if (a.length === 0) return b.length === 0 ? 1 : 0;
  if (b.length === 0) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[b.length][a.length];
  const maxLen = Math.max(a.length, b.length);
  return 1 - distance / maxLen;
}

// POST - применить результаты обогащения
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json({ error: 'jobId required' }, { status: 400 });
    }

    // Получить задачу
    const job = await prisma.syncJob.findUnique({
      where: { id: jobId },
    });

    if (!job || !job.stats) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const stats = job.stats as any;
    const runId = stats.runId;

    if (!runId) {
      return NextResponse.json({ error: 'No runId in job stats' }, { status: 400 });
    }

    // Получить результаты из Apify
    const dataset = await client.dataset(runId).listItems();
    const items = dataset.items as any[];

    if (!items || items.length === 0) {
      return NextResponse.json({ message: 'No items to process', updated: 0 });
    }

    // Получить все импортированные записи без фото
    const candidates = await prisma.restaurant.findMany({
      where: {
        sourceId: { startsWith: 'import-' },
        OR: [
          { images: { equals: [] } },
          { images: { equals: null } },
        ],
      },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
      },
    });

    let updated = 0;
    let notMatched = 0;

    for (const item of items as any[]) {
      const matchId = findBestMatch(item, candidates);

      if (!matchId) {
        notMatched++;
        continue;
      }

      // Подготовить данные для обновления
      const updateData: any = {};

      // Фото
      if (item.imageUrls && item.imageUrls.length > 0) {
        updateData.images = item.imageUrls.slice(0, 10);
      } else if (item.photos && item.photos.length > 0) {
        updateData.images = item.photos.map((p: any) => p.photoUrl || p.url || p).slice(0, 10);
      }

      // Рейтинг
      if (item.totalScore || item.rating) {
        updateData.rating = item.totalScore || item.rating;
      }

      // Количество отзывов
      if (item.reviewsCount || item.totalReviews) {
        updateData.ratingCount = item.reviewsCount || item.totalReviews;
      }

      // Телефон
      if (item.phone && !item.phone.includes('null')) {
        updateData.phone = item.phone;
      }

      // Сайт
      if (item.website) {
        updateData.website = item.website;
      }

      // Меню
      const menu = item.menu as any;
      if (menu?.url || item.menuUrl) {
        updateData.menuUrl = menu?.url || item.menuUrl;
      }

      // Цена
      if (item.price || item.priceLevel) {
        updateData.priceRange = item.price || item.priceLevel;
      }

      // Google sourceUrl
      if (item.url || item.googleMapsUri) {
        updateData.sourceUrl = item.url || item.googleMapsUri;
      }

      // Обновить запись
      if (Object.keys(updateData).length > 0) {
        updateData.lastSynced = new Date();
        
        await prisma.restaurant.update({
          where: { id: matchId },
          data: updateData,
        });

        // Добавить рабочие часы, если есть
        if (item.openingHours) {
          // Удалить старые часы
          await prisma.workingHours.deleteMany({
            where: { restaurantId: matchId },
          });

          // Добавить новые
          const hours = parseOpeningHours(item.openingHours, matchId);
          if (hours.length > 0) {
            await prisma.workingHours.createMany({ data: hours });
          }
        }

        // Добавить отзывы, если есть
        if (item.reviews && item.reviews.length > 0) {
          for (const review of item.reviews.slice(0, 10)) {
            try {
              await prisma.review.create({
                data: {
                  restaurantId: matchId,
                  source: 'google',
                  author: review.name || review.author || 'Аноним',
                  rating: review.stars || review.rating || 0,
                  text: review.text || review.snippet || '',
                  date: review.publishedAtDate ? new Date(review.publishedAtDate) : new Date(),
                  authorAvatar: review.profilePhotoUrl,
                  isLocalGuide: review.isLocalGuide || false,
                  likesCount: review.likesCount || 0,
                },
              });
            } catch {
              // Игнорируем дубликаты отзывов
            }
          }
        }

        updated++;
      }
    }

    // Обновить статус задачи
    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        stats: {
          ...stats,
          enriched: updated,
          notMatched,
        },
      },
    });

    return NextResponse.json({
      message: `Обогащено ${updated} записей`,
      updated,
      notMatched,
      totalItems: items.length,
    });
  } catch (error) {
    console.error('Error applying enrichment:', error);
    return NextResponse.json(
      { error: 'Failed to apply enrichment' },
      { status: 500 }
    );
  }
}

// Парсинг рабочих часов - улучшенная версия
function parseOpeningHours(openingHours: any, restaurantId: string) {
  const result: any[] = [];
  const dayMap: Record<string, number> = {
    'sunday': 0, 'sun': 0, 'su': 0, 'воскресенье': 0, 'вс': 0,
    'monday': 1, 'mon': 1, 'mo': 1, 'понедельник': 1, 'пн': 1,
    'tuesday': 2, 'tue': 2, 'tu': 2, 'вторник': 2, 'вт': 2,
    'wednesday': 3, 'wed': 3, 'we': 3, 'среда': 3, 'ср': 3,
    'thursday': 4, 'thu': 4, 'th': 4, 'четверг': 4, 'чт': 4,
    'friday': 5, 'fri': 5, 'fr': 5, 'пятница': 5, 'пт': 5,
    'saturday': 6, 'sat': 6, 'sa': 6, 'суббота': 6, 'сб': 6,
  };

  const processedDays = new Set<number>();

  // Если это массив строк (формат Google Maps)
  if (Array.isArray(openingHours)) {
    for (const entry of openingHours) {
      if (typeof entry === 'string') {
        // Формат: "Monday: 9:00 AM – 10:00 PM" или "Понедельник: 09:00 - 22:00"
        const match = entry.match(/^([а-яa-z]+)[\s:,]+(.+)$/i);
        if (match) {
          const dayName = match[1].toLowerCase();
          const dayNum = dayMap[dayName];
          
          if (dayNum !== undefined && !processedDays.has(dayNum)) {
            const timeRange = match[2].trim();
            const isClosed = /closed|закрыто|выходной|off|休/i.test(timeRange);
            
            if (isClosed) {
              result.push({
                restaurantId,
                dayOfWeek: dayNum,
                openTime: '00:00',
                closeTime: '00:00',
                isClosed: true,
              });
              processedDays.add(dayNum);
            } else {
              // Попробуем распарсить время
              const parsed = parseTimeRange(timeRange);
              if (parsed) {
                result.push({
                  restaurantId,
                  dayOfWeek: dayNum,
                  openTime: parsed.open,
                  closeTime: parsed.close,
                  isClosed: false,
                });
                processedDays.add(dayNum);
              }
            }
          }
        }
      } else if (typeof entry === 'object' && entry !== null) {
        // Объектный формат: { day: "Monday", hours: "9:00 AM - 10:00 PM" }
        const dayName = (entry.day || entry.dayOfWeek || '').toString().toLowerCase();
        const dayNum = dayMap[dayName] ?? (typeof entry.dayOfWeek === 'number' ? entry.dayOfWeek : null);
        
        if (dayNum !== null && !processedDays.has(dayNum)) {
          const hours = entry.hours || entry.time || entry.openingHours || '';
          const isClosed = entry.isClosed || /closed|закрыто|выходной/i.test(hours);
          
          if (isClosed) {
            result.push({
              restaurantId,
              dayOfWeek: dayNum,
              openTime: '00:00',
              closeTime: '00:00',
              isClosed: true,
            });
            processedDays.add(dayNum);
          } else {
            const parsed = parseTimeRange(hours);
            if (parsed) {
              result.push({
                restaurantId,
                dayOfWeek: dayNum,
                openTime: parsed.open,
                closeTime: parsed.close,
                isClosed: false,
              });
              processedDays.add(dayNum);
            } else if (entry.openTime && entry.closeTime) {
              // Прямые поля openTime/closeTime
              result.push({
                restaurantId,
                dayOfWeek: dayNum,
                openTime: convertTo24Hour(entry.openTime),
                closeTime: convertTo24Hour(entry.closeTime),
                isClosed: false,
              });
              processedDays.add(dayNum);
            }
          }
        }
      }
    }
  }

  return result;
}

// Парсинг диапазона времени
function parseTimeRange(timeStr: string): { open: string; close: string } | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  
  // 24/7 или круглосуточно
  if (/24\s*[\/]\s*7|24\s*hours|круглосуточно/i.test(timeStr)) {
    return { open: '00:00', close: '23:59' };
  }
  
  // Разделители: –, -, —, to, до
  const parts = timeStr.split(/\s*[–\-—]\s*|\s+to\s+|\s+до\s+/i).map(t => t.trim());
  
  if (parts.length >= 2) {
    const open = convertTo24Hour(parts[0]);
    const close = convertTo24Hour(parts[1]);
    
    // Проверяем что это валидное время
    if (/^\d{2}:\d{2}$/.test(open) && /^\d{2}:\d{2}$/.test(close)) {
      return { open, close };
    }
  }
  
  return null;
}

// Конвертация в 24-часовой формат
function convertTo24Hour(time: string): string {
  if (!time || typeof time !== 'string') return '00:00';
  
  time = time.trim();
  
  // Уже в 24-часовом формате: "09:00" или "9:00"
  const simple24 = time.match(/^(\d{1,2}):(\d{2})$/);
  if (simple24) {
    const h = parseInt(simple24[1]);
    const m = simple24[2];
    return `${h.toString().padStart(2, '0')}:${m}`;
  }
  
  // AM/PM формат: "9:00 AM", "10:30 PM", "9 AM"
  const ampmMatch = time.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm|a\.m\.|p\.m\.)/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1]);
    const minutes = ampmMatch[2] || '00';
    const period = ampmMatch[3].toUpperCase().replace(/\./g, '');
    
    if (period.startsWith('P') && hours !== 12) hours += 12;
    if (period.startsWith('A') && hours === 12) hours = 0;
    
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }
  
  // Только число: "9" -> "09:00"
  const justNumber = time.match(/^(\d{1,2})$/);
  if (justNumber) {
    const h = parseInt(justNumber[1]);
    return `${h.toString().padStart(2, '0')}:00`;
  }
  
  return '00:00';
}

