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

  useEffect(() => {
    if (slug) {
      fetchRestaurant();
    }
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl animate-bounce">🍽️</div>
          <p className="mt-4 text-gray-500">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Ресторан не найден</h1>
          <Link href="/" className="text-red-600 hover:underline">
            ← Вернуться на главную
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero */}
      <header className="relative h-80 bg-gradient-to-br from-red-500 to-orange-400">
        {restaurant.images?.[0] ? (
          <img
            src={restaurant.images[0]}
            alt={restaurant.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-9xl opacity-50">🍽️</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
        
        {/* Back Button */}
        <Link
          href="/"
          className="absolute top-6 left-6 bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-full hover:bg-white/30 transition-colors"
        >
          ← Назад
        </Link>

        {/* Restaurant Info */}
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              {restaurant.cuisine?.slice(0, 3).map((c, i) => (
                <span key={i} className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm">
                  {c}
                </span>
              ))}
            </div>
            <h1 className="text-4xl font-bold mb-2">{restaurant.name}</h1>
            <div className="flex items-center gap-6 text-white/90">
              <span className="flex items-center gap-1">
                📍 {restaurant.address}
              </span>
              {restaurant.rating && (
                <span className="flex items-center gap-1">
                  <span className="text-amber-400">★</span>
                  {restaurant.rating.toFixed(1)} ({restaurant.ratingCount} отзывов)
                </span>
              )}
              {restaurant.priceRange && (
                <span>{restaurant.priceRange}</span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 bg-white rounded-xl p-2 shadow-sm">
          {(['info', 'menu', 'reviews'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-red-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab === 'info' && '📋 Информация'}
              {tab === 'menu' && '🍴 Меню'}
              {tab === 'reviews' && `⭐ Отзывы (${restaurant.reviews?.length || 0})`}
            </button>
          ))}
        </div>

        {/* Info Tab */}
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Contacts */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">📞 Контакты</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-gray-600">
                  <span className="text-2xl">📍</span>
                  <div>
                    <div className="text-sm text-gray-500">Адрес</div>
                    <div className="font-medium">{restaurant.address}</div>
                  </div>
                </div>
                {restaurant.phone && (
                  <div className="flex items-center gap-3 text-gray-600">
                    <span className="text-2xl">📱</span>
                    <div>
                      <div className="text-sm text-gray-500">Телефон</div>
                      <a href={`tel:${restaurant.phone}`} className="font-medium text-red-600 hover:underline">
                        {restaurant.phone}
                      </a>
                    </div>
                  </div>
                )}
                {restaurant.website && (
                  <div className="flex items-center gap-3 text-gray-600">
                    <span className="text-2xl">🌐</span>
                    <div>
                      <div className="text-sm text-gray-500">Сайт</div>
                      <a href={restaurant.website} target="_blank" className="font-medium text-red-600 hover:underline">
                        {restaurant.website}
                      </a>
                    </div>
                  </div>
                )}
                {restaurant.sourceUrl && (
                  <a
                    href={restaurant.sourceUrl}
                    target="_blank"
                    className="inline-block mt-4 px-4 py-2 bg-gray-100 rounded-lg text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    Открыть в {restaurant.source === 'google' ? 'Google Maps' : restaurant.source} →
                  </a>
                )}
              </div>
            </div>

            {/* Working Hours */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">🕐 Время работы</h2>
              {restaurant.workingHours?.length > 0 ? (
                <div className="space-y-2">
                  {restaurant.workingHours
                    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                    .map((h, i) => (
                      <div
                        key={i}
                        className={`flex justify-between py-2 px-3 rounded-lg ${
                          new Date().getDay() === h.dayOfWeek ? 'bg-green-50' : ''
                        }`}
                      >
                        <span className="font-medium">{DAYS[h.dayOfWeek]}</span>
                        <span className={h.isClosed ? 'text-red-500' : 'text-gray-600'}>
                          {h.isClosed ? 'Закрыто' : `${h.openTime} - ${h.closeTime}`}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-gray-500">Информация о времени работы недоступна</p>
              )}
            </div>

            {/* Map Placeholder */}
            {restaurant.latitude && restaurant.longitude && (
              <div className="md:col-span-2 bg-white rounded-2xl shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">🗺️ На карте</h2>
                <div className="h-64 bg-gray-100 rounded-xl flex items-center justify-center">
                  <a
                    href={`https://www.google.com/maps?q=${restaurant.latitude},${restaurant.longitude}`}
                    target="_blank"
                    className="text-red-600 hover:underline"
                  >
                    Открыть в Google Maps →
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Menu Tab */}
        {activeTab === 'menu' && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            {restaurant.menuItems?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {restaurant.menuItems.map((item) => (
                  <div key={item.id} className="flex gap-4 p-4 border border-gray-100 rounded-xl">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-24 h-24 rounded-lg object-cover" />
                    ) : (
                      <div className="w-24 h-24 rounded-lg bg-gray-100 flex items-center justify-center text-3xl">
                        🍽️
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800">{item.name}</h3>
                      {item.description && (
                        <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                      )}
                      {item.price && (
                        <div className="mt-2 text-lg font-bold text-red-600">
                          {item.price} ₽
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <div className="text-5xl mb-4">🍴</div>
                <p>Меню пока недоступно</p>
              </div>
            )}
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            {restaurant.reviews?.length > 0 ? (
              <div className="space-y-4">
                {restaurant.reviews.map((review) => (
                  <div key={review.id} className="p-4 border border-gray-100 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-red-400 to-orange-400 rounded-full flex items-center justify-center text-white font-bold">
                          {review.author[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-gray-800">{review.author}</div>
                          <div className="text-sm text-gray-500">
                            {new Date(review.date).toLocaleDateString('ru-RU')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-amber-500">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={i < review.rating ? '' : 'opacity-30'}>
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                    {review.text && (
                      <p className="text-gray-600 mt-3">{review.text}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <div className="text-5xl mb-4">💬</div>
                <p>Отзывов пока нет</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

