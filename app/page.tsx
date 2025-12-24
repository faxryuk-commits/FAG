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

export default function Home() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (city) params.set('city', city);
      params.set('page', String(page));
      params.set('limit', '12');

      const res = await fetch(`/api/restaurants?${params}`);
      const data = await res.json();
      
      setRestaurants(data.restaurants || []);
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

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      {/* Hero Section */}
      <header className="relative overflow-hidden bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute inset-0 opacity-30" style={{backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='4'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"}}></div>
        
        <div className="relative max-w-7xl mx-auto px-6 py-16 md:py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">
              🍽️ Справочник ресторанов
            </h1>
            <p className="text-xl md:text-2xl opacity-90 mb-8 max-w-2xl mx-auto">
              Найдите лучшие рестораны в вашем городе
            </p>
            
            {/* Search Form */}
            <form onSubmit={handleSearch} className="max-w-3xl mx-auto">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Поиск ресторанов..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full px-6 py-4 rounded-xl text-gray-800 text-lg shadow-lg focus:outline-none focus:ring-4 focus:ring-white/30"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                </div>
                <input
                  type="text"
                  placeholder="Город"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="md:w-48 px-6 py-4 rounded-xl text-gray-800 text-lg shadow-lg focus:outline-none focus:ring-4 focus:ring-white/30"
                />
                <button
                  type="submit"
                  className="px-8 py-4 bg-white text-red-600 font-bold rounded-xl shadow-lg hover:bg-gray-100 transition-all hover:scale-105"
                >
                  Найти
                </button>
              </div>
            </form>
          </div>
        </div>
        
        {/* Wave decoration */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="rgb(255 251 235)"/>
          </svg>
        </div>
      </header>

      {/* Stats */}
      <section className="max-w-7xl mx-auto px-6 -mt-6 relative z-10">
        <div className="bg-white rounded-2xl shadow-xl p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600">{pagination?.total || 0}</div>
            <div className="text-gray-500">Ресторанов</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-500">4.5+</div>
            <div className="text-gray-500">Средний рейтинг</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-amber-500">15+</div>
            <div className="text-gray-500">Городов</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-500">24/7</div>
            <div className="text-gray-500">Обновления</div>
          </div>
        </div>
      </section>

      {/* Restaurant List */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <h2 className="text-3xl font-bold text-gray-800 mb-8">
          {search || city ? 'Результаты поиска' : 'Популярные рестораны'}
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-lg overflow-hidden animate-pulse">
                <div className="h-48 bg-gray-200"></div>
                <div className="p-6">
                  <div className="h-6 bg-gray-200 rounded mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🍴</div>
            <h3 className="text-2xl font-bold text-gray-700 mb-2">Рестораны не найдены</h3>
            <p className="text-gray-500 mb-6">
              {search || city 
                ? 'Попробуйте изменить параметры поиска'
                : 'Запустите синхронизацию данных в админ-панели'}
            </p>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
            >
              ⚙️ Открыть админ-панель
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {restaurants.map((restaurant) => (
              <Link
                key={restaurant.id}
                href={`/restaurants/${restaurant.slug}`}
                className="group bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all hover:-translate-y-1"
              >
                {/* Image */}
                <div className="h-48 bg-gradient-to-br from-red-400 to-orange-400 relative overflow-hidden">
                  {restaurant.images?.[0] ? (
                    <img
                      src={restaurant.images[0]}
                      alt={restaurant.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-6xl">
                      🍽️
                    </div>
                  )}
                  {restaurant.rating && (
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1 shadow-lg">
                      <span className="text-amber-500">★</span>
                      <span className="font-bold text-gray-800">{restaurant.rating.toFixed(1)}</span>
                    </div>
                  )}
                  {restaurant.priceRange && (
                    <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-white text-sm">
                      {restaurant.priceRange}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-red-600 transition-colors">
                    {restaurant.name}
                  </h3>
                  <p className="text-gray-500 text-sm mb-3 flex items-center gap-1">
                    📍 {restaurant.address || restaurant.city}
                  </p>
                  
                  {restaurant.cuisine?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {restaurant.cuisine.slice(0, 3).map((c, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
                    <span>{restaurant.ratingCount} отзывов</span>
                    <span className="text-red-600 font-medium group-hover:underline">
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
            {[...Array(pagination.pages)].map((_, i) => (
              <button
                key={i}
                onClick={() => fetchRestaurants(i + 1)}
                className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                  pagination.page === i + 1
                    ? 'bg-red-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="text-4xl mb-4">🍽️</div>
          <p className="mb-4">Справочник ресторанов © 2024</p>
          <div className="flex justify-center gap-6">
            <Link href="/admin" className="hover:text-white transition-colors">
              Админ-панель
            </Link>
            <a href="#" className="hover:text-white transition-colors">
              О проекте
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
