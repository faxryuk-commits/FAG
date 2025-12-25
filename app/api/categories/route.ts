import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Принудительно динамический рендер (требует подключение к БД)
export const dynamic = 'force-dynamic';

/**
 * Стандартные категории настроений и их ключевые слова
 */
const MOOD_DEFINITIONS = [
  { 
    id: 'romantic', 
    label: 'Романтика', 
    emoji: '💕',
    keywords: ['ресторан', 'italian', 'итальян', 'french', 'франц', 'wine', 'вин', 'lounge', 'fine dining'],
    minRating: 4.3,
  },
  { 
    id: 'business', 
    label: 'Бизнес', 
    emoji: '💼',
    keywords: ['кафе', 'cafe', 'coffee', 'кофейня', 'ланч', 'lunch', 'бизнес', 'business'],
    minRating: 4.0,
  },
  { 
    id: 'family', 
    label: 'Семья', 
    emoji: '👨‍👩‍👧',
    keywords: ['семей', 'family', 'детск', 'child', 'пицц', 'pizza', 'burger', 'бургер'],
    minRating: 4.0,
  },
  { 
    id: 'friends', 
    label: 'Друзья', 
    emoji: '🎉',
    keywords: ['бар', 'bar', 'pub', 'паб', 'grill', 'гриль', 'пив', 'beer', 'sport'],
    minRating: 4.0,
  },
  { 
    id: 'fast', 
    label: 'Быстро', 
    emoji: '⚡',
    keywords: ['фаст', 'fast', 'food', 'фуд', 'quick', 'express', 'экспресс', 'доставк'],
    minRating: 3.5,
  },
  { 
    id: 'coffee', 
    label: 'Кофе', 
    emoji: '☕',
    keywords: ['кофе', 'coffee', 'cafe', 'кафе', 'десерт', 'dessert', 'bakery', 'пекарн', 'cake', 'торт'],
    minRating: 4.0,
  },
];

/**
 * Стандартные категории кухонь
 */
const CUISINE_DEFINITIONS = [
  { id: 'uzbek', label: 'Узбекская', emoji: '🥟', keywords: ['узбек', 'плов', 'самса', 'лагман', 'чайхона'] },
  { id: 'european', label: 'Европейская', emoji: '🍝', keywords: ['европ', 'europ', 'франц', 'итальян', 'немец'] },
  { id: 'asian', label: 'Азиатская', emoji: '🍜', keywords: ['азиат', 'китай', 'япон', 'корей', 'вьетнам', 'thai', 'wok'] },
  { id: 'meat', label: 'Мясо/Гриль', emoji: '🥩', keywords: ['мясо', 'стейк', 'гриль', 'шашлык', 'bbq', 'кебаб'] },
  { id: 'pizza', label: 'Пицца', emoji: '🍕', keywords: ['пицц', 'pizza'] },
  { id: 'sushi', label: 'Суши', emoji: '🍣', keywords: ['суши', 'sushi', 'ролл', 'roll', 'сашими'] },
];

/**
 * GET /api/categories - Получение статистики по категориям
 */
export async function GET(request: NextRequest) {
  try {
    // Получаем все активные рестораны
    const restaurants = await prisma.restaurant.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        cuisine: true,
        rating: true,
        ratingCount: true,
      },
    });

    // Подсчитываем рестораны по настроениям
    const moodStats = MOOD_DEFINITIONS.map(mood => {
      const matchingRestaurants = restaurants.filter(r => {
        const combinedText = `${r.name} ${r.cuisine?.join(' ') || ''}`.toLowerCase();
        const hasKeyword = mood.keywords.some(kw => combinedText.includes(kw.toLowerCase()));
        const hasGoodRating = r.rating !== null && r.rating >= mood.minRating;
        return hasKeyword && hasGoodRating;
      });
      
      return {
        ...mood,
        count: matchingRestaurants.length,
      };
    });

    // Подсчитываем рестораны по типам кухни
    const cuisineStats = CUISINE_DEFINITIONS.map(cuisine => {
      const matchingRestaurants = restaurants.filter(r => {
        const combinedText = `${r.name} ${r.cuisine?.join(' ') || ''}`.toLowerCase();
        return cuisine.keywords.some(kw => combinedText.includes(kw.toLowerCase()));
      });
      
      return {
        ...cuisine,
        count: matchingRestaurants.length,
      };
    });

    // Общая статистика
    const totalRestaurants = restaurants.length;
    const avgRating = restaurants.reduce((sum, r) => sum + (r.rating || 0), 0) / (totalRestaurants || 1);
    const withReviews = restaurants.filter(r => r.ratingCount > 0).length;

    return NextResponse.json({
      moods: moodStats,
      cuisines: cuisineStats,
      stats: {
        total: totalRestaurants,
        avgRating: Math.round(avgRating * 10) / 10,
        withReviews,
      },
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

