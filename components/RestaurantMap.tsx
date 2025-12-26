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
const Tooltip = dynamic(
  () => import('react-leaflet').then(mod => mod.Tooltip),
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
  const [L, setL] = useState<any>(null);

  useEffect(() => {
    setIsClient(true);
    // Импортируем Leaflet на клиенте
    import('leaflet').then((leaflet) => {
      setL(leaflet.default);
    });
  }, []);

  if (!isClient || !L) {
    return (
      <div className={`w-full h-[70vh] rounded-2xl flex items-center justify-center ${
        theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'
      }`}>
        <div className={theme === 'dark' ? 'text-white/50' : 'text-gray-500'}>
          ⏳ Загрузка карты...
        </div>
      </div>
    );
  }

  // Центр карты - геолокация пользователя или Ташкент
  const center: [number, number] = userLocation 
    ? [userLocation.lat, userLocation.lng]
    : [41.311081, 69.240562]; // Ташкент

  // Фильтруем рестораны с координатами
  const validRestaurants = restaurants.filter(r => r.latitude && r.longitude);

  // Создаём кастомные иконки
  const createIcon = (isHovered: boolean, hasPhoto: boolean, rating: number | null) => {
    const color = rating && rating >= 4.5 ? '#22c55e' : rating && rating >= 4.0 ? '#f59e0b' : '#ef4444';
    const size = isHovered ? 40 : 32;
    
    return L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          width: ${size}px;
          height: ${size}px;
          background: ${color};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${isHovered ? '18px' : '14px'};
          transition: all 0.2s;
          cursor: pointer;
        ">
          ${hasPhoto ? '🍽️' : '📍'}
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  // Иконка пользователя
  const userIcon = L.divIcon({
    className: 'user-marker',
    html: `
      <div style="
        width: 24px;
        height: 24px;
        background: #3b82f6;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.3), 0 4px 12px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  // Выбираем стиль карты в зависимости от темы
  const tileUrl = theme === 'dark'
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  return (
    <div className="w-full h-[70vh] rounded-2xl overflow-hidden relative">
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={tileUrl}
        />
        
        {/* Маркер пользователя */}
        {userLocation && (
          <Marker 
            position={[userLocation.lat, userLocation.lng]}
            icon={userIcon}
          >
            <Tooltip 
              direction="top" 
              offset={[0, -10]}
              className="custom-tooltip"
            >
              <div className="text-center font-medium text-sm px-2 py-1">📍 Вы здесь</div>
            </Tooltip>
          </Marker>
        )}
        
        {/* Маркеры ресторанов */}
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
          >
            <Tooltip 
              direction="top" 
              offset={[0, -15]} 
              opacity={1}
              className="restaurant-tooltip"
            >
              <div className="w-72 bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-100">
                {/* Изображение с градиентом */}
                <div className="h-36 relative overflow-hidden">
                  {restaurant.images?.[0] ? (
                    <img 
                      src={restaurant.images[0]} 
                      alt={restaurant.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-orange-400 via-pink-500 to-purple-500 flex items-center justify-center">
                      <span className="text-5xl drop-shadow-lg">🍽️</span>
                    </div>
                  )}
                  
                  {/* Градиент для читаемости */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  
                  {/* Рейтинг и расстояние */}
                  <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
                    {restaurant.rating && (
                      <div className="px-2.5 py-1 bg-white/95 backdrop-blur-sm rounded-lg text-sm font-bold flex items-center gap-1.5 shadow-lg">
                        <span className="text-amber-500 text-base">★</span>
                        <span className="text-gray-900">{restaurant.rating.toFixed(1)}</span>
                      </div>
                    )}
                    {restaurant.distance !== undefined && (
                      <div className="px-2.5 py-1 bg-blue-500/90 backdrop-blur-sm rounded-lg text-xs font-semibold text-white shadow-lg">
                        {restaurant.distance < 1 
                          ? `${Math.round(restaurant.distance * 1000)} м` 
                          : `${restaurant.distance.toFixed(1)} км`}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Информация */}
                <div className="p-3">
                  <h3 className="font-bold text-gray-900 line-clamp-1 text-base">
                    {restaurant.name}
                  </h3>
                  
                  <p className="text-xs text-gray-500 line-clamp-1 mt-1 flex items-center gap-1">
                    <span className="text-gray-400">📍</span>
                    {restaurant.address || 'Адрес не указан'}
                  </p>
                  
                  {/* Теги кухни */}
                  {restaurant.cuisine?.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {restaurant.cuisine.slice(0, 3).map((c, i) => (
                        <span 
                          key={i} 
                          className="px-2 py-0.5 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/50 rounded-full text-xs text-orange-700 font-medium"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* CTA */}
                  <div className="mt-3 pt-2.5 border-t border-gray-100">
                    <div className="text-xs text-center text-orange-600 font-semibold flex items-center justify-center gap-1.5">
                      <span>Кликните для подробностей</span>
                      <span className="text-sm">→</span>
                    </div>
                  </div>
                </div>
              </div>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
      
      {/* Легенда */}
      <div className={`absolute bottom-4 left-4 p-3 rounded-xl backdrop-blur-xl text-xs z-[1000] ${
        theme === 'dark' 
          ? 'bg-black/70 text-white' 
          : 'bg-white/90 text-gray-700 shadow-lg'
      }`}>
        <div className="font-medium mb-2">Рейтинг:</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span>4.5+ Отлично</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            <span>4.0+ Хорошо</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span>&lt; 4.0</span>
          </div>
        </div>
      </div>
      
      {/* Счётчик */}
      <div className={`absolute top-4 right-4 px-3 py-2 rounded-xl backdrop-blur-xl text-sm z-[1000] ${
        theme === 'dark' 
          ? 'bg-black/70 text-white' 
          : 'bg-white/90 text-gray-700 shadow-lg'
      }`}>
        📍 {validRestaurants.length} мест на карте
      </div>
    </div>
  );
}

