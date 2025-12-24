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

const DAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const DAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export default function RestaurantPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showGallery, setShowGallery] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

  useEffect(() => {
    if (slug) fetchRestaurant();
  }, [slug]);

  const fetchRestaurant = async () => {
    try {
      const res = await fetch(`/api/restaurants/${slug}`);
      if (res.ok) {
        const data = await res.json();
        // API возвращает { restaurant: ... }
        setRestaurant(data.restaurant || data);
      }
    } catch (error) {
      console.error('Error fetching restaurant:', error);
    } finally {
      setLoading(false);
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

  // Keyboard navigation for gallery
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
      <div className="min-h-screen bg-gradient-to-br from-[#0f0f1a] via-[#1a1a2e] to-[#16213e] flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="text-8xl animate-pulse">🍽️</div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f1a] to-transparent"></div>
          </div>
          <p className="mt-6 text-white/60 font-medium">Загружаем вкусности...</p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f0f1a] via-[#1a1a2e] to-[#16213e] flex items-center justify-center">
        <div className="text-center">
          <div className="text-8xl mb-6 opacity-50">🤔</div>
          <h1 className="text-3xl font-bold text-white mb-3">Место не найдено</h1>
          <p className="text-white/50 mb-8">Возможно, оно переехало или закрылось</p>
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-2xl font-medium hover:scale-105 transition-transform"
          >
            ← Вернуться к поиску
          </Link>
        </div>
      </div>
    );
  }

  const hasImages = restaurant.images && restaurant.images.length > 0;
  const currentImage = hasImages ? restaurant.images[currentImageIndex] : null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0f0f1a] via-[#1a1a2e] to-[#16213e]">
      {/* Fullscreen Gallery Modal */}
      {showGallery && hasImages && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={() => setShowGallery(false)}
        >
          <button
            onClick={() => setShowGallery(false)}
            className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 text-white text-2xl hover:bg-white/20 transition-colors z-10"
          >
            ✕
          </button>
          
          <button
            onClick={(e) => { e.stopPropagation(); prevImage(); }}
            className="absolute left-6 w-14 h-14 rounded-full bg-white/10 text-white text-2xl hover:bg-white/20 transition-colors"
          >
            ‹
          </button>
          
          <img
            src={currentImage || ''}
            alt={restaurant.name}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          
          <button
            onClick={(e) => { e.stopPropagation(); nextImage(); }}
            className="absolute right-6 w-14 h-14 rounded-full bg-white/10 text-white text-2xl hover:bg-white/20 transition-colors"
          >
            ›
          </button>
          
          {/* Thumbnails */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
            {restaurant.images.slice(0, 10).map((img, idx) => (
              <button
                key={idx}
                onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(idx); }}
                className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                  idx === currentImageIndex ? 'border-orange-500 scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
          
          {/* Counter */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 rounded-full text-white text-sm">
            {currentImageIndex + 1} / {restaurant.images.length}
          </div>
        </div>
      )}

      {/* Hero Section - Full Screen */}
      <section className="relative h-screen">
        {/* Background Image */}
        {hasImages ? (
          <>
            <div className="absolute inset-0">
              <img
                src={currentImage || ''}
                alt={restaurant.name}
                className="w-full h-full object-cover transition-opacity duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f1a] via-[#0f0f1a]/60 to-transparent"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f1a]/80 to-transparent"></div>
            </div>
            
            {/* Image Navigation */}
            {restaurant.images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-black/30 backdrop-blur-md text-white text-2xl hover:bg-black/50 transition-all z-10"
                >
                  ‹
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-black/30 backdrop-blur-md text-white text-2xl hover:bg-black/50 transition-all z-10"
                >
                  ›
                </button>
                
                {/* Dots Indicator */}
                <div className="absolute bottom-32 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                  {restaurant.images.slice(0, 8).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        idx === currentImageIndex ? 'w-8 bg-orange-500' : 'bg-white/50 hover:bg-white/80'
                      }`}
                    />
                  ))}
                  {restaurant.images.length > 8 && (
                    <span className="text-white/50 text-xs ml-2">+{restaurant.images.length - 8}</span>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-pink-500/20 flex items-center justify-center">
            <span className="text-[200px] opacity-10">🍽️</span>
          </div>
        )}

        {/* Header */}
        <header className="absolute top-0 left-0 right-0 z-20">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link 
              href="/" 
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-black/50 transition-colors"
            >
              <span>←</span>
              <span className="font-medium">Назад</span>
            </Link>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => hasImages && setShowGallery(true)}
                className="px-4 py-2 rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-black/50 transition-colors"
              >
                📷 {restaurant.images?.length || 0} фото
              </button>
              <button 
                onClick={() => setIsFavorite(!isFavorite)}
                className={`w-10 h-10 rounded-full bg-black/30 backdrop-blur-md text-xl hover:bg-black/50 transition-all ${
                  isFavorite ? 'text-red-500' : 'text-white'
                }`}
              >
                {isFavorite ? '❤️' : '🤍'}
              </button>
            </div>
          </div>
        </header>

        {/* Hero Content */}
        <div className="absolute bottom-0 left-0 right-0 z-10">
          <div className="max-w-7xl mx-auto px-6 pb-12">
            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-4">
              {restaurant.cuisine?.map((c, i) => (
                <span
                  key={i}
                  className="px-4 py-1.5 bg-white/10 backdrop-blur-md text-white text-sm rounded-full"
                >
                  {c}
                </span>
              ))}
              {restaurant.priceRange && (
                <span className="px-4 py-1.5 bg-green-500/20 backdrop-blur-md text-green-300 text-sm rounded-full">
                  {restaurant.priceRange}
                </span>
              )}
            </div>
            
            {/* Name */}
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 drop-shadow-2xl">
              {restaurant.name}
            </h1>
            
            {/* Rating & Address */}
            <div className="flex flex-wrap items-center gap-6 mb-8">
              {restaurant.rating && (
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 backdrop-blur-md rounded-full">
                  <span className="text-amber-400 text-xl">★</span>
                  <span className="text-2xl font-bold text-white">{restaurant.rating.toFixed(1)}</span>
                  <span className="text-white/60">({restaurant.ratingCount} отзывов)</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-white/80">
                <span>📍</span>
                <span>{restaurant.address}</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3">
              {restaurant.phone && (
                <a
                  href={`tel:${restaurant.phone}`}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium hover:scale-105 transition-transform shadow-lg shadow-green-500/30"
                >
                  <span>📞</span>
                  Позвонить
                </a>
              )}
              {restaurant.sourceUrl && (
                <a
                  href={restaurant.sourceUrl}
                  target="_blank"
                  className="flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-md text-white rounded-xl font-medium hover:bg-white/20 transition-colors"
                >
                  <span>🗺️</span>
                  На карте
                </a>
              )}
              {restaurant.website && (
                <a
                  href={restaurant.website}
                  target="_blank"
                  className="flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-md text-white rounded-xl font-medium hover:bg-white/20 transition-colors"
                >
                  <span>🌐</span>
                  Сайт
                </a>
              )}
              <button 
                onClick={() => navigator.share?.({ title: restaurant.name, url: window.location.href })}
                className="flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-md text-white rounded-xl font-medium hover:bg-white/20 transition-colors"
              >
                <span>📤</span>
                Поделиться
              </button>
            </div>
          </div>
        </div>

      </section>

      {/* Content Section */}
      <section className="relative z-10 -mt-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Photo Gallery Thumbnails */}
              {hasImages && restaurant.images.length > 1 && (
                <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span>📷</span> Фотографии
                  </h2>
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                    {restaurant.images.slice(0, 11).map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setCurrentImageIndex(idx); setShowGallery(true); }}
                        className="aspect-square rounded-xl overflow-hidden hover:scale-105 transition-transform"
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                    {restaurant.images.length > 11 && (
                      <button
                        onClick={() => setShowGallery(true)}
                        className="aspect-square rounded-xl bg-white/10 flex items-center justify-center text-white font-medium hover:bg-white/20 transition-colors"
                      >
                        +{restaurant.images.length - 11}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Reviews Section */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <span>💬</span> Отзывы
                    <span className="text-white/50 font-normal text-base">({restaurant.reviews?.length || 0})</span>
                  </h2>
                  {restaurant.rating && (
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[1,2,3,4,5].map(star => (
                          <span 
                            key={star} 
                            className={`text-xl ${star <= Math.round(restaurant.rating!) ? 'text-amber-400' : 'text-white/20'}`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                      <span className="text-2xl font-bold text-white">{restaurant.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                {restaurant.reviews?.length > 0 ? (
                  <div className="space-y-4">
                    {(showAllReviews ? restaurant.reviews : restaurant.reviews.slice(0, 5)).map((review) => (
                      <div 
                        key={review.id} 
                        className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
                      >
                        <div className="flex items-start gap-4">
                          {/* Avatar */}
                          <div className="flex-shrink-0">
                            {review.authorAvatar ? (
                              <img 
                                src={review.authorAvatar} 
                                alt={review.author || 'Автор'}
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-pink-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
                                {review.author?.[0]?.toUpperCase() || '?'}
                              </div>
                            )}
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  {review.authorUrl ? (
                                    <a 
                                      href={review.authorUrl} 
                                      target="_blank"
                                      className="font-bold text-white hover:text-orange-400 transition-colors"
                                    >
                                      {review.author || 'Аноним'}
                                    </a>
                                  ) : (
                                    <span className="font-bold text-white">{review.author || 'Аноним'}</span>
                                  )}
                                  {review.isLocalGuide && (
                                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded-full">
                                      Local Guide
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-sm text-white/50">
                                  <span>
                                    {new Date(review.date).toLocaleDateString('ru-RU', { 
                                      day: 'numeric', 
                                      month: 'long', 
                                      year: 'numeric' 
                                    })}
                                  </span>
                                  {review.authorReviewsCount && (
                                    <span>{review.authorReviewsCount} отзывов</span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Rating */}
                              <div className="flex items-center gap-1 px-3 py-1 bg-amber-500/20 rounded-full">
                                <span className="text-amber-400">★</span>
                                <span className="font-bold text-amber-300">{review.rating}</span>
                              </div>
                            </div>
                            
                            {/* Review Text */}
                            {review.text && (
                              <p className="text-white/80 leading-relaxed mb-3">{review.text}</p>
                            )}
                            
                            {/* Review Photos */}
                            {review.photos && Array.isArray(review.photos) && review.photos.length > 0 && (
                              <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                                {review.photos.map((photo, idx) => (
                                  <img 
                                    key={idx}
                                    src={photo}
                                    alt=""
                                    className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                                  />
                                ))}
                              </div>
                            )}
                            
                            {/* Likes */}
                            {review.likesCount > 0 && (
                              <div className="text-sm text-white/40">
                                👍 {review.likesCount} человек считают отзыв полезным
                              </div>
                            )}
                            
                            {/* Owner Response */}
                            {review.ownerResponse && (
                              <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-emerald-400 font-medium">Ответ владельца</span>
                                  {review.ownerResponseDate && (
                                    <span className="text-white/40 text-sm">
                                      {new Date(review.ownerResponseDate).toLocaleDateString('ru-RU')}
                                    </span>
                                  )}
                                </div>
                                <p className="text-white/70 text-sm">{review.ownerResponse}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {restaurant.reviews.length > 5 && !showAllReviews && (
                      <button
                        onClick={() => setShowAllReviews(true)}
                        className="w-full py-4 rounded-xl bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors font-medium"
                      >
                        Показать все отзывы ({restaurant.reviews.length})
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4 opacity-50">💬</div>
                    <p className="text-white/50">Пока нет отзывов</p>
                    <p className="text-white/30 text-sm mt-1">Будьте первым!</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              
              {/* Working Hours */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span>🕐</span> Время работы
                </h2>
                {restaurant.workingHours?.length > 0 ? (
                  <div className="space-y-1">
                    {[1, 2, 3, 4, 5, 6, 0].map((dayNum) => {
                      const h = restaurant.workingHours?.find(wh => wh.dayOfWeek === dayNum);
                      const isToday = new Date().getDay() === dayNum;
                      return (
                        <div
                          key={dayNum}
                          className={`flex justify-between py-2 px-3 rounded-lg transition-colors ${
                            isToday 
                              ? 'bg-green-500/20 border border-green-500/30' 
                              : 'hover:bg-white/5'
                          }`}
                        >
                          <span className={`font-medium text-sm ${isToday ? 'text-green-300' : 'text-white/70'}`}>
                            {DAYS_SHORT[dayNum]}
                            {isToday && <span className="ml-1 text-xs text-green-400">•</span>}
                          </span>
                          <span className={`text-sm ${!h || h.isClosed ? 'text-white/40' : 'text-white'}`}>
                            {!h ? '—' : h.isClosed ? 'Закрыто' : `${h.openTime} – ${h.closeTime}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-white/40 text-center py-4">Информация недоступна</p>
                )}
              </div>

              {/* Contact Info */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span>📞</span> Контакты
                </h2>
                <div className="space-y-4">
                  {restaurant.phone && (
                    <a 
                      href={`tel:${restaurant.phone}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
                    >
                      <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                        📱
                      </div>
                      <div>
                        <div className="text-xs text-white/40">Телефон</div>
                        <div className="text-white group-hover:text-green-400 transition-colors">{restaurant.phone}</div>
                      </div>
                    </a>
                  )}
                  {restaurant.website && (
                    <a 
                      href={restaurant.website}
                      target="_blank"
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
                    >
                      <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                        🌐
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs text-white/40">Веб-сайт</div>
                        <div className="text-white group-hover:text-blue-400 transition-colors truncate">{restaurant.website}</div>
                      </div>
                    </a>
                  )}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                    <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                      📍
                    </div>
                    <div>
                      <div className="text-xs text-white/40">Адрес</div>
                      <div className="text-white">{restaurant.address}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Source Badge */}
              <div className="text-center text-white/30 text-sm">
                Данные: {restaurant.source === 'google' ? 'Google Maps' : restaurant.source === 'yandex' ? 'Яндекс Карты' : '2ГИС'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Spacer */}
      <div className="h-20"></div>
    </main>
  );
}
