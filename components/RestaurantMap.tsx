'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Динамический импорт для избежания SSR ошибок
const MapContainer = dynamic(
  () => import('react-leaflet').then(mod => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then(mod => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then(mod => mod.Marker),
  { ssr: false }
);

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  ratingCount: number;
  images: string[];
  cuisine: string[];
  distance?: number;
}

interface RestaurantMapProps {
  restaurants: Restaurant[];
  userLocation: { lat: number; lng: number } | null;
  theme: 'dark' | 'light';
}

export default function RestaurantMap({ restaurants, userLocation, theme }: RestaurantMapProps) {
  const [isClient, setIsClient] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [sliderIndex, setSliderIndex] = useState(0);
  const [L, setL] = useState<any>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
    import('leaflet').then((leaflet) => {
      setL(leaflet.default);
    });
  }, []);

  // Автопрокрутка слайдера каждые 4 секунды (когда не наведено)
  useEffect(() => {
    if (hoveredId) return;
    
    const topRestaurants = getTopRestaurants();
    if (topRestaurants.length === 0) return;
    
    const interval = setInterval(() => {
      setSliderIndex(prev => (prev + 1) % topRestaurants.length);
    }, 4000);
    
    return () => clearInterval(interval);
  }, [hoveredId, restaurants]);

  // Фильтруем рестораны с координатами
  const validRestaurants = restaurants.filter(r => r.latitude && r.longitude);

  // Топ заведения для слайдера (рейтинг 4.5+ с фото)
  const getTopRestaurants = () => {
    return validRestaurants
      .filter(r => r.rating && r.rating >= 4.5 && r.images?.length > 0)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 10);
  };

  const topRestaurants = getTopRestaurants();

  // Текущий ресторан для отображения в панели
  const currentRestaurant = hoveredId 
    ? validRestaurants.find(r => r.id === hoveredId)
    : topRestaurants[sliderIndex];

  if (!isClient || !L) {
    return (
      <div className={`w-full h-[60vh] rounded-2xl flex items-center justify-center ${
        theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'
      }`}>
        <div className={theme === 'dark' ? 'text-white/50' : 'text-gray-500'}>
          ⏳ Загрузка карты...
        </div>
      </div>
    );
  }

  // Центр карты
  const center: [number, number] = userLocation 
    ? [userLocation.lat, userLocation.lng]
    : [41.311081, 69.240562];

  // Кастомные иконки маркеров
  const createIcon = (isHovered: boolean, hasPhoto: boolean, rating: number | null) => {
    const color = rating && rating >= 4.5 ? '#22c55e' : rating && rating >= 4.0 ? '#f59e0b' : '#ef4444';
    const size = isHovered ? 36 : 28;
    
    return L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          width: ${size}px;
          height: ${size}px;
          background: ${color};
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${isHovered ? '14px' : '11px'};
          transition: all 0.15s;
          cursor: pointer;
        ">
          ${hasPhoto ? '🍽️' : '📍'}
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  const userIcon = L.divIcon({
    className: 'user-marker',
    html: `<div style="width:20px;height:20px;background:#3b82f6;border:2px solid white;border-radius:50%;box-shadow:0 0 0 6px rgba(59,130,246,0.3);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

  // Бесплатные тайлы карт (без API ключа)
  // Dark: CartoDB Dark Matter - тёмная тема
  // Light: CartoDB Voyager - светлая тема
  const tileUrl = theme === 'dark'
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

  // Компонент карточки ресторана
  const RestaurantCard = ({ restaurant, isActive = false }: { restaurant: Restaurant; isActive?: boolean }) => (
    <Link 
      href={`/restaurants/${restaurant.slug}`}
      className={`block rounded-xl overflow-hidden transition-all ${
        isActive 
          ? 'ring-2 ring-orange-500 shadow-lg' 
          : 'hover:shadow-md'
      } ${theme === 'dark' ? 'bg-white/10' : 'bg-white border border-gray-200'}`}
    >
      {/* Изображение */}
      <div className="h-28 sm:h-32 relative overflow-hidden">
        {restaurant.images?.[0] ? (
          <img 
            src={restaurant.images[0]} 
            alt={restaurant.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center">
            <span className="text-3xl">🍽️</span>
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        
        {/* Рейтинг */}
        <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
          {restaurant.rating && (
            <div className="px-2 py-0.5 bg-white/95 rounded-md text-xs font-bold flex items-center gap-1">
              <span className="text-amber-500">★</span>
              <span className="text-gray-900">{restaurant.rating.toFixed(1)}</span>
            </div>
          )}
          {restaurant.distance !== undefined && (
            <div className="px-2 py-0.5 bg-blue-500 rounded-md text-xs font-semibold text-white">
              {restaurant.distance < 1 
                ? `${Math.round(restaurant.distance * 1000)}м` 
                : `${restaurant.distance.toFixed(1)}км`}
            </div>
          )}
        </div>
      </div>
      
      {/* Инфо */}
      <div className="p-2.5">
        <h3 className={`font-bold text-sm line-clamp-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          {restaurant.name}
        </h3>
        <p className={`text-xs line-clamp-1 mt-0.5 ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
          📍 {restaurant.address || 'Ташкент'}
        </p>
        {restaurant.cuisine?.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {restaurant.cuisine.slice(0, 2).map((c, i) => (
              <span 
                key={i} 
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  theme === 'dark' 
                    ? 'bg-white/10 text-white/80' 
                    : 'bg-orange-50 text-orange-700'
                }`}
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-3 h-[60vh] lg:h-[55vh]">
      {/* Левая панель - карточки */}
      <div className={`w-full lg:w-72 flex-shrink-0 rounded-xl overflow-hidden ${
        theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'
      }`}>
        {/* Заголовок панели */}
        <div className={`p-3 border-b ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
              {hoveredId ? '🎯 Выбрано' : '⭐ Топ заведения'}
            </span>
            {!hoveredId && topRestaurants.length > 0 && (
              <div className="flex gap-1">
                {topRestaurants.slice(0, 5).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSliderIndex(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      i === sliderIndex 
                        ? 'bg-orange-500' 
                        : theme === 'dark' ? 'bg-white/20' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Контент панели */}
        <div className="p-3 h-[calc(100%-52px)] overflow-y-auto">
          {currentRestaurant ? (
            <div className="space-y-3">
              {/* Основная карточка */}
              <RestaurantCard 
                restaurant={currentRestaurant} 
                isActive={!!hoveredId}
              />
              
              {/* Быстрые действия */}
              <div className="flex gap-2">
                <Link
                  href={`/restaurants/${currentRestaurant.slug}`}
                  className="flex-1 py-2 px-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white text-xs font-semibold rounded-lg text-center"
                >
                  Подробнее →
                </Link>
                {currentRestaurant.latitude && currentRestaurant.longitude && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${currentRestaurant.latitude},${currentRestaurant.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`py-2 px-3 rounded-lg text-xs font-semibold ${
                      theme === 'dark' ? 'bg-white/10 text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    🗺️
                  </a>
                )}
              </div>
              
              {/* Миниатюры других топ заведений (только когда не наведено) */}
              {!hoveredId && topRestaurants.length > 1 && (
                <div className="pt-2 border-t border-gray-200/20">
                  <div className={`text-[10px] font-medium mb-2 ${theme === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>
                    ЕЩЁ РЕКОМЕНДУЕМ
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {topRestaurants
                      .filter((_, i) => i !== sliderIndex)
                      .slice(0, 4)
                      .map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setSliderIndex(topRestaurants.findIndex(t => t.id === r.id))}
                          className={`text-left p-1.5 rounded-lg transition-colors ${
                            theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-md overflow-hidden flex-shrink-0">
                              {r.images?.[0] ? (
                                <img src={r.images[0]} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-orange-100 flex items-center justify-center text-xs">🍽️</div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className={`text-[10px] font-medium truncate ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
                                {r.name}
                              </div>
                              <div className="text-[10px] text-amber-500">★ {r.rating?.toFixed(1)}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={`text-center py-8 ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>
              <div className="text-3xl mb-2">🗺️</div>
              <div className="text-sm">Наведите на маркер</div>
            </div>
          )}
        </div>
      </div>

      {/* Карта */}
      <div className="flex-1 rounded-xl overflow-hidden relative min-h-[200px]">
        <MapContainer
          center={center}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url={tileUrl}
          />
          
          {userLocation && (
            <Marker 
              position={[userLocation.lat, userLocation.lng]}
              icon={userIcon}
            />
          )}
          
          {validRestaurants.map((restaurant) => (
            <Marker
              key={restaurant.id}
              position={[restaurant.latitude!, restaurant.longitude!]}
              icon={createIcon(
                hoveredId === restaurant.id,
                restaurant.images?.length > 0,
                restaurant.rating
              )}
              eventHandlers={{
                mouseover: () => setHoveredId(restaurant.id),
                mouseout: () => setHoveredId(null),
                click: () => window.location.href = `/restaurants/${restaurant.slug}`
              }}
            />
          ))}
        </MapContainer>
        
        {/* Легенда - компактная */}
        <div className={`absolute bottom-2 left-2 p-2 rounded-lg backdrop-blur-xl text-[10px] z-[1000] ${
          theme === 'dark' ? 'bg-black/60 text-white' : 'bg-white/90 text-gray-600 shadow'
        }`}>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span>4.5+</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span>4.0+</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span>&lt;4.0</span>
          </div>
        </div>
        
        {/* Счётчик */}
        <div className={`absolute top-2 right-2 px-2 py-1 rounded-lg backdrop-blur-xl text-xs z-[1000] ${
          theme === 'dark' ? 'bg-black/60 text-white' : 'bg-white/90 text-gray-600 shadow'
        }`}>
          📍 {validRestaurants.length}
        </div>
      </div>
    </div>
  );
}
