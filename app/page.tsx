'use client';

import { useState, useEffect } from 'react';
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
  distance?: number; // км от пользователя
  latitude: number;
  longitude: number;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// Категории с эмодзи
const CUISINE_TAGS = [
  { id: 'all', label: 'Все', icon: '🍽️', color: 'from-orange-500 to-red-500' },
  { id: 'restaurant', label: 'Рестораны', icon: '🏛️', color: 'from-amber-500 to-orange-500' },
  { id: 'cafe', label: 'Кафе', icon: '☕', color: 'from-yellow-500 to-amber-500' },
  { id: 'fast_food', label: 'Фастфуд', icon: '🍔', color: 'from-red-500 to-pink-500' },
  { id: 'sushi', label: 'Суши', icon: '🍣', color: 'from-pink-500 to-rose-500' },
  { id: 'pizza', label: 'Пицца', icon: '🍕', color: 'from-orange-500 to-amber-500' },
  { id: 'asian', label: 'Азиатская', icon: '🥡', color: 'from-red-500 to-orange-500' },
  { id: 'european', label: 'Европейская', icon: '🥘', color: 'from-amber-500 to-yellow-500' },
  { id: 'dessert', label: 'Десерты', icon: '🍰', color: 'from-pink-400 to-rose-400' },
];

const RATING_FILTERS = [
  { id: 'all', label: 'Любой', min: 0 },
  { id: '4.5+', label: '4.5+ ⭐', min: 4.5 },
  { id: '4.0+', label: '4.0+ ⭐', min: 4.0 },
  { id: '3.5+', label: '3.5+ ⭐', min: 3.5 },
];

// Фильтры по бюджету
const BUDGET_FILTERS = [
  { id: 'all', label: 'Любой бюджет', icon: '💰', price: null },
  { id: 'cheap', label: 'Бюджетно', icon: '💵', price: '$', maxPrice: 500 },
  { id: 'medium', label: 'Средний', icon: '💵💵', price: '$$', maxPrice: 1500 },
  { id: 'expensive', label: 'Дорого', icon: '💵💵💵', price: '$$$', maxPrice: 5000 },
  { id: 'luxury', label: 'Премиум', icon: '💎', price: '$$$$', maxPrice: null },
];

export default function Home() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState('all');
  const [selectedRating, setSelectedRating] = useState('all');
  const [selectedBudget, setSelectedBudget] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Геолокация
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [nearbyMode, setNearbyMode] = useState(false);

  // Определение геолокации
  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Геолокация не поддерживается браузером');
      return;
    }
    
    setLocationLoading(true);
    setLocationError(null);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setNearbyMode(true);
        setLocationLoading(false);
        
        // Попробуем определить город по координатам
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          const detectedCity = data.address?.city || data.address?.town || data.address?.village || '';
          if (detectedCity) {
            setCity(detectedCity);
          }
        } catch (e) {
          console.log('Could not detect city name');
        }
      },
      (error) => {
        setLocationLoading(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Доступ к геолокации запрещён');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('Местоположение недоступно');
            break;
          case error.TIMEOUT:
            setLocationError('Время ожидания истекло');
            break;
          default:
            setLocationError('Не удалось определить местоположение');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    fetchRestaurants();
  }, [selectedCuisine, selectedRating, selectedBudget, nearbyMode]);

  const fetchRestaurants = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (city) params.set('city', city);
      
      const ratingFilter = RATING_FILTERS.find(r => r.id === selectedRating);
      if (ratingFilter && ratingFilter.min > 0) {
        params.set('minRating', String(ratingFilter.min));
      }
      
      // Фильтр по бюджету
      const budgetFilter = BUDGET_FILTERS.find(b => b.id === selectedBudget);
      if (budgetFilter && budgetFilter.price) {
        params.set('priceRange', budgetFilter.price);
      }
      
      // Геолокация - сортировка по расстоянию
      if (nearbyMode && userLocation) {
        params.set('lat', String(userLocation.lat));
        params.set('lng', String(userLocation.lng));
        params.set('sortBy', 'distance');
      }
      
      params.set('page', String(page));
      params.set('limit', '12');

      const res = await fetch(`/api/restaurants?${params}`);
      const data = await res.json();
      
      let filtered = data.restaurants || [];
      
      // Фильтр по кухне на клиенте
      if (selectedCuisine !== 'all') {
        filtered = filtered.filter((r: Restaurant) => 
          r.cuisine?.some(c => c.toLowerCase().includes(selectedCuisine.toLowerCase()))
        );
      }
      
      setRestaurants(filtered);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching restaurants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRestaurants();
  };

  const clearFilters = () => {
    setSearch('');
    setCity('');
    setSelectedCuisine('all');
    setSelectedRating('all');
    setSelectedBudget('all');
    setNearbyMode(false);
    setUserLocation(null);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-orange-100">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-3xl">🍽️</span>
            <span className="text-xl font-bold bg-gradient-to-r from-orange-600 to-red-500 bg-clip-text text-transparent">
              FoodGuide
            </span>
          </Link>
          
          <div className="flex items-center gap-3">
            <Link 
              href="/admin" 
              className="px-4 py-2 text-sm text-gray-600 hover:text-orange-600 transition-colors"
            >
              Админ
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-orange-200/50 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-amber-200/50 to-transparent rounded-full blur-3xl"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 py-12 md:py-16">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-extrabold mb-4">
              <span className="bg-gradient-to-r from-orange-600 via-red-500 to-pink-500 bg-clip-text text-transparent">
                Найди своё
              </span>
              <br />
              <span className="text-gray-800">идеальное место</span>
            </h1>
            <p className="text-lg text-gray-500 mb-8">
              {pagination?.total || 0}+ ресторанов, кафе и баров в твоём городе
            </p>
            
            {/* Search */}
            <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
              <div className="flex bg-white rounded-2xl shadow-xl shadow-orange-100 border border-orange-100 overflow-hidden">
                <div className="flex-1 flex items-center px-5">
                  <span className="text-gray-400 text-xl">🔍</span>
                  <input
                    type="text"
                    placeholder="Найти ресторан, кухню или блюдо..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full px-4 py-4 text-gray-700 placeholder-gray-400 focus:outline-none"
                  />
                </div>
                <div className="flex items-center border-l border-orange-100 px-2">
                  <button
                    type="button"
                    onClick={detectLocation}
                    disabled={locationLoading}
                    className={`p-2 rounded-lg transition-colors ${
                      nearbyMode 
                        ? 'bg-orange-100 text-orange-600' 
                        : 'text-gray-400 hover:text-orange-500 hover:bg-orange-50'
                    }`}
                    title={nearbyMode ? 'Рядом со мной активно' : 'Найти рядом со мной'}
                  >
                    {locationLoading ? (
                      <span className="animate-spin">⏳</span>
                    ) : (
                      <span>{nearbyMode ? '📍' : '🎯'}</span>
                    )}
                  </button>
                  <input
                    type="text"
                    placeholder={nearbyMode ? 'Рядом со мной' : 'Город'}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-28 px-2 py-4 text-gray-700 placeholder-gray-400 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="px-8 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold hover:from-orange-600 hover:to-red-600 transition-all"
                >
                  Найти
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Category Tags */}
      <section className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {CUISINE_TAGS.map(tag => (
            <button
              key={tag.id}
              onClick={() => setSelectedCuisine(tag.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl whitespace-nowrap transition-all font-medium ${
                selectedCuisine === tag.id
                  ? `bg-gradient-to-r ${tag.color} text-white shadow-lg`
                  : 'bg-white text-gray-700 hover:bg-orange-50 border border-gray-100 shadow-sm'
              }`}
            >
              <span className="text-xl">{tag.icon}</span>
              <span>{tag.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Filters */}
      <section className="max-w-7xl mx-auto px-4 mb-6">
        {/* Location status */}
        {(nearbyMode || locationError) && (
          <div className={`mb-4 px-4 py-2 rounded-xl text-sm ${
            nearbyMode 
              ? 'bg-green-50 text-green-700 border border-green-200' 
              : 'bg-red-50 text-red-600 border border-red-200'
          }`}>
            {nearbyMode ? (
              <span>📍 Показываем места рядом с вами • <button onClick={() => { setNearbyMode(false); setUserLocation(null); }} className="underline">Отключить</button></span>
            ) : (
              <span>⚠️ {locationError}</span>
            )}
          </div>
        )}
        
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
              showFilters 
                ? 'bg-orange-500 text-white' 
                : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'
            }`}
          >
            <span>⚙️</span>
            <span className="font-medium">Фильтры</span>
          </button>
          
          {/* Rating Quick Filter */}
          <div className="flex gap-2">
            {RATING_FILTERS.slice(1).map(filter => (
              <button
                key={filter.id}
                onClick={() => setSelectedRating(selectedRating === filter.id ? 'all' : filter.id)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  selectedRating === filter.id
                    ? 'bg-amber-500 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-amber-300'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          
          {/* Budget Quick Filter */}
          <div className="flex gap-2">
            {BUDGET_FILTERS.slice(1).map(filter => (
              <button
                key={filter.id}
                onClick={() => setSelectedBudget(selectedBudget === filter.id ? 'all' : filter.id)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  selectedBudget === filter.id
                    ? 'bg-green-500 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-green-300'
                }`}
                title={filter.label}
              >
                {filter.icon}
              </button>
            ))}
          </div>
          
          {(selectedCuisine !== 'all' || selectedRating !== 'all' || selectedBudget !== 'all' || search || nearbyMode) && (
            <button
              onClick={clearFilters}
              className="ml-auto text-sm text-orange-600 hover:text-orange-700 font-medium"
            >
              ✕ Сбросить всё
            </button>
          )}
        </div>
      </section>

      {/* Restaurant Grid */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            {selectedCuisine !== 'all' 
              ? `${CUISINE_TAGS.find(t => t.id === selectedCuisine)?.icon} ${CUISINE_TAGS.find(t => t.id === selectedCuisine)?.label}`
              : '🔥 Популярное рядом'}
          </h2>
          <span className="text-gray-400">{restaurants.length} мест</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-3xl overflow-hidden shadow-sm animate-pulse">
                <div className="h-48 bg-gradient-to-r from-orange-100 to-amber-100"></div>
                <div className="p-5">
                  <div className="h-5 bg-gray-100 rounded-full mb-3 w-3/4"></div>
                  <div className="h-4 bg-gray-100 rounded-full w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-8xl mb-6">🍳</div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Пока пусто...</h3>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Здесь скоро появятся вкусные места! Запустите парсинг в админ-панели.
            </p>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-2xl hover:shadow-lg hover:shadow-orange-200 transition-all"
            >
              <span>🚀</span>
              <span>Добавить рестораны</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {restaurants.map((restaurant) => (
              <Link
                key={restaurant.id}
                href={`/restaurants/${restaurant.slug}`}
                className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:shadow-orange-100 transition-all duration-300 hover:-translate-y-1"
              >
                {/* Image */}
                <div className="h-48 bg-gradient-to-br from-orange-200 to-amber-100 relative overflow-hidden">
                  {restaurant.images?.[0] ? (
                    <img
                      src={restaurant.images[0]}
                      alt={restaurant.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-7xl opacity-50">🍽️</span>
                    </div>
                  )}
                  
                  {/* Rating */}
                  {restaurant.rating && (
                    <div className="absolute top-3 left-3 bg-white px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md">
                      <span className="text-amber-500 text-sm">★</span>
                      <span className="font-bold text-gray-800">{restaurant.rating.toFixed(1)}</span>
                      <span className="text-gray-400 text-sm">({restaurant.ratingCount})</span>
                    </div>
                  )}
                  
                  {/* Price & Distance */}
                  <div className="absolute top-3 right-3 flex flex-col gap-2">
                    {restaurant.priceRange && (
                      <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-gray-600 text-sm font-medium shadow-md">
                        {restaurant.priceRange}
                      </div>
                    )}
                    {restaurant.distance !== undefined && (
                      <div className="bg-green-500 text-white px-3 py-1.5 rounded-full text-sm font-medium shadow-md">
                        📍 {restaurant.distance < 1 
                          ? `${Math.round(restaurant.distance * 1000)}м` 
                          : `${restaurant.distance.toFixed(1)}км`}
                      </div>
                    )}
                  </div>
                  
                  {/* Favorite button */}
                  <button 
                    onClick={(e) => { e.preventDefault(); }}
                    className="absolute bottom-3 right-3 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                  >
                    <span className="text-gray-300 hover:text-red-500 transition-colors">♡</span>
                  </button>
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="text-lg font-bold text-gray-800 mb-1 line-clamp-1 group-hover:text-orange-600 transition-colors">
                    {restaurant.name}
                  </h3>
                  
                  {/* Tags */}
                  {restaurant.cuisine?.length > 0 && (
                    <div className="flex items-center gap-2 mb-3 text-sm text-gray-500">
                      {restaurant.cuisine.slice(0, 2).map((c, i) => (
                        <span key={i}>
                          {i > 0 && '•'} {c}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <span>📍</span>
                    <span className="line-clamp-1">{restaurant.address || restaurant.city}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex justify-center gap-2 mt-12">
            {[...Array(Math.min(pagination.pages, 5))].map((_, i) => (
              <button
                key={i}
                onClick={() => fetchRestaurants(i + 1)}
                className={`w-11 h-11 rounded-xl font-medium transition-all ${
                  pagination.page === i + 1
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-200'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <span className="text-3xl">🍽️</span>
              <span className="text-xl font-bold bg-gradient-to-r from-orange-600 to-red-500 bg-clip-text text-transparent">
                FoodGuide
              </span>
            </div>
            
            <div className="flex items-center gap-8 text-sm text-gray-500">
              <Link href="/admin" className="hover:text-orange-600 transition-colors">
                Админ-панель
              </Link>
              <a href="#" className="hover:text-orange-600 transition-colors">
                О проекте
              </a>
              <a href="#" className="hover:text-orange-600 transition-colors">
                Контакты
              </a>
            </div>
            
            <div className="text-sm text-gray-400">
              © 2024 FoodGuide
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
