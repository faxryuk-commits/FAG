'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  rating: number | null;
  ratingCount: number;
  images: string[];
  cuisine: string[];
  priceRange: string | null;
  distance?: number;
}

// Категории настроения
const MOOD_CATEGORIES = [
  { id: 'romantic', emoji: '💕', label: 'Романтика', query: 'ресторан итальянский французский wine', color: 'from-pink-600 to-rose-500' },
  { id: 'business', emoji: '💼', label: 'Бизнес', query: 'кафе кофейня ланч бизнес', color: 'from-slate-700 to-slate-600' },
  { id: 'family', emoji: '👨‍👩‍👧', label: 'Семья', query: 'семейный пицца бургер детское', color: 'from-amber-500 to-orange-500' },
  { id: 'friends', emoji: '🎉', label: 'Друзья', query: 'бар паб гриль пиво', color: 'from-violet-600 to-purple-500' },
  { id: 'fast', emoji: '⚡', label: 'Быстро', query: 'фастфуд быстрое экспресс доставка', color: 'from-emerald-600 to-green-500' },
  { id: 'coffee', emoji: '☕', label: 'Кофе', query: 'кофейня кафе десерт торт', color: 'from-amber-700 to-yellow-600' },
];

// Типы кухонь
const CUISINES = [
  { id: 'uzbek', label: '🥟 Узбекская', query: 'узбекская плов самса лагман чайхона' },
  { id: 'european', label: '🍝 Европейская', query: 'европейская итальянская французская' },
  { id: 'asian', label: '🍜 Азиатская', query: 'азиатская китайская японская корейская вок' },
  { id: 'meat', label: '🥩 Мясо/Гриль', query: 'стейк гриль мясо шашлык кебаб' },
  { id: 'pizza', label: '🍕 Пицца', query: 'пицца pizza итальянская' },
  { id: 'sushi', label: '🍣 Суши', query: 'суши роллы сашими японская' },
];

interface CategoryStats {
  moods: Array<{ id: string; label: string; emoji: string; count: number }>;
  cuisines: Array<{ id: string; label: string; emoji: string; count: number }>;
  stats: { total: number; avgRating: number; withReviews: number };
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { text: 'Доброе утро', meal: 'Завтрак?', emoji: '🌅' };
  if (hour >= 12 && hour < 17) return { text: 'Добрый день', meal: 'Обед?', emoji: '☀️' };
  if (hour >= 17 && hour < 22) return { text: 'Добрый вечер', meal: 'Ужин?', emoji: '🌆' };
  return { text: 'Доброй ночи', meal: 'Перекус?', emoji: '🌙' };
}

export default function Home() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [showAll, setShowAll] = useState(false);
  const [categoryStats, setCategoryStats] = useState<CategoryStats | null>(null);
  
  const greeting = getTimeGreeting();

  // Загрузка статистики по категориям
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/categories');
        if (res.ok) {
          const data = await res.json();
          setCategoryStats(data);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    fetchStats();
  }, []);

  // Запрос геолокации
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      return;
    }
    
    setLocationStatus('loading');
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus('success');
      },
      (err) => {
        console.error('Geolocation error:', err);
        setLocationStatus('error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  // Загрузка ресторанов
  const fetchRestaurants = useCallback(async (searchQuery?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      if (searchQuery) {
        params.set('search', searchQuery);
      }
      
      if (userLocation) {
        params.set('lat', String(userLocation.lat));
        params.set('lng', String(userLocation.lng));
        params.set('sortBy', 'distance');
        params.set('maxDistance', '30');
      }
      
      params.set('limit', '50');
      
      const res = await fetch(`/api/restaurants?${params}`);
      const data = await res.json();
      setRestaurants(data.restaurants || []);
    } catch (error) {
      console.error('Error:', error);
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  }, [userLocation]);

  // Начальная загрузка
  useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  // Обработка выбора настроения
  const handleMoodSelect = (mood: typeof MOOD_CATEGORIES[0]) => {
    if (selectedMood === mood.id) {
      setSelectedMood(null);
      setSelectedCuisine(null);
      fetchRestaurants();
    } else {
      setSelectedMood(mood.id);
      setSelectedCuisine(null);
      fetchRestaurants(mood.query);
    }
  };

  // Обработка выбора кухни
  const handleCuisineSelect = (cuisine: typeof CUISINES[0]) => {
    if (selectedCuisine === cuisine.id) {
      setSelectedCuisine(null);
      setSelectedMood(null);
      fetchRestaurants();
    } else {
      setSelectedCuisine(cuisine.id);
      setSelectedMood(null);
      fetchRestaurants(cuisine.query);
    }
  };

  // Поиск
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSelectedMood(null);
    setSelectedCuisine(null);
    fetchRestaurants(search);
  };

  const displayedRestaurants = showAll ? restaurants : restaurants.slice(0, 9);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f1a] via-[#1a1a2e] to-[#16213e]">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/30 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🍽️</span>
            <span className="font-black text-xl bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">
              FoodGuide
            </span>
          </Link>
          
          <div className="flex items-center gap-4">
            {/* Кнопка геолокации */}
            <button
              onClick={requestLocation}
              disabled={locationStatus === 'loading'}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all ${
                locationStatus === 'success'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : locationStatus === 'error'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
              }`}
            >
              {locationStatus === 'loading' ? (
                <span className="animate-spin">⏳</span>
              ) : locationStatus === 'success' ? (
                <span>📍</span>
              ) : (
                <span>📍</span>
              )}
              <span className="hidden sm:inline">
                {locationStatus === 'success' ? 'Рядом с вами' : locationStatus === 'error' ? 'Нет доступа' : 'Найти рядом'}
              </span>
            </button>
            
            <Link 
              href="/admin" 
              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-white/60 hover:text-white text-sm transition-all border border-white/10"
            >
              Админ
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-4 pt-12 pb-8">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[150px]"></div>
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[150px]"></div>
        </div>
        
        <div className="relative max-w-4xl mx-auto text-center">
          {/* Приветствие */}
          <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-white/5 backdrop-blur rounded-2xl mb-8 border border-white/10">
            <span className="text-3xl">{greeting.emoji}</span>
            <div className="text-left">
              <span className="text-white/50 text-sm">{greeting.text}</span>
              <span className="block text-white font-semibold">{greeting.meal}</span>
            </div>
          </div>
          
          <h1 className="text-4xl sm:text-6xl font-black mb-6">
            <span className="text-white">Найди своё </span>
            <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">
              идеальное место
            </span>
          </h1>
          
          {/* Поиск */}
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-8">
            <div className="flex gap-2 p-2 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Название, кухня или блюдо..."
                className="flex-1 px-4 py-3 bg-transparent text-white placeholder-white/30 focus:outline-none"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 rounded-xl font-semibold text-white hover:opacity-90 transition-opacity"
              >
                🔍 Найти
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Категории настроения */}
      <section className="px-4 pb-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span>🎯</span> Настроение
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {MOOD_CATEGORIES.map((mood) => {
              const moodStat = categoryStats?.moods.find(m => m.id === mood.id);
              const count = moodStat?.count || 0;
              return (
                <button
                  key={mood.id}
                  onClick={() => handleMoodSelect(mood)}
                  disabled={count === 0}
                  className={`relative overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:scale-105 ${
                    selectedMood === mood.id ? 'ring-2 ring-white shadow-lg shadow-white/20' : ''
                  } ${count === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${mood.color}`}></div>
                  <div className="relative text-center">
                    <span className="text-2xl sm:text-3xl block mb-1">{mood.emoji}</span>
                    <span className="text-xs sm:text-sm font-medium text-white">{mood.label}</span>
                    {count > 0 && (
                      <span className="block mt-1 text-xs text-white/70">{count} мест</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Типы кухонь */}
      <section className="px-4 pb-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span>🍴</span> Кухня
          </h2>
          <div className="flex flex-wrap gap-2">
            {CUISINES.map((cuisine) => {
              const cuisineStat = categoryStats?.cuisines.find(c => c.id === cuisine.id);
              const count = cuisineStat?.count || 0;
              return (
                <button
                  key={cuisine.id}
                  onClick={() => handleCuisineSelect(cuisine)}
                  disabled={count === 0}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                    selectedCuisine === cuisine.id
                      ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white'
                      : count === 0 
                        ? 'bg-white/5 text-white/30 border border-white/5 cursor-not-allowed'
                        : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  <span>{cuisine.label}</span>
                  {count > 0 && (
                    <span className="px-1.5 py-0.5 bg-white/10 rounded-md text-xs">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Результаты */}
      <section className="px-4 pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {selectedMood && <span>{MOOD_CATEGORIES.find(m => m.id === selectedMood)?.emoji}</span>}
              {selectedCuisine && <span>{CUISINES.find(c => c.id === selectedCuisine)?.label.split(' ')[0]}</span>}
              <span>
                {selectedMood 
                  ? MOOD_CATEGORIES.find(m => m.id === selectedMood)?.label
                  : selectedCuisine
                    ? CUISINES.find(c => c.id === selectedCuisine)?.label.split(' ').slice(1).join(' ')
                    : userLocation 
                      ? 'Рядом с вами' 
                      : 'Все места'}
              </span>
            </h2>
            <span className="text-white/40 text-sm">{restaurants.length} мест</span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden bg-white/5 animate-pulse border border-white/5">
                  <div className="h-48 bg-white/10"></div>
                  <div className="p-4 space-y-3">
                    <div className="h-5 bg-white/10 rounded-lg w-3/4"></div>
                    <div className="h-4 bg-white/10 rounded-lg w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : restaurants.length === 0 ? (
            <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/10">
              <div className="text-8xl mb-6">🍳</div>
              <h3 className="text-2xl font-bold text-white mb-2">Пока пусто</h3>
              <p className="text-white/50 mb-8">Запустите парсинг в админ-панели</p>
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 rounded-xl font-semibold text-white hover:opacity-90 transition-opacity"
              >
                <span>🚀</span>
                <span>Добавить рестораны</span>
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayedRestaurants.map((restaurant) => (
                  <Link
                    key={restaurant.id}
                    href={`/restaurants/${restaurant.slug}`}
                    className="group"
                  >
                    <div className="rounded-3xl overflow-hidden bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 hover:border-orange-500/50 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-orange-500/20">
                      {/* Изображение с улучшенным хедером */}
                      <div className="h-52 relative overflow-hidden">
                        {restaurant.images?.[0] ? (
                          <img
                            src={restaurant.images[0]}
                            alt={restaurant.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-orange-500/30 via-pink-500/20 to-purple-500/30 flex items-center justify-center">
                            <span className="text-7xl opacity-40 group-hover:scale-110 transition-transform duration-500">🍽️</span>
                          </div>
                        )}
                        
                        {/* Многослойный градиент для глубины */}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f1a] via-transparent to-transparent"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        
                        {/* Верхняя панель с бейджами */}
                        <div className="absolute top-0 left-0 right-0 p-3 flex items-start justify-between">
                          {/* Левые бейджи - кухня */}
                          <div className="flex flex-wrap gap-1.5 max-w-[60%]">
                            {restaurant.cuisine?.slice(0, 2).map((c, i) => (
                              <span 
                                key={i} 
                                className="px-2.5 py-1 bg-black/50 backdrop-blur-md rounded-lg text-xs font-medium text-white/90 border border-white/10"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                          
                          {/* Правые бейджи */}
                          <div className="flex flex-col gap-1.5 items-end">
                            {restaurant.priceRange && (
                              <span className="px-2.5 py-1 bg-emerald-500/80 backdrop-blur-sm rounded-lg text-xs font-bold text-white shadow-lg shadow-emerald-500/30">
                                {restaurant.priceRange}
                              </span>
                            )}
                            {restaurant.distance !== undefined && (
                              <span className="px-2.5 py-1 bg-blue-500/80 backdrop-blur-sm rounded-lg text-xs font-bold text-white shadow-lg shadow-blue-500/30">
                                📍 {restaurant.distance < 1 
                                  ? `${Math.round(restaurant.distance * 1000)}м` 
                                  : `${restaurant.distance.toFixed(1)}км`}
                              </span>
                            )}
                        </div>
                        
                        {/* Рейтинг - плавающий бейдж внизу */}
                        {restaurant.rating && (
                          <div className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-2 bg-black/70 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl">
                            <div className="flex items-center gap-1">
                              <span className="text-amber-400 text-lg drop-shadow-glow">★</span>
                              <span className="font-black text-lg text-white">{restaurant.rating.toFixed(1)}</span>
                            </div>
                            <div className="w-px h-4 bg-white/20"></div>
                            <span className="text-white/60 text-xs">{restaurant.ratingCount} отзывов</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Контент карточки */}
                      <div className="p-5">
                        {/* Название с градиентным эффектом при наведении */}
                        <h3 className="font-bold text-lg text-white group-hover:bg-gradient-to-r group-hover:from-orange-400 group-hover:to-pink-400 group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300 line-clamp-1">
                          {restaurant.name}
                        </h3>
                        
                        {/* Адрес */}
                        <div className="flex items-center gap-2 mt-3 text-white/50 text-sm">
                          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-xs">
                            📍
                          </div>
                          <span className="line-clamp-1">{restaurant.address}</span>
                        </div>
                        
                        {/* Нижняя панель - действия */}
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                          <span className="text-xs text-white/40">
                            {restaurant.cuisine?.length || 0} категорий
                          </span>
                          <div className="flex items-center gap-1.5 text-orange-400 text-sm font-medium group-hover:translate-x-1 transition-transform">
                            <span>Подробнее</span>
                            <span>→</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              
              {/* Показать ещё */}
              {restaurants.length > 9 && !showAll && (
                <div className="text-center mt-10">
                  <button
                    onClick={() => setShowAll(true)}
                    className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-semibold text-white transition-all"
                  >
                    Показать ещё {restaurants.length - 9} мест
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="text-2xl mb-2">🍽️</div>
          <p className="text-white/30 text-sm">FoodGuide — найди своё место</p>
        </div>
      </footer>
    </div>
  );
}
