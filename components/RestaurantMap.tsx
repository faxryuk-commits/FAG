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

interface WorkingHour {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
}

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
  phone?: string;
  website?: string;
  workingHours?: WorkingHour[];
}

interface RestaurantMapProps {
  restaurants: Restaurant[];
  userLocation: { lat: number; lng: number } | null;
  theme: 'dark' | 'light';
}

// Названия дней недели
const DAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

export default function RestaurantMap({ restaurants, userLocation, theme }: RestaurantMapProps) {
  const [isClient, setIsClient] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [restaurantDetails, setRestaurantDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [L, setL] = useState<any>(null);

  useEffect(() => {
    setIsClient(true);
    // Импортируем Leaflet на клиенте
    import('leaflet').then((leaflet) => {
      setL(leaflet.default);
    });
  }, []);

  // Кэш деталей ресторанов
  const detailsCache = useRef<Record<string, any>>({});

  // Загрузка деталей ресторана (в фоне)
  const fetchRestaurantDetails = async (slug: string) => {
    // Если уже в кэше - используем кэш
    if (detailsCache.current[slug]) {
      setRestaurantDetails(detailsCache.current[slug]);
      setLoadingDetails(false);
      return;
    }
    
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/restaurants/${slug}`);
      const data = await res.json();
      const details = data.restaurant || data;
      // Сохраняем в кэш
      detailsCache.current[slug] = details;
      setRestaurantDetails(details);
    } catch (error) {
      console.error('Error fetching restaurant details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Открытие попапа с деталями - МГНОВЕННО
  const handleMarkerClick = (restaurant: Restaurant) => {
    // Сразу показываем модал с имеющимися данными
    setSelectedRestaurant(restaurant);
    setRestaurantDetails(null);
    // Загружаем дополнительные данные в фоне
    fetchRestaurantDetails(restaurant.slug);
  };

  // Закрытие попапа
  const closeModal = () => {
    setSelectedRestaurant(null);
    setRestaurantDetails(null);
  };

  // Форматирование времени работы
  const formatWorkingHours = (hours: WorkingHour[] | undefined) => {
    if (!hours || hours.length === 0) return null;
    
    const today = new Date().getDay();
    const todayHours = hours.find(h => h.dayOfWeek === today);
    
    if (!todayHours) return null;
    if (todayHours.openTime === '00:00' && todayHours.closeTime === '23:59') return null;
    
    return todayHours;
  };

  // Проверка открыт ли сейчас
  const isOpenNow = (hours: WorkingHour[] | undefined) => {
    if (!hours || hours.length === 0) return null;
    
    const now = new Date();
    const today = now.getDay();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const todayHours = hours.find(h => h.dayOfWeek === today);
    if (!todayHours) return null;
    if (todayHours.openTime === '00:00' && todayHours.closeTime === '23:59') return null;
    
    return currentTime >= todayHours.openTime && currentTime <= todayHours.closeTime;
  };

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
              click: () => handleMarkerClick(restaurant)
            }}
          >
            <Tooltip 
              direction="top" 
              offset={[0, -20]} 
              opacity={1}
              permanent={false}
              sticky={false}
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

      {/* Модальное окно с деталями ресторана */}
      {selectedRestaurant && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4"
          style={{ animation: 'modalBgOpen 0.1s ease-out' }}
          onClick={closeModal}
        >
          <div 
            className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-hidden shadow-2xl"
            style={{ animation: 'modalOpen 0.1s ease-out' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Шапка с изображением */}
            <div className="h-52 relative">
              {selectedRestaurant.images?.[0] ? (
                <img 
                  src={selectedRestaurant.images[0]} 
                  alt={selectedRestaurant.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-orange-400 via-pink-500 to-purple-500 flex items-center justify-center">
                  <span className="text-7xl drop-shadow-lg">🍽️</span>
                </div>
              )}
              
              {/* Градиент */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              
              {/* Кнопка закрытия */}
              <button 
                onClick={closeModal}
                className="absolute top-3 right-3 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white text-xl transition-colors"
              >
                ✕
              </button>
              
              {/* Галерея миниатюр */}
              {selectedRestaurant.images?.length > 1 && (
                <div className="absolute bottom-3 left-3 right-3 flex gap-2 overflow-x-auto scrollbar-hide">
                  {selectedRestaurant.images.slice(0, 5).map((img, i) => (
                    <div key={i} className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden border-2 border-white/50">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                  {selectedRestaurant.images.length > 5 && (
                    <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-black/50 flex items-center justify-center text-white text-xs font-bold">
                      +{selectedRestaurant.images.length - 5}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Контент */}
            <div className="p-5 overflow-y-auto max-h-[calc(85vh-208px)]">
              {/* Название и рейтинг */}
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedRestaurant.name}
                </h2>
                {selectedRestaurant.rating && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-xl">
                    <span className="text-amber-500 text-lg">★</span>
                    <span className="font-bold text-gray-900">{selectedRestaurant.rating.toFixed(1)}</span>
                    {selectedRestaurant.ratingCount > 0 && (
                      <span className="text-xs text-gray-500">({selectedRestaurant.ratingCount})</span>
                    )}
                  </div>
                )}
              </div>
              
              {/* Адрес и расстояние */}
              <div className="mt-3 flex items-center gap-3 text-sm text-gray-600">
                <span className="text-gray-400">📍</span>
                <span>{selectedRestaurant.address || 'Адрес не указан'}</span>
                {selectedRestaurant.distance !== undefined && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    {selectedRestaurant.distance < 1 
                      ? `${Math.round(selectedRestaurant.distance * 1000)} м` 
                      : `${selectedRestaurant.distance.toFixed(1)} км`}
                  </span>
                )}
              </div>
              
              {/* Кухня */}
              {selectedRestaurant.cuisine?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedRestaurant.cuisine.map((c, i) => (
                    <span 
                      key={i} 
                      className="px-3 py-1 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/50 rounded-full text-sm text-orange-700 font-medium"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
              
              {/* Время работы */}
              {loadingDetails ? (
                <div className="mt-4 p-4 bg-gray-50 rounded-xl animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ) : restaurantDetails?.workingHours?.length > 0 && (
                <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-gray-900 flex items-center gap-2">
                      🕐 Время работы
                    </span>
                    {isOpenNow(restaurantDetails.workingHours) !== null && (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        isOpenNow(restaurantDetails.workingHours) 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {isOpenNow(restaurantDetails.workingHours) ? '🟢 Открыто' : '🔴 Закрыто'}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5 text-sm">
                    {restaurantDetails.workingHours
                      .filter((h: WorkingHour) => !(h.openTime === '00:00' && h.closeTime === '23:59'))
                      .sort((a: WorkingHour, b: WorkingHour) => a.dayOfWeek - b.dayOfWeek)
                      .map((hour: WorkingHour) => {
                        const isToday = new Date().getDay() === hour.dayOfWeek;
                        return (
                          <div 
                            key={hour.dayOfWeek} 
                            className={`flex justify-between ${isToday ? 'font-semibold text-orange-600' : 'text-gray-600'}`}
                          >
                            <span>{DAYS[hour.dayOfWeek]}</span>
                            <span>{hour.openTime} - {hour.closeTime}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
              
              {/* Контакты */}
              {restaurantDetails && (restaurantDetails.phone || restaurantDetails.website) && (
                <div className="mt-4 space-y-2">
                  {restaurantDetails.phone && (
                    <a 
                      href={`tel:${restaurantDetails.phone}`}
                      className="flex items-center gap-3 p-3 bg-green-50 hover:bg-green-100 rounded-xl text-green-700 transition-colors"
                    >
                      <span className="text-lg">📞</span>
                      <span className="font-medium">{restaurantDetails.phone}</span>
                    </a>
                  )}
                  {restaurantDetails.website && (
                    <a 
                      href={restaurantDetails.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-blue-50 hover:bg-blue-100 rounded-xl text-blue-700 transition-colors"
                    >
                      <span className="text-lg">🌐</span>
                      <span className="font-medium truncate">{restaurantDetails.website.replace(/^https?:\/\//, '')}</span>
                    </a>
                  )}
                </div>
              )}
              
              {/* Кнопки действий */}
              <div className="mt-5 flex gap-3">
                <Link 
                  href={`/restaurants/${selectedRestaurant.slug}`}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-semibold rounded-xl text-center transition-all shadow-lg shadow-orange-500/25"
                >
                  Подробнее →
                </Link>
                {restaurantDetails?.latitude && restaurantDetails?.longitude && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${restaurantDetails.latitude},${restaurantDetails.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
                  >
                    🗺️ Маршрут
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

