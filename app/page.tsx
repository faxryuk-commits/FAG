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
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// Популярные категории/теги
const CUISINE_TAGS = [
  { id: 'all', label: 'Все', icon: '🍽️' },
  { id: 'restaurant', label: 'Рестораны', icon: '🏛️' },
  { id: 'cafe', label: 'Кафе', icon: '☕' },
  { id: 'fast_food', label: 'Фастфуд', icon: '🍔' },
  { id: 'sushi', label: 'Суши', icon: '🍣' },
  { id: 'pizza', label: 'Пицца', icon: '🍕' },
  { id: 'asian', label: 'Азиатская', icon: '🥡' },
  { id: 'european', label: 'Европейская', icon: '🥘' },
  { id: 'bar', label: 'Бары', icon: '🍺' },
];

const RATING_FILTERS = [
  { id: 'all', label: 'Любой', min: 0 },
  { id: '4.5+', label: '4.5+', min: 4.5 },
  { id: '4.0+', label: '4.0+', min: 4.0 },
  { id: '3.5+', label: '3.5+', min: 3.5 },
];

const PRICE_FILTERS = [
  { id: 'all', label: 'Любая', value: '' },
  { id: '$', label: '$', value: '$' },
  { id: '$$', label: '$$', value: '$$' },
  { id: '$$$', label: '$$$', value: '$$$' },
];

export default function Home() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Фильтры
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState('all');
  const [selectedRating, setSelectedRating] = useState('all');
  const [selectedPrice, setSelectedPrice] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchRestaurants();
  }, [selectedCuisine, selectedRating, selectedPrice]);

  const fetchRestaurants = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (city) params.set('city', city);
      
      // Применяем фильтр по рейтингу
      const ratingFilter = RATING_FILTERS.find(r => r.id === selectedRating);
      if (ratingFilter && ratingFilter.min > 0) {
        params.set('minRating', String(ratingFilter.min));
      }
      
      params.set('page', String(page));
      params.set('limit', '12');

      const res = await fetch(`/api/restaurants?${params}`);
      const data = await res.json();
      
      let filtered = data.restaurants || [];
      
      // Фильтр по кухне (клиентская сторона)
      if (selectedCuisine !== 'all') {
        filtered = filtered.filter((r: Restaurant) => 
          r.cuisine?.some(c => c.toLowerCase().includes(selectedCuisine.toLowerCase()))
        );
      }
      
      // Фильтр по цене
      if (selectedPrice !== 'all') {
        filtered = filtered.filter((r: Restaurant) => r.priceRange === selectedPrice);
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
    setSelectedPrice('all');
  };

  const activeFiltersCount = [
    selectedCuisine !== 'all',
    selectedRating !== 'all',
    selectedPrice !== 'all',
    search !== '',
    city !== '',
  ].filter(Boolean).length;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-600/20 to-transparent"></div>
        
        <div className="relative max-w-7xl mx-auto px-6 py-12 md:py-20">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight text-white">
              🍽️ Справочник ресторанов
            </h1>
            <p className="text-xl md:text-2xl text-white/70 mb-8 max-w-2xl mx-auto">
              Найдите идеальное место для любого случая
            </p>
            
            {/* Search Form */}
            <form onSubmit={handleSearch} className="max-w-3xl mx-auto mb-8">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Поиск ресторанов..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white placeholder-white/50 text-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50">🔍</span>
                </div>
                <input
                  type="text"
                  placeholder="Город"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="md:w-40 px-6 py-4 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white placeholder-white/50 text-lg focus:outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-2xl hover:opacity-90 transition-all"
                >
                  Найти
                </button>
              </div>
            </form>

            {/* Quick Stats */}
            <div className="flex justify-center gap-8 text-white/60 text-sm">
              <span>📍 {pagination?.total || 0} мест</span>
              <span>⭐ Средний рейтинг 4.5</span>
              <span>🔄 Обновлено сегодня</span>
            </div>
          </div>
        </div>
      </header>

      {/* Cuisine Tags */}
      <section className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {CUISINE_TAGS.map(tag => (
            <button
              key={tag.id}
              onClick={() => setSelectedCuisine(tag.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-full whitespace-nowrap transition-all ${
                selectedCuisine === tag.id
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30'
                  : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
              }`}
            >
              <span>{tag.icon}</span>
              <span className="font-medium">{tag.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Filters Panel */}
      <section className="max-w-7xl mx-auto px-6 mb-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-colors"
          >
            <span>⚙️</span>
            <span>Фильтры</span>
            {activeFiltersCount > 0 && (
              <span className="px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </button>
          
          {activeFiltersCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-sm text-white/50 hover:text-white transition-colors"
            >
              Сбросить все
            </button>
          )}
        </div>

        {/* Expandable Filters */}
        {showFilters && (
          <div className="mt-4 p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Rating Filter */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-3">⭐ Рейтинг</label>
                <div className="flex flex-wrap gap-2">
                  {RATING_FILTERS.map(filter => (
                    <button
                      key={filter.id}
                      onClick={() => setSelectedRating(filter.id)}
                      className={`px-4 py-2 rounded-lg text-sm transition-all ${
                        selectedRating === filter.id
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Filter */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-3">💰 Цена</label>
                <div className="flex flex-wrap gap-2">
                  {PRICE_FILTERS.map(filter => (
                    <button
                      key={filter.id}
                      onClick={() => setSelectedPrice(filter.id)}
                      className={`px-4 py-2 rounded-lg text-sm transition-all ${
                        selectedPrice === filter.id
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-3">📊 Сортировка</label>
                <select className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-purple-500">
                  <option value="rating">По рейтингу</option>
                  <option value="reviews">По отзывам</option>
                  <option value="name">По названию</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Restaurant List */}
      <section className="max-w-7xl mx-auto px-6 pb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">
            {selectedCuisine !== 'all' 
              ? CUISINE_TAGS.find(t => t.id === selectedCuisine)?.label 
              : 'Все заведения'}
          </h2>
          <span className="text-white/50">{restaurants.length} найдено</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white/5 rounded-3xl overflow-hidden animate-pulse">
                <div className="h-48 bg-white/10"></div>
                <div className="p-6">
                  <div className="h-6 bg-white/10 rounded mb-3"></div>
                  <div className="h-4 bg-white/10 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🍴</div>
            <h3 className="text-2xl font-bold text-white mb-2">Ничего не найдено</h3>
            <p className="text-white/50 mb-6">
              Попробуйте изменить фильтры или запустите парсинг
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={clearFilters}
                className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
              >
                Сбросить фильтры
              </button>
              <Link
                href="/admin"
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:opacity-90 transition-colors"
              >
                Открыть админ-панель
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {restaurants.map((restaurant) => (
              <Link
                key={restaurant.id}
                href={`/restaurants/${restaurant.slug}`}
                className="group bg-white/5 backdrop-blur-sm rounded-3xl overflow-hidden border border-white/10 hover:border-purple-500/50 hover:bg-white/10 transition-all hover:-translate-y-1"
              >
                {/* Image */}
                <div className="h-48 bg-gradient-to-br from-purple-600/50 to-pink-600/50 relative overflow-hidden">
                  {restaurant.images?.[0] ? (
                    <img
                      src={restaurant.images[0]}
                      alt={restaurant.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-6xl">
                      🍽️
                    </div>
                  )}
                  
                  {/* Rating Badge */}
                  {restaurant.rating && (
                    <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1.5">
                      <span className="text-amber-400">★</span>
                      <span className="font-bold text-white">{restaurant.rating.toFixed(1)}</span>
                    </div>
                  )}
                  
                  {/* Price Badge */}
                  {restaurant.priceRange && (
                    <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full text-white text-sm">
                      {restaurant.priceRange}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-purple-300 transition-colors line-clamp-1">
                    {restaurant.name}
                  </h3>
                  <p className="text-white/50 text-sm mb-3 flex items-center gap-1 line-clamp-1">
                    📍 {restaurant.address || restaurant.city}
                  </p>
                  
                  {/* Tags */}
                  {restaurant.cuisine?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {restaurant.cuisine.slice(0, 2).map((c, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-lg"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/40">{restaurant.ratingCount} отзывов</span>
                    <span className="text-purple-400 font-medium group-hover:translate-x-1 transition-transform">
                      Подробнее →
                    </span>
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
                className={`w-10 h-10 rounded-xl font-medium transition-colors ${
                  pagination.page === i + 1
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="text-3xl mb-3">🍽️</div>
          <p className="text-white/40 mb-4">Справочник ресторанов © 2024</p>
          <div className="flex justify-center gap-6 text-sm">
            <Link href="/admin" className="text-white/50 hover:text-white transition-colors">
              Админ-панель
            </Link>
            <a href="#" className="text-white/50 hover:text-white transition-colors">
              О проекте
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
