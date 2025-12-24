'use client';

import { useState, useEffect, useRef } from 'react';
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

// Эмоциональные категории с визуалом
const MOOD_CATEGORIES = [
  { id: 'romantic', emoji: '💕', label: 'Романтический ужин', gradient: 'from-pink-500 to-rose-500', query: 'романтический ресторан' },
  { id: 'business', emoji: '💼', label: 'Бизнес-ланч', gradient: 'from-slate-600 to-slate-800', query: 'бизнес ланч' },
  { id: 'family', emoji: '👨‍👩‍👧‍👦', label: 'С семьёй', gradient: 'from-amber-400 to-orange-500', query: 'семейный ресторан' },
  { id: 'friends', emoji: '🎉', label: 'С друзьями', gradient: 'from-purple-500 to-indigo-600', query: 'бар ресторан' },
  { id: 'fast', emoji: '⚡', label: 'Быстро перекусить', gradient: 'from-green-400 to-emerald-600', query: 'фастфуд кафе' },
  { id: 'coffee', emoji: '☕', label: 'Кофе и десерт', gradient: 'from-amber-600 to-yellow-700', query: 'кофейня десерты' },
];

// Время суток определяет приветствие
function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { text: 'Доброе утро!', meal: 'Где позавтракать?', emoji: '🌅' };
  if (hour >= 12 && hour < 17) return { text: 'Добрый день!', meal: 'Время обеда', emoji: '☀️' };
  if (hour >= 17 && hour < 22) return { text: 'Добрый вечер!', meal: 'Куда на ужин?', emoji: '🌆' };
  return { text: 'Доброй ночи!', meal: 'Поздний перекус?', emoji: '🌙' };
}

export default function Home() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [trendingRestaurants, setTrendingRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  
  const greeting = getTimeGreeting();

  // Автоопределение локации
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.log('Geolocation denied')
      );
    }
    fetchRestaurants();
    fetchTrending();
  }, []);

  const fetchRestaurants = async (query?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('search', query);
      if (userLocation) {
        params.set('lat', String(userLocation.lat));
        params.set('lng', String(userLocation.lng));
        params.set('sortBy', 'distance');
      }
      params.set('limit', '12');
      
      const res = await fetch(`/api/restaurants?${params}`);
      const data = await res.json();
      setRestaurants(data.restaurants || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrending = async () => {
    try {
      const res = await fetch('/api/restaurants?limit=6&minRating=4');
      const data = await res.json();
      setTrendingRestaurants(data.restaurants || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleMoodSelect = (mood: typeof MOOD_CATEGORIES[0]) => {
    setSelectedMood(mood.id);
    fetchRestaurants(mood.query);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      fetchRestaurants(search);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      {/* Floating Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-4 py-3">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl px-4 py-2 flex items-center justify-between border border-white/10">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🍽️</span>
              <span className="font-bold text-lg bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">
                FoodGuide
              </span>
            </Link>
            
            <div className="flex items-center gap-3">
              {userLocation && (
                <span className="text-xs text-white/50 hidden sm:block">
                  📍 Рядом с вами
                </span>
              )}
              <Link href="/admin" className="text-white/60 hover:text-white text-sm">
                Админ
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-8 px-4">
        {/* Animated gradient background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-[120px] animate-pulse delay-1000"></div>
        </div>
        
        <div className="relative max-w-4xl mx-auto text-center">
          {/* Time-based greeting */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full mb-6 border border-white/10">
            <span className="text-2xl">{greeting.emoji}</span>
            <span className="text-white/70">{greeting.text}</span>
            <span className="text-orange-400 font-medium">{greeting.meal}</span>
          </div>
          
          <h1 className="text-4xl sm:text-6xl font-black mb-6 leading-tight">
            <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
              Найди место
            </span>
            <br />
            <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">
              под настроение
            </span>
          </h1>
          
          <p className="text-white/50 text-lg mb-8 max-w-xl mx-auto">
            Рестораны, кафе и бары — подобранные специально для тебя
          </p>

          {/* Search */}
          <form onSubmit={handleSearch} className="relative max-w-xl mx-auto">
            <div className="relative">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по названию, кухне или блюду..."
                className="w-full px-6 py-4 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-gradient-to-r from-orange-500 to-pink-500 rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                Найти
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Mood Categories - Psychology: Quick Decision Making */}
      <section className="px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🎯</span>
            <span>Какое у тебя настроение?</span>
          </h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {MOOD_CATEGORIES.map((mood) => (
              <button
                key={mood.id}
                onClick={() => handleMoodSelect(mood)}
                className={`group relative overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:scale-105 ${
                  selectedMood === mood.id 
                    ? 'ring-2 ring-white/50' 
                    : ''
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${mood.gradient} opacity-80 group-hover:opacity-100 transition-opacity`}></div>
                <div className="relative text-center">
                  <span className="text-3xl block mb-2">{mood.emoji}</span>
                  <span className="text-sm font-medium">{mood.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Trending Now - Psychology: Social Proof + FOMO */}
      {trendingRestaurants.length > 0 && (
        <section className="px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="animate-pulse">🔥</span>
                <span>Trending сейчас</span>
                <span className="text-xs text-white/40 font-normal ml-2">
                  {Math.floor(Math.random() * 50 + 80)} человек смотрят
                </span>
              </h2>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
              {trendingRestaurants.map((restaurant, index) => (
                <Link
                  key={restaurant.id}
                  href={`/restaurants/${restaurant.slug}`}
                  className="flex-shrink-0 w-72 group"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="relative rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-300 hover:-translate-y-1">
                    {/* Image */}
                    <div className="h-40 relative overflow-hidden">
                      {restaurant.images?.[0] ? (
                        <img
                          src={restaurant.images[0]}
                          alt={restaurant.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-orange-500/20 to-pink-500/20 flex items-center justify-center">
                          <span className="text-5xl opacity-50">🍽️</span>
                        </div>
                      )}
                      
                      {/* Trending badge */}
                      <div className="absolute top-3 left-3 px-2 py-1 bg-orange-500 rounded-lg text-xs font-bold flex items-center gap-1">
                        <span>🔥</span>
                        <span>Hot</span>
                      </div>
                      
                      {/* Rating */}
                      {restaurant.rating && (
                        <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg flex items-center gap-1">
                          <span className="text-yellow-400">★</span>
                          <span className="text-sm font-bold">{restaurant.rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="p-4">
                      <h3 className="font-bold text-white group-hover:text-orange-400 transition-colors line-clamp-1">
                        {restaurant.name}
                      </h3>
                      <p className="text-white/50 text-sm line-clamp-1 mt-1">
                        {restaurant.cuisine?.slice(0, 2).join(' • ') || restaurant.address}
                      </p>
                      
                      {/* Social proof */}
                      <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/40">
                        <span>🔥 {Math.floor(Math.random() * 20 + 5)} бронирований сегодня</span>
                        {restaurant.distance && (
                          <span>{restaurant.distance.toFixed(1)} км</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Main Results */}
      <section className="px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">
              {selectedMood 
                ? MOOD_CATEGORIES.find(m => m.id === selectedMood)?.label
                : userLocation 
                  ? '📍 Рядом с вами'
                  : '✨ Рекомендации'}
            </h2>
            <span className="text-white/40 text-sm">{restaurants.length} мест</span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden bg-white/5 animate-pulse">
                  <div className="h-48 bg-white/10"></div>
                  <div className="p-4 space-y-3">
                    <div className="h-5 bg-white/10 rounded-lg w-3/4"></div>
                    <div className="h-4 bg-white/10 rounded-lg w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : restaurants.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-8xl mb-6">🍳</div>
              <h3 className="text-2xl font-bold mb-2">Пока пусто</h3>
              <p className="text-white/50 mb-8">Добавьте рестораны через админ-панель</p>
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                <span>🚀</span>
                <span>Добавить рестораны</span>
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {(showMore ? restaurants : restaurants.slice(0, 6)).map((restaurant, index) => (
                  <Link
                    key={restaurant.id}
                    href={`/restaurants/${restaurant.slug}`}
                    className="group"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-orange-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-500/10">
                      {/* Image */}
                      <div className="h-48 relative overflow-hidden">
                        {restaurant.images?.[0] ? (
                          <img
                            src={restaurant.images[0]}
                            alt={restaurant.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-orange-500/20 to-pink-500/20 flex items-center justify-center">
                            <span className="text-6xl opacity-30">🍽️</span>
                          </div>
                        )}
                        
                        {/* Overlay gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                        
                        {/* Price & Distance */}
                        <div className="absolute top-3 right-3 flex flex-col gap-2">
                          {restaurant.priceRange && (
                            <span className="px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-xs font-medium">
                              {restaurant.priceRange}
                            </span>
                          )}
                          {restaurant.distance && (
                            <span className="px-2 py-1 bg-green-500/80 rounded-lg text-xs font-bold">
                              {restaurant.distance < 1 ? `${Math.round(restaurant.distance * 1000)}м` : `${restaurant.distance.toFixed(1)}км`}
                            </span>
                          )}
                        </div>
                        
                        {/* Rating & Reviews */}
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                          {restaurant.rating && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg">
                              <span className="text-yellow-400">★</span>
                              <span className="font-bold">{restaurant.rating.toFixed(1)}</span>
                              <span className="text-white/50 text-xs">({restaurant.ratingCount})</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="p-4">
                        <h3 className="font-bold text-lg group-hover:text-orange-400 transition-colors line-clamp-1">
                          {restaurant.name}
                        </h3>
                        
                        {/* Cuisine tags */}
                        {restaurant.cuisine?.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {restaurant.cuisine.slice(0, 3).map((c, i) => (
                              <span key={i} className="px-2 py-0.5 bg-white/10 rounded-md text-xs text-white/70">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        <p className="text-white/40 text-sm mt-2 line-clamp-1">
                          📍 {restaurant.address}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              
              {/* Show More Button */}
              {restaurants.length > 6 && !showMore && (
                <div className="text-center mt-8">
                  <button
                    onClick={() => setShowMore(true)}
                    className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition-colors"
                  >
                    Показать ещё {restaurants.length - 6} мест
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-12 border-t border-white/10">
        <div className="max-w-6xl mx-auto text-center">
          <div className="text-3xl mb-4">🍽️</div>
          <p className="text-white/40 text-sm">
            FoodGuide — найди своё идеальное место
          </p>
        </div>
      </footer>
    </main>
  );
}
