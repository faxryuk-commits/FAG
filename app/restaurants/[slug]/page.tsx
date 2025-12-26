'use client';

import { useState, useEffect, useCallback } from 'react';
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
    author: string | null;
    authorAvatar: string | null;
    authorUrl: string | null;
    authorLevel: string | null;
    authorReviewsCount: number | null;
    isLocalGuide: boolean;
    rating: number;
    text: string | null;
    date: string;
    photos: string[] | null;
    ownerResponse: string | null;
    ownerResponseDate: string | null;
    likesCount: number;
  }[];
}

const DAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

const THEME_KEY = 'foodguide_theme';

export default function RestaurantPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showGallery, setShowGallery] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null);

  // Загрузка темы
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY) as 'dark' | 'light' | null;
    if (saved) {
      setTheme(saved);
    } else {
      const hour = new Date().getHours();
      setTheme(hour >= 6 && hour < 20 ? 'light' : 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
  };

  useEffect(() => {
    if (slug) fetchRestaurant();
  }, [slug]);

  const fetchRestaurant = async () => {
    try {
      const res = await fetch(`/api/restaurants/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setRestaurant(data.restaurant || data);
      }
    } catch (error) {
      console.error('Error fetching restaurant:', error);
    } finally {
      setLoading(false);
    }
  };

  // Точечное обновление данных через Google Places API
  const handleRefresh = async (force = false) => {
    if (!restaurant) return;
    
    setRefreshing(true);
    setRefreshStatus(null);
    
    try {
      const res = await fetch(`/api/restaurants/${slug}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: 'basic', force }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setRefreshStatus('✅ Данные обновлены');
        // Перезагрузим ресторан
        fetchRestaurant();
      } else if (res.status === 429) {
        setRefreshStatus(`⏳ Кулдаун до ${new Date(data.nextAvailable).toLocaleTimeString()}`);
      } else if (res.status === 501) {
        setRefreshStatus('🔧 API не настроен');
      } else {
        setRefreshStatus(`❌ ${data.error || 'Ошибка'}`);
      }
    } catch (error) {
      setRefreshStatus('❌ Ошибка сети');
    } finally {
      setRefreshing(false);
      setTimeout(() => setRefreshStatus(null), 5000);
    }
  };

  const nextImage = useCallback(() => {
    if (restaurant?.images?.length) {
      setCurrentImageIndex((prev) => (prev + 1) % restaurant.images.length);
    }
  }, [restaurant?.images?.length]);

  const prevImage = useCallback(() => {
    if (restaurant?.images?.length) {
      setCurrentImageIndex((prev) => (prev - 1 + restaurant.images.length) % restaurant.images.length);
    }
  }, [restaurant?.images?.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showGallery) {
        if (e.key === 'ArrowRight') nextImage();
        if (e.key === 'ArrowLeft') prevImage();
        if (e.key === 'Escape') setShowGallery(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showGallery, nextImage, prevImage]);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'dark' ? 'bg-[#0f0f1a]' : 'bg-gray-50'
      }`}>
        <div className="text-4xl animate-pulse">🍽️</div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'dark' ? 'bg-[#0f0f1a]' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <div className="text-6xl mb-4">🤔</div>
          <h1 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Место не найдено
          </h1>
          <Link href="/" className="text-orange-500 hover:underline">← Вернуться</Link>
        </div>
      </div>
    );
  }

  const hasImages = restaurant.images && restaurant.images.length > 0;

  return (
    <main className={`min-h-screen transition-colors duration-300 ${
      theme === 'dark' 
        ? 'bg-gradient-to-br from-[#0f0f1a] via-[#1a1a2e] to-[#16213e]' 
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'
    }`}>
      {/* Gallery Modal */}
      {showGallery && hasImages && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={() => setShowGallery(false)}>
          <button onClick={() => setShowGallery(false)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white text-xl">✕</button>
          <button onClick={(e) => { e.stopPropagation(); prevImage(); }} className="absolute left-4 w-12 h-12 rounded-full bg-white/10 text-white text-2xl">‹</button>
          <img src={restaurant.images[currentImageIndex]} alt="" className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl" onClick={(e) => e.stopPropagation()} />
          <button onClick={(e) => { e.stopPropagation(); nextImage(); }} className="absolute right-4 w-12 h-12 rounded-full bg-white/10 text-white text-2xl">›</button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/50 rounded-full text-white text-sm">
            {currentImageIndex + 1} / {restaurant.images.length}
          </div>
        </div>
      )}

      {/* Compact Header */}
      <header className={`sticky top-0 z-40 backdrop-blur-md border-b transition-colors ${
        theme === 'dark' 
          ? 'bg-[#0f0f1a]/95 border-white/5' 
          : 'bg-white/95 border-gray-200 shadow-sm'
      }`}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className={`flex items-center gap-2 transition-colors ${
            theme === 'dark' ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-900'
          }`}>
            <span>←</span>
            <span className="text-sm">Назад</span>
          </Link>
          <div className="flex items-center gap-2">
            {hasImages && (
              <button onClick={() => setShowGallery(true)} className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                theme === 'dark' ? 'bg-white/5 text-white/70 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
                📷 {restaurant.images.length}
              </button>
            )}
            <button 
              onClick={toggleTheme}
              className={`w-8 h-8 rounded-lg text-sm transition-colors ${
                theme === 'dark' ? 'bg-white/5 text-white/70 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button 
              onClick={() => setIsFavorite(!isFavorite)}
              className={`w-8 h-8 rounded-lg text-lg ${
                theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'
              } ${isFavorite ? 'text-red-500' : theme === 'dark' ? 'text-white/50' : 'text-gray-400'}`}
            >
              {isFavorite ? '❤️' : '🤍'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Top Section: Image + Info */}
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          {/* Main Image */}
          {hasImages && (
            <div 
              className="w-full md:w-80 h-48 md:h-56 rounded-2xl overflow-hidden cursor-pointer relative group flex-shrink-0"
              onClick={() => setShowGallery(true)}
            >
              <img src={restaurant.images[0]} alt={restaurant.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <span className="text-white text-lg">📷 Смотреть все</span>
              </div>
              {restaurant.images.length > 1 && (
                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded-lg text-white text-xs">
                  +{restaurant.images.length - 1}
                </div>
              )}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {restaurant.cuisine?.slice(0, 3).map((c, i) => (
                <span key={i} className={`px-2 py-0.5 text-xs rounded-full ${
                  theme === 'dark' ? 'bg-white/10 text-white/70' : 'bg-gray-100 text-gray-600'
                }`}>{c}</span>
              ))}
              {restaurant.priceRange && (
                <span className="px-2 py-0.5 bg-green-500/20 text-green-600 text-xs rounded-full">{restaurant.priceRange}</span>
              )}
            </div>

            {/* Name */}
            <h1 className={`text-2xl md:text-3xl font-bold mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>{restaurant.name}</h1>

            {/* Rating */}
            {restaurant.rating && (
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 rounded-lg">
                  <span className="text-amber-500">★</span>
                  <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {restaurant.rating.toFixed(1)}
                  </span>
                </div>
                <span className={theme === 'dark' ? 'text-white/50' : 'text-gray-500'} style={{fontSize: '0.875rem'}}>
                  {restaurant.ratingCount} отзывов
                </span>
              </div>
            )}

            {/* Address */}
            <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
              📍 {restaurant.address}
            </p>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {restaurant.phone && (
                <a href={`tel:${restaurant.phone}`} className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white text-sm rounded-xl font-medium hover:bg-green-600">
                  📞 Позвонить
                </a>
              )}
              {restaurant.sourceUrl && (
                <a href={restaurant.sourceUrl} target="_blank" className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl transition-colors ${
                  theme === 'dark' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}>
                  🗺️ Карта
                </a>
              )}
              {restaurant.website && (
                <a href={restaurant.website} target="_blank" className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl transition-colors ${
                  theme === 'dark' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}>
                  🌐 Сайт
                </a>
              )}
              <button 
                onClick={() => navigator.share?.({ title: restaurant.name, url: window.location.href })}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl transition-colors ${
                  theme === 'dark' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                📤 Поделиться
              </button>
              {/* Кнопка обновления данных */}
              <button 
                onClick={() => handleRefresh()}
                disabled={refreshing}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl transition-colors ${
                  refreshing ? 'opacity-50 cursor-not-allowed' : ''
                } ${
                  theme === 'dark' ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
                title="Обновить данные из Google Maps (~$0.017)"
              >
                {refreshing ? '⏳' : '🔄'} Обновить
              </button>
            </div>
            {/* Статус обновления */}
            {refreshStatus && (
              <div className={`text-sm px-3 py-1.5 rounded-lg inline-block ${
                refreshStatus.startsWith('✅') ? 'bg-green-500/20 text-green-400' :
                refreshStatus.startsWith('❌') ? 'bg-red-500/20 text-red-400' :
                'bg-yellow-500/20 text-yellow-400'
              }`}>
                {refreshStatus}
              </div>
            )}
          </div>
        </div>

        {/* Grid: Photos + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Photo Grid */}
            {hasImages && restaurant.images.length > 1 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {restaurant.images.slice(0, 12).map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setCurrentImageIndex(idx); setShowGallery(true); }}
                    className="aspect-square rounded-xl overflow-hidden hover:opacity-80 transition-opacity"
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Reviews */}
            <div className={`rounded-2xl p-4 ${
              theme === 'dark' ? 'bg-white/5' : 'bg-white border border-gray-200 shadow-sm'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  💬 Отзывы <span className={`font-normal ${theme === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>({restaurant.reviews?.length || 0})</span>
                </h2>
                {restaurant.rating && (
                  <div className="flex items-center gap-1">
                    <span className="text-amber-400">★★★★★</span>
                    <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{restaurant.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>

              {restaurant.reviews?.length > 0 ? (
                <div className="space-y-3">
                  {restaurant.reviews.slice(0, 5).map((review) => (
                    <div key={review.id} className={`p-3 rounded-xl ${
                      theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'
                    }`}>
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {review.authorAvatar ? (
                            <img src={review.authorAvatar} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            review.author?.[0]?.toUpperCase() || '?'
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {review.author || 'Аноним'}
                              </span>
                              {review.isLocalGuide && (
                                <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-500 text-xs rounded">Local Guide</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 rounded">
                              <span className="text-amber-500 text-xs">★</span>
                              <span className="text-amber-600 text-xs font-bold">{review.rating}</span>
                            </div>
                          </div>
                          <p className={`text-xs mb-1 ${theme === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>
                            {new Date(review.date).toLocaleDateString('ru-RU')}
                            {review.authorReviewsCount && ` • ${review.authorReviewsCount} отзывов`}
                          </p>
                          {review.text && (
                            <p className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
                              {review.text}
                            </p>
                          )}
                          {review.photos && review.photos.length > 0 && (
                            <div className="flex gap-1.5 mt-2">
                              {review.photos.slice(0, 4).map((photo, idx) => (
                                <img key={idx} src={photo} alt="" className="w-14 h-14 rounded-lg object-cover" />
                              ))}
                            </div>
                          )}
                          {review.ownerResponse && (
                            <div className="mt-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                              <p className="text-emerald-500 text-xs font-medium mb-1">Ответ владельца</p>
                              <p className={`text-xs ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>{review.ownerResponse}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {restaurant.reviews.length > 5 && (
                    <button className={`w-full py-2 text-center text-sm ${
                      theme === 'dark' ? 'text-white/50 hover:text-white/70' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                      Показать все ({restaurant.reviews.length})
                    </button>
                  )}
                </div>
              ) : (
                <div className={`text-center py-8 ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>
                  <div className="text-3xl mb-2">💬</div>
                  <p>Пока нет отзывов</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Working Hours */}
            <div className={`rounded-2xl p-4 ${
              theme === 'dark' ? 'bg-white/5' : 'bg-white border border-gray-200 shadow-sm'
            }`}>
              <h3 className={`font-bold mb-3 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                🕐 Время работы
              </h3>
              {restaurant.workingHours?.length > 0 ? (
                <div className="space-y-1">
                  {[1, 2, 3, 4, 5, 6, 0].map((dayNum) => {
                    const h = restaurant.workingHours?.find(wh => wh.dayOfWeek === dayNum);
                    const isToday = new Date().getDay() === dayNum;
                    return (
                      <div key={dayNum} className={`flex justify-between py-1.5 px-2 rounded-lg text-sm ${isToday ? 'bg-green-500/20' : ''}`}>
                        <span className={isToday ? 'text-green-500 font-medium' : theme === 'dark' ? 'text-white/60' : 'text-gray-500'}>
                          {DAYS_SHORT[dayNum]}
                        </span>
                        <span className={!h || h.isClosed 
                          ? theme === 'dark' ? 'text-white/40' : 'text-gray-400'
                          : theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }>
                          {!h ? '—' : h.isClosed ? 'Закрыто' : `${h.openTime}–${h.closeTime}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className={`text-sm text-center py-4 ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>
                  Нет данных
                </p>
              )}
            </div>

            {/* Contacts */}
            <div className={`rounded-2xl p-4 ${
              theme === 'dark' ? 'bg-white/5' : 'bg-white border border-gray-200 shadow-sm'
            }`}>
              <h3 className={`font-bold mb-3 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                📞 Контакты
              </h3>
              <div className="space-y-2">
                {restaurant.phone && (
                  <a href={`tel:${restaurant.phone}`} className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                    theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'
                  }`}>
                    <span className="text-green-500">📱</span>
                    <span className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{restaurant.phone}</span>
                  </a>
                )}
                {restaurant.website && (
                  <a href={restaurant.website} target="_blank" className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                    theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'
                  }`}>
                    <span className="text-blue-500">🌐</span>
                    <span className={`text-sm truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {restaurant.website.replace(/^https?:\/\//, '')}
                    </span>
                  </a>
                )}
                <div className={`flex items-start gap-3 p-2 rounded-lg ${
                  theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'
                }`}>
                  <span className="text-orange-500">📍</span>
                  <span className={`text-sm ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                    {restaurant.address}
                  </span>
                </div>
              </div>
            </div>

            {/* Source */}
            <p className={`text-center text-xs ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>
              Данные: {restaurant.source === 'google' ? 'Google Maps' : restaurant.source === 'yandex' ? 'Яндекс' : '2ГИС'}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
