import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Вычисляет расстояние между двумя точками (формула Haversine)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Маппинг настроений на ключевые слова для кухни/категорий
 * ID должны совпадать с ID на фронтенде
 */
const MOOD_KEYWORDS: Record<string, string[]> = {
  'romantic': ['ресторан', 'restaurant', 'italian', 'итальянск', 'french', 'французск', 'wine', 'вин', 'lounge', 'fine', 'premium'],
  'business': ['кафе', 'cafe', 'coffee', 'кофейня', 'ланч', 'lunch', 'бизнес', 'business', 'office'],
  'family': ['семей', 'family', 'детск', 'child', 'kid', 'пицц', 'pizza', 'burger', 'бургер', 'игров'],
  'friends': ['бар', 'bar', 'pub', 'паб', 'grill', 'гриль', 'пив', 'beer', 'sport', 'караоке', 'karaoke'],
  'fast': ['фаст', 'fast', 'food', 'фуд', 'quick', 'express', 'экспресс', 'доставк', 'delivery'],
  'coffee': ['кофе', 'coffee', 'cafe', 'кафе', 'десерт', 'dessert', 'bakery', 'пекарн', 'cake', 'торт', 'sweet'],
};

/**
 * Маппинг типов кухни на ключевые слова
 * ID должны совпадать с ID на фронтенде
 */
const CUISINE_KEYWORDS: Record<string, string[]> = {
  'uzbek': ['узбек', 'uzbek', 'плов', 'plov', 'самса', 'samsa', 'лагман', 'lagman', 'чайхона', 'чайхана', 'восточн', 'oriental', 'шурпа'],
  'european': ['европ', 'europ', 'western', 'continental', 'international', 'интернац', 'французск', 'french', 'немец', 'german'],
  'asian': ['азиат', 'asian', 'китай', 'china', 'япон', 'japan', 'korea', 'корей', 'вьетнам', 'vietnam', 'тайск', 'thai', 'wok', 'вок'],
  'meat': ['мясо', 'meat', 'стейк', 'steak', 'гриль', 'grill', 'шашлык', 'bbq', 'барбекю', 'кебаб', 'kebab', 'мангал'],
  'pizza': ['пицц', 'pizza', 'итальян', 'italian', 'пиццер'],
  'sushi': ['суши', 'sushi', 'роллы', 'rolls', 'япон', 'japan', 'sashimi', 'сашими'],
};

/**
 * Проверяет, содержит ли текст любое из ключевых слов
 */
function matchesKeywords(text: string, keywords: string[]): boolean {
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Извлекает ключевые слова из поискового запроса
 */
function extractSearchKeywords(search: string): { cuisineKeywords: string[]; moodKeywords: string[]; otherTerms: string[] } {
  const lowerSearch = search.toLowerCase();
  const cuisineKeywords: string[] = [];
  const moodKeywords: string[] = [];
  const otherTerms: string[] = [];
  
  // Проверяем на соответствие типам кухни
  for (const [key, keywords] of Object.entries(CUISINE_KEYWORDS)) {
    if (keywords.some(kw => lowerSearch.includes(kw))) {
      cuisineKeywords.push(...keywords);
    }
  }
  
  // Проверяем на соответствие настроениям
  for (const [key, keywords] of Object.entries(MOOD_KEYWORDS)) {
    if (keywords.some(kw => lowerSearch.includes(kw))) {
      moodKeywords.push(...keywords);
    }
  }
  
  // Остальные слова
  const words = search.split(/\s+/).filter(w => w.length > 2);
  for (const word of words) {
    if (!cuisineKeywords.some(k => word.toLowerCase().includes(k)) && 
        !moodKeywords.some(k => word.toLowerCase().includes(k))) {
      otherTerms.push(word);
    }
  }
  
  return { cuisineKeywords, moodKeywords, otherTerms };
}

/**
 * GET /api/restaurants - Получение списка ресторанов
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const city = searchParams.get('city');
    const search = searchParams.get('search');
    const cuisine = searchParams.get('cuisine');
    const minRating = searchParams.get('minRating');
    const priceRange = searchParams.get('priceRange');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    // Новые параметры для категорий
    const moodId = searchParams.get('mood'); // ID настроения (romantic, business, etc.)
    const cuisineType = searchParams.get('cuisineType'); // ID типа кухни (uzbek, asian, etc.)
    
    // Геолокация
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const sortBy = searchParams.get('sortBy');
    const maxDistance = parseFloat(searchParams.get('maxDistance') || '50'); // км
    
    const where: any = {
      isActive: true,
    };
    
    // Условия AND
    const andConditions: any[] = [];
    
    // Город
    if (city) {
      andConditions.push({ city: { contains: city, mode: 'insensitive' } });
    }
    
    // Обычный текстовый поиск
    if (search) {
      const words = search.split(/\s+/).filter(w => w.length > 2);
      
      const searchConditions: any[] = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
      
      // Поиск по каждому слову
      for (const word of words) {
        searchConditions.push({ name: { contains: word, mode: 'insensitive' } });
      }
      
      andConditions.push({ OR: searchConditions });
    }
    
    // Фильтр по кухне (прямой)
    if (cuisine) {
      let cuisineVariants = [
        cuisine,
        cuisine.charAt(0).toUpperCase() + cuisine.slice(1),
        cuisine.toLowerCase(),
      ];
      
      for (const [key, keywords] of Object.entries(CUISINE_KEYWORDS)) {
        if (cuisine.toLowerCase().includes(key) || key.includes(cuisine.toLowerCase())) {
          cuisineVariants.push(...keywords);
        }
      }
      
      cuisineVariants = [...new Set(cuisineVariants)];
      andConditions.push({ cuisine: { hasSome: cuisineVariants } });
    }
    
    // Фильтр по рейтингу
    if (minRating) {
      andConditions.push({ rating: { gte: parseFloat(minRating) } });
    }
    
    // Фильтр по бюджету (цене)
    if (priceRange) {
      andConditions.push({
        OR: [
          { priceRange: priceRange },
          { priceRange: { startsWith: priceRange } },
        ],
      });
    }
    
    // Собираем все условия
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }
    
    // Если есть координаты - фильтруем по области (примерно)
    // 1 градус широты ≈ 111 км
    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      const latDelta = maxDistance / 111;
      const lngDelta = maxDistance / (111 * Math.cos(userLat * Math.PI / 180));
      
      where.latitude = { gte: userLat - latDelta, lte: userLat + latDelta };
      where.longitude = { gte: userLng - lngDelta, lte: userLng + lngDelta };
    }
    
    // Определяем нужна ли пост-фильтрация
    const needsPostFilter = moodId || cuisineType || search;
    
    let restaurants = await prisma.restaurant.findMany({
      where,
      orderBy: sortBy === 'distance' ? undefined : { rating: 'desc' },
      skip: needsPostFilter || sortBy === 'distance' ? 0 : (page - 1) * limit,
      take: needsPostFilter || sortBy === 'distance' ? 500 : limit,
      include: {
        reviews: {
          take: 3,
          orderBy: { date: 'desc' },
        },
        workingHours: true,
      },
    });
    
    // Фильтрация по типу кухни (cuisineType = uzbek, asian, etc.)
    if (cuisineType) {
      const keywords = CUISINE_KEYWORDS[cuisineType as keyof typeof CUISINE_KEYWORDS] || [];
      if (keywords.length > 0) {
        restaurants = restaurants.filter(r => {
          const combinedText = `${r.name} ${r.cuisine?.join(' ') || ''}`.toLowerCase();
          return keywords.some(kw => combinedText.includes(kw.toLowerCase()));
        });
      }
    }
    
    // Фильтрация по настроению (moodId = romantic, business, etc.)
    if (moodId) {
      const keywords = MOOD_KEYWORDS[moodId as keyof typeof MOOD_KEYWORDS] || [];
      if (keywords.length > 0) {
        restaurants = restaurants.filter(r => {
          const combinedText = `${r.name} ${r.cuisine?.join(' ') || ''}`.toLowerCase();
          const matchesKeyword = keywords.some(kw => combinedText.includes(kw.toLowerCase()));
          
          // Дополнительные условия для настроений
          if (moodId === 'романтик' && r.rating && r.rating < 4.3) return false;
          if (moodId === 'business' && r.rating && r.rating < 4.0) return false;
          
          return matchesKeyword;
        });
      }
    }
    
    // Если есть текстовый поиск - ранжируем по релевантности
    if (search) {
      const lowerSearch = search.toLowerCase();
      const searchWords = lowerSearch.split(/\s+/).filter(w => w.length > 2);
      
      restaurants = restaurants
        .map(r => {
          let score = 0;
          const combinedText = `${r.name} ${r.address} ${r.cuisine?.join(' ') || ''} ${r.description || ''}`.toLowerCase();
          
          // Полное совпадение в названии
          if (r.name.toLowerCase().includes(lowerSearch)) score += 100;
          
          // Совпадение отдельных слов
          for (const word of searchWords) {
            if (r.name.toLowerCase().includes(word)) score += 30;
            if (r.cuisine?.some(c => c.toLowerCase().includes(word))) score += 25;
            if (r.address.toLowerCase().includes(word)) score += 10;
          }
          
          // Бонус за рейтинг
          if (r.rating) score += r.rating * 2;
          
          return { ...r, relevanceScore: score };
        })
        .filter(r => r.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
    
    // Применяем лимит после фильтрации
    if (needsPostFilter && !sortBy) {
      restaurants = restaurants.slice(0, limit);
    }
    
    // Если сортируем по расстоянию - вычисляем и сортируем
    if (sortBy === 'distance' && lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      
      restaurants = restaurants
        .map(r => ({
          ...r,
          distance: calculateDistance(userLat, userLng, r.latitude, r.longitude),
        }))
        .filter(r => r.distance <= maxDistance)
        .sort((a, b) => a.distance - b.distance)
        .slice((page - 1) * limit, page * limit);
    }
    
    const total = search ? restaurants.length : await prisma.restaurant.count({ where });
    
    return NextResponse.json({
      restaurants,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    return NextResponse.json(
      { error: 'Failed to fetch restaurants' },
      { status: 500 }
    );
  }
}

