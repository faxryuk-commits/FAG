'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  website: string | null;
  email: string | null;
  rating: number | null;
  ratingCount: number;
  priceRange: string | null;
  images: string[];
  cuisine: string[];
  source: string;
  sourceUrl: string | null;
  workingHours: {
    dayOfWeek: number;
    openTime: string;
    closeTime: string;
    isClosed: boolean;
  }[];
  menuItems: {
    id: string;
    name: string;
    description: string | null;
    price: number | null;
    category: string | null;
    image: string | null;
  }[];
  reviews: {
    id: string;
    author: string;
    rating: number;
    text: string | null;
    date: string;
  }[];
}

const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export default function RestaurantPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'menu' | 'reviews'>('info');
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    if (slug) fetchRestaurant();
  }, [slug]);

  const fetchRestaurant = async () => {
    try {
      const res = await fetch(`/api/restaurants/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setRestaurant(data);
      }
    } catch (error) {
      console.error('Error fetching restaurant:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-7xl animate-bounce">🍽️</div>
          <p className="mt-4 text-gray-500 font-medium">Загружаем вкусности...</p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-7xl mb-4">🤔</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Не нашли это место</h1>
          <p className="text-gray-500 mb-6">Возможно, оно переехало или закрылось</p>
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-medium"
          >
            ← Вернуться к поиску
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-orange-100">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-orange-600 transition-colors">
            <span>←</span>
            <span className="font-medium">Назад</span>
          </Link>
          
          <button 
            onClick={() => setIsFavorite(!isFavorite)}
            className={`p-2 rounded-full transition-all ${isFavorite ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}
          >
            <span className="text-2xl">{isFavorite ? '❤️' : '🤍'}</span>
          </button>
        </div>
      </header>

      {/* Hero Image */}
      <section className="relative h-72 md:h-96 bg-gradient-to-br from-orange-200 to-amber-100">
        {restaurant.images?.[0] ? (
          <img
            src={restaurant.images[0]}
            alt={restaurant.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-9xl opacity-30">🍽️</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
        
        {/* Rating overlay */}
        {restaurant.rating && (
          <div className="absolute bottom-6 left-6 bg-white px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2">
            <span className="text-amber-500 text-xl">★</span>
            <span className="text-2xl font-bold text-gray-800">{restaurant.rating.toFixed(1)}</span>
            <span className="text-gray-400">({restaurant.ratingCount} отзывов)</span>
          </div>
        )}
      </section>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 -mt-8 relative z-10">
        {/* Info Card */}
        <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 mb-6">
          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-4">
            {restaurant.cuisine?.map((c, i) => (
              <span
                key={i}
                className="px-3 py-1 bg-orange-100 text-orange-700 text-sm rounded-full font-medium"
              >
                {c}
              </span>
            ))}
            {restaurant.priceRange && (
              <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full font-medium">
                {restaurant.priceRange}
              </span>
            )}
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-3">
            {restaurant.name}
          </h1>
          
          <p className="text-gray-500 flex items-center gap-2 mb-6">
            <span>📍</span>
            {restaurant.address}
          </p>
          
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            {restaurant.phone && (
              <a
                href={`tel:${restaurant.phone}`}
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
              >
                <span>📞</span>
                Позвонить
              </a>
            )}
            {restaurant.sourceUrl && (
              <a
                href={restaurant.sourceUrl}
                target="_blank"
                className="flex items-center gap-2 px-5 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
              >
                <span>🗺️</span>
                На карте
              </a>
            )}
            {restaurant.website && (
              <a
                href={restaurant.website}
                target="_blank"
                className="flex items-center gap-2 px-5 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
              >
                <span>🌐</span>
                Сайт
              </a>
            )}
            <button className="flex items-center gap-2 px-5 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all">
              <span>📤</span>
              Поделиться
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white rounded-2xl p-2 shadow-sm">
          {(['info', 'menu', 'reviews'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                  : 'text-gray-600 hover:bg-orange-50'
              }`}
            >
              {tab === 'info' && '📋 Инфо'}
              {tab === 'menu' && '🍴 Меню'}
              {tab === 'reviews' && `💬 Отзывы (${restaurant.reviews?.length || 0})`}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="pb-12">
          {/* Info Tab */}
          {activeTab === 'info' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contact */}
              <div className="bg-white rounded-3xl shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span>📞</span> Контакты
                </h2>
                <div className="space-y-4">
                  {restaurant.phone && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">📱</div>
                      <div>
                        <div className="text-sm text-gray-400">Телефон</div>
                        <a href={`tel:${restaurant.phone}`} className="font-medium text-gray-800 hover:text-orange-600">
                          {restaurant.phone}
                        </a>
                      </div>
                    </div>
                  )}
                  {restaurant.website && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">🌐</div>
                      <div>
                        <div className="text-sm text-gray-400">Сайт</div>
                        <a href={restaurant.website} target="_blank" className="font-medium text-gray-800 hover:text-orange-600 truncate block max-w-[200px]">
                          {restaurant.website}
                        </a>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">📍</div>
                    <div>
                      <div className="text-sm text-gray-400">Адрес</div>
                      <div className="font-medium text-gray-800">{restaurant.address}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Working Hours */}
              <div className="bg-white rounded-3xl shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span>🕐</span> Время работы
                </h2>
                {restaurant.workingHours?.length > 0 ? (
                  <div className="space-y-2">
                    {restaurant.workingHours
                      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                      .map((h, i) => {
                        const isToday = new Date().getDay() === h.dayOfWeek;
                        return (
                          <div
                            key={i}
                            className={`flex justify-between py-2.5 px-4 rounded-xl ${
                              isToday ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50'
                            }`}
                          >
                            <span className={`font-medium ${isToday ? 'text-green-700' : 'text-gray-600'}`}>
                              {DAYS[h.dayOfWeek]}
                              {isToday && <span className="ml-2 text-xs">сегодня</span>}
                            </span>
                            <span className={h.isClosed ? 'text-red-500' : 'text-gray-800'}>
                              {h.isClosed ? 'Закрыто' : `${h.openTime} – ${h.closeTime}`}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-4">Информация недоступна</p>
                )}
              </div>
            </div>
          )}

          {/* Menu Tab */}
          {activeTab === 'menu' && (
            <div className="bg-white rounded-3xl shadow-sm p-6">
              {restaurant.menuItems?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {restaurant.menuItems.map((item) => (
                    <div key={item.id} className="flex gap-4 p-4 rounded-2xl bg-orange-50 hover:bg-orange-100 transition-colors">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-20 h-20 rounded-xl object-cover" />
                      ) : (
                        <div className="w-20 h-20 rounded-xl bg-orange-200 flex items-center justify-center text-3xl">🍽️</div>
                      )}
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-800">{item.name}</h3>
                        {item.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                        )}
                        {item.price && (
                          <div className="mt-2 text-lg font-bold text-orange-600">{item.price} ₽</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📋</div>
                  <p className="text-gray-400">Меню пока не загружено</p>
                </div>
              )}
            </div>
          )}

          {/* Reviews Tab */}
          {activeTab === 'reviews' && (
            <div className="space-y-4">
              {restaurant.reviews?.length > 0 ? (
                restaurant.reviews.map((review) => (
                  <div key={review.id} className="bg-white rounded-3xl shadow-sm p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-400 rounded-full flex items-center justify-center text-white text-xl font-bold">
                        {review.author[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="font-bold text-gray-800">{review.author}</h4>
                            <p className="text-sm text-gray-400">
                              {new Date(review.date).toLocaleDateString('ru-RU', { 
                                day: 'numeric', 
                                month: 'long', 
                                year: 'numeric' 
                              })}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 bg-amber-100 px-3 py-1 rounded-full">
                            <span className="text-amber-500">★</span>
                            <span className="font-bold text-amber-700">{review.rating}</span>
                          </div>
                        </div>
                        {review.text && (
                          <p className="text-gray-600 leading-relaxed">{review.text}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-3xl shadow-sm p-12 text-center">
                  <div className="text-6xl mb-4">💬</div>
                  <p className="text-gray-400">Пока нет отзывов</p>
                  <p className="text-sm text-gray-300 mt-1">Будьте первым!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
