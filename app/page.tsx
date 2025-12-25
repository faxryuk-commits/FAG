'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

// Популярные запросы (статические)
const POPULAR_SEARCHES = [
  'плов', 'пицца', 'суши', 'бургер', 'кофе', 'шашлык', 
  'лагман', 'самса', 'стейк', 'роллы', 'шаурма', 'десерт'
];

// Ключ для localStorage
const SEARCH_HISTORY_KEY = 'foodguide_search_history';

// Получить историю из localStorage
function getSearchHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const history = localStorage.getItem(SEARCH_HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch {
    return [];
  }
}

// Сохранить в историю
function saveToHistory(query: string) {
  if (typeof window === 'undefined' || !query.trim()) return;
  try {
    let history = getSearchHistory();
    // Удаляем дубликаты и добавляем в начало
    history = [query, ...history.filter(h => h.toLowerCase() !== query.toLowerCase())];
    // Храним максимум 10 последних
    history = history.slice(0, 10);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Игнорируем ошибки localStorage
  }
}

// Очистить историю
function clearSearchHistory() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch {}
}

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
  distance?: number;
}

// Категории настроения
const MOOD_CATEGORIES = [
  { id: 'romantic', emoji: '💕', label: 'Романтика', query: 'ресторан итальянский французский wine', color: 'from-pink-600 to-rose-500' },
  { id: 'business', emoji: '💼', label: 'Бизнес', query: 'кафе кофейня ланч бизнес', color: 'from-slate-700 to-slate-600' },
  { id: 'family', emoji: '👨‍👩‍👧', label: 'Семья', query: 'семейный пицца бургер детское', color: 'from-amber-500 to-orange-500' },
  { id: 'friends', emoji: '🎉', label: 'Друзья', query: 'бар паб гриль пиво', color: 'from-violet-600 to-purple-500' },
  { id: 'fast', emoji: '⚡', label: 'Быстро', query: 'фастфуд быстрое экспресс доставка', color: 'from-emerald-600 to-green-500' },
  { id: 'coffee', emoji: '☕', label: 'Кофе', query: 'кофейня кафе десерт торт', color: 'from-amber-700 to-yellow-600' },
];

// Типы кухонь
const CUISINES = [
  { id: 'uzbek', label: '🥟 Узбекская', query: 'узбекская плов самса лагман чайхона' },
  { id: 'european', label: '🍝 Европейская', query: 'европейская итальянская французская' },
  { id: 'asian', label: '🍜 Азиатская', query: 'азиатская китайская японская корейская вок' },
  { id: 'meat', label: '🥩 Мясо/Гриль', query: 'стейк гриль мясо шашлык кебаб' },
  { id: 'pizza', label: '🍕 Пицца', query: 'пицца pizza итальянская' },
  { id: 'sushi', label: '🍣 Суши', query: 'суши роллы сашими японская' },
];

interface CategoryStats {
  moods: Array<{ id: string; label: string; emoji: string; count: number }>;
  cuisines: Array<{ id: string; label: string; emoji: string; count: number }>;
  stats: { total: number; avgRating: number; withReviews: number };
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { text: 'Доброе утро', meal: 'Завтрак?', emoji: '🌅' };
  if (hour >= 12 && hour < 17) return { text: 'Добрый день', meal: 'Обед?', emoji: '☀️' };
  if (hour >= 17 && hour < 22) return { text: 'Добрый вечер', meal: 'Ужин?', emoji: '🌆' };
  return { text: 'Доброй ночи', meal: 'Перекус?', emoji: '🌙' };
}

export default function Home() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  
  // Поиск с подсказками
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [showAll, setShowAll] = useState(false);
  const [categoryStats, setCategoryStats] = useState<CategoryStats | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 100; // Увеличили с 50 до 100
  
  // Приветствие - рендерится только на клиенте для избежания hydration mismatch
  const [greeting, setGreeting] = useState({ emoji: '🍽️', text: 'Добро пожаловать', meal: '' });
  
  // Тема: light / dark
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  
  useEffect(() => {
    setGreeting(getTimeGreeting());
    // Загружаем историю поиска
    setSearchHistory(getSearchHistory());
    
    // Определяем тему по времени суток или системной настройке
    const hour = new Date().getHours();
    const isDayTime = hour >= 6 && hour < 20;
    const savedTheme = localStorage.getItem('foodguide_theme') as 'dark' | 'light' | null;
    
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (isDayTime) {
      setTheme('light');
    } else {
      setTheme('dark');
    }
  }, []);
  
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('foodguide_theme', newTheme);
  };

  // Генерация подсказок при вводе
  useEffect(() => {
    if (!search.trim()) {
      // Показываем историю и популярные когда поле пустое но в фокусе
      const historySuggestions = searchHistory.slice(0, 5);
      const popularSuggestions = POPULAR_SEARCHES.filter(
        p => !historySuggestions.includes(p)
      ).slice(0, 5);
      setSuggestions([...historySuggestions, ...popularSuggestions]);
      return;
    }

    // Фильтруем подсказки по введённому тексту
    const lowerSearch = search.toLowerCase();
    const filtered: string[] = [];
    
    // Сначала из истории
    for (const h of searchHistory) {
      if (h.toLowerCase().includes(lowerSearch) && !filtered.includes(h)) {
        filtered.push(h);
      }
    }
    
    // Затем популярные
    for (const p of POPULAR_SEARCHES) {
      if (p.toLowerCase().includes(lowerSearch) && !filtered.includes(p)) {
        filtered.push(p);
      }
    }
    
    setSuggestions(filtered.slice(0, 8));
  }, [search, searchHistory]);

  // Debounced поиск - автопоиск через 400мс после остановки ввода
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    if (search.trim().length >= 2) {
      debounceRef.current = setTimeout(() => {
        setSelectedMood(null);
        setSelectedCuisine(null);
        fetchRestaurants({ search });
      }, 400);
    }
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Закрытие подсказок при клике вне
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Загрузка статистики по категориям
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/categories');
        if (res.ok) {
          const data = await res.json();
          setCategoryStats(data);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    fetchStats();
  }, []);

  // Запрос геолокации
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      return;
    }
    
    setLocationStatus('loading');
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus('success');
      },
      (err) => {
        console.error('Geolocation error:', err);
        setLocationStatus('error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  // Текущие фильтры и offset для loadMore
  const [currentFilters, setCurrentFilters] = useState<{
    search?: string;
    mood?: string;
    cuisineType?: string;
  }>({});
  const [currentOffset, setCurrentOffset] = useState(0);

  // Загрузка ресторанов (без restaurants.length в зависимостях!)
  const fetchRestaurants = useCallback(async (options?: { 
    search?: string; 
    mood?: string; 
    cuisineType?: string;
  }) => {
    setLoading(true);
    
    try {
      const params = new URLSearchParams();
      const filters = options || {};
      
      if (filters.search) {
        params.set('search', filters.search);
      }
      
      if (filters.mood) {
        params.set('mood', filters.mood);
      }
      
      if (filters.cuisineType) {
        params.set('cuisineType', filters.cuisineType);
      }
      
      if (userLocation) {
        params.set('lat', String(userLocation.lat));
        params.set('lng', String(userLocation.lng));
        params.set('sortBy', 'distance');
        params.set('maxDistance', '30');
      }
      
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', '0');
      
      const res = await fetch(`/api/restaurants?${params}`);
      const data = await res.json();
      
      const newRestaurants = data.restaurants || [];
      
      setRestaurants(newRestaurants);
      setCurrentFilters(filters);
      setCurrentOffset(newRestaurants.length);
      setTotalCount(data.pagination?.total || data.total || 0);
      setHasMore(newRestaurants.length === PAGE_SIZE);
    } catch (error) {
      console.error('Error:', error);
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  }, [userLocation]); // Убрали restaurants.length!

  // Загрузить ещё (отдельная функция)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    
    try {
      const params = new URLSearchParams();
      
      if (currentFilters.search) params.set('search', currentFilters.search);
      if (currentFilters.mood) params.set('mood', currentFilters.mood);
      if (currentFilters.cuisineType) params.set('cuisineType', currentFilters.cuisineType);
      
      if (userLocation) {
        params.set('lat', String(userLocation.lat));
        params.set('lng', String(userLocation.lng));
        params.set('sortBy', 'distance');
        params.set('maxDistance', '30');
      }
      
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(currentOffset));
      
      const res = await fetch(`/api/restaurants?${params}`);
      const data = await res.json();
      
      const newRestaurants = data.restaurants || [];
      
      setRestaurants(prev => [...prev, ...newRestaurants]);
      setCurrentOffset(prev => prev + newRestaurants.length);
      setHasMore(newRestaurants.length === PAGE_SIZE);
    } catch (error) {
      console.error('Error loading more:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [currentFilters, currentOffset, userLocation, loadingMore, hasMore]);

  // Начальная загрузка (только один раз!)
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchRestaurants({});
    }
  }, [fetchRestaurants]);

  // Перезагрузка при изменении геолокации
  useEffect(() => {
    if (userLocation && initialLoadDone.current) {
      // Перезагружаем с учётом геолокации
      fetchRestaurants({
        mood: selectedMood || undefined,
        cuisineType: selectedCuisine || undefined
      });
    }
  }, [userLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  // Обработка выбора настроения
  const handleMoodSelect = (mood: typeof MOOD_CATEGORIES[0]) => {
    if (selectedMood === mood.id) {
      setSelectedMood(null);
      setSelectedCuisine(null);
      fetchRestaurants({});
    } else {
      setSelectedMood(mood.id);
      setSelectedCuisine(null);
      fetchRestaurants({ mood: mood.id });
    }
  };

  // Обработка выбора кухни
  const handleCuisineSelect = (cuisine: typeof CUISINES[0]) => {
    if (selectedCuisine === cuisine.id) {
      setSelectedCuisine(null);
      setSelectedMood(null);
      fetchRestaurants({});
    } else {
      setSelectedCuisine(cuisine.id);
      setSelectedMood(null);
      fetchRestaurants({ cuisineType: cuisine.id });
    }
  };

  // Поиск
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      saveToHistory(search.trim());
      setSearchHistory(getSearchHistory());
    }
    setShowSuggestions(false);
    setSelectedMood(null);
    setSelectedCuisine(null);
    fetchRestaurants({ search });
  };

  // Выбор подсказки
  const handleSelectSuggestion = (suggestion: string) => {
    setSearch(suggestion);
    saveToHistory(suggestion);
    setSearchHistory(getSearchHistory());
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    setSelectedMood(null);
    setSelectedCuisine(null);
    fetchRestaurants({ search: suggestion });
  };

  // Обработка клавиатуры в поле поиска
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        if (highlightedIndex >= 0) {
          e.preventDefault();
          handleSelectSuggestion(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  // Очистка истории
  const handleClearHistory = () => {
    clearSearchHistory();
    setSearchHistory([]);
  };

  // Показываем все загруженные рестораны (пагинация на сервере)
  const displayedRestaurants = restaurants;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      theme === 'dark' 
        ? 'bg-gradient-to-br from-[#0f0f1a] via-[#1a1a2e] to-[#16213e]' 
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'
    }`}>
      {/* Compact Header + Search */}
      <header className={`sticky top-0 z-50 backdrop-blur-xl border-b shadow-lg transition-colors duration-300 ${
        theme === 'dark' 
          ? 'bg-[#0f0f1a]/95 border-white/10 shadow-black/20' 
          : 'bg-white/95 border-gray-200 shadow-gray-200/50'
      }`}>
        <div className="max-w-6xl mx-auto px-4 py-2.5">
          {/* Компактная строка: лого + поиск + действия */}
          <div className="flex items-center gap-3">
            {/* Логотип */}
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <img 
                src={theme === 'dark' ? '/delever-icon.svg' : '/Delever logo original svg.svg'}
                alt="Delever" 
                className="h-8 w-auto"
              />
              <span className={`hidden sm:block font-bold text-sm ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Food Map
              </span>
            </Link>
            
            {/* Приветствие - минимальное */}
            <div className={`hidden lg:flex items-center gap-1.5 text-xs ${
              theme === 'dark' ? 'text-white/40' : 'text-gray-500'
            }`}>
              <span>{greeting.emoji}</span>
              <span>{greeting.text}</span>
              <span className="text-white/80">{greeting.meal}</span>
            </div>
            
            {/* Действия справа */}
            <div className="flex items-center gap-1.5 ml-auto">
              {/* Геолокация */}
              <button
                onClick={requestLocation}
                disabled={locationStatus === 'loading'}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-all ${
                  locationStatus === 'success'
                    ? 'bg-green-500/20 text-green-500'
                    : locationStatus === 'error'
                    ? 'bg-red-500/20 text-red-400'
                    : theme === 'dark'
                    ? 'bg-white/5 text-white/50 hover:bg-white/10'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {locationStatus === 'loading' ? '⏳' : '📍'}
                <span className="hidden sm:inline text-[11px]">
                  {locationStatus === 'success' ? 'GPS' : 'Рядом'}
                </span>
              </button>
              
              {/* Тема */}
              <button
                onClick={toggleTheme}
                className={`p-1.5 rounded-lg text-sm transition-all ${
                  theme === 'dark'
                    ? 'bg-white/5 text-white/50 hover:bg-white/10'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
                title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
              
              {/* Админка */}
              <Link 
                href="/admin" 
                className={`p-1.5 rounded-lg text-sm transition-all ${
                  theme === 'dark'
                    ? 'bg-white/5 text-white/50 hover:bg-white/10'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                ⚙️
              </Link>
            </div>
          </div>
          
          {/* Строка поиска */}
          <form onSubmit={handleSearch} className="relative mt-2">
            <div className={`flex items-center gap-2 rounded-xl border transition-colors ${
              theme === 'dark' 
                ? 'bg-white/5 border-white/10' 
                : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="relative flex-1">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="🔍 Поиск по названию, кухне или блюду..."
                  className={`w-full px-3 py-2 bg-transparent text-sm focus:outline-none ${
                    theme === 'dark' 
                      ? 'text-white placeholder-white/30' 
                      : 'text-gray-900 placeholder-gray-400'
                  }`}
                  autoComplete="off"
                />
              </div>
              
              {/* Индикатор + кнопки */}
              <div className="flex items-center gap-1 pr-2">
                {search.length >= 2 && (
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" title="Автопоиск"></span>
                )}
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setShowSuggestions(false);
                      fetchRestaurants({});
                    }}
                    className="p-1 text-white/30 hover:text-white/60 transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            
            {/* Выпадающий список подсказок */}
            {showSuggestions && suggestions.length > 0 && (
              <div 
                ref={suggestionsRef}
                className="absolute top-full left-0 right-0 mt-2 bg-[#12121f] border border-white/20 rounded-xl overflow-hidden z-[100] shadow-2xl shadow-black/50"
              >
                <div className="px-3 py-2 bg-white/5 border-b border-white/10 flex justify-between items-center">
                  <span className="text-xs text-white/50 font-medium">
                    {search ? '💡 Подсказки' : '🕐 Недавние поиски'}
                  </span>
                  {searchHistory.length > 0 && !search && (
                    <button type="button" onClick={handleClearHistory} className="text-xs text-white/40 hover:text-red-400">
                      Очистить
                    </button>
                  )}
                </div>
                
                {suggestions.slice(0, 6).map((suggestion, index) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className={`w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 transition-colors border-b border-white/5 last:border-0 ${
                      highlightedIndex === index 
                        ? 'bg-orange-500/30 text-white' 
                        : 'text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-white/40">{searchHistory.includes(suggestion) ? '🕐' : '🔍'}</span>
                    <span>{suggestion}</span>
                  </button>
                ))}
              </div>
            )}
          </form>
          
          {/* Индикатор результатов - компактный */}
          {(search || selectedMood || selectedCuisine) && (
            <div className="mt-2 flex items-center justify-center gap-2 text-xs">
              {loading ? (
                <span className="text-white/40 flex items-center gap-1">
                  <span className="w-3 h-3 border border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></span>
                  Ищем...
                </span>
              ) : restaurants.length > 0 ? (
                <span className="text-white/50">
                  Найдено: <span className="text-orange-400">{restaurants.length}</span>
                  {totalCount > restaurants.length && <span className="text-white/30"> / {totalCount}</span>}
                </span>
              ) : (
                <span className="text-red-400/70">Не найдено</span>
              )}
              <button
                onClick={() => { setSearch(''); setSelectedMood(null); setSelectedCuisine(null); fetchRestaurants({}); }}
                className="text-white/30 hover:text-white/60"
              >
                ✕ сброс
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Категории - скрываем при активном поиске */}
      {!search && (
        <div className="bg-[#12121f]/50 border-b border-white/5">
          {/* Быстрые фильтры */}
          <section className="px-4 pt-3 pb-2">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                <span className="text-white/30 text-xs shrink-0 uppercase tracking-wide">Настроение</span>
                <span className="text-white/20">|</span>
                {MOOD_CATEGORIES.map((mood) => {
                  const moodStat = categoryStats?.moods.find(m => m.id === mood.id);
                  const count = moodStat?.count || 0;
                  return (
                    <button
                      key={mood.id}
                      onClick={() => handleMoodSelect(mood)}
                      disabled={count === 0}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                        selectedMood === mood.id
                          ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg shadow-orange-500/20'
                          : count === 0 
                            ? 'bg-white/5 text-white/20 cursor-not-allowed'
                            : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 border border-white/10'
                      }`}
                    >
                      <span>{mood.emoji}</span>
                      <span className="hidden sm:inline">{mood.label}</span>
                      {count > 0 && (
                        <span className="text-xs bg-white/10 px-1.5 rounded">{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Типы кухонь */}
          <section className="px-4 pb-3">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                <span className="text-white/30 text-xs shrink-0 uppercase tracking-wide">Кухня</span>
                <span className="text-white/20">|</span>
                {CUISINES.map((cuisine) => {
                  const cuisineStat = categoryStats?.cuisines.find(c => c.id === cuisine.id);
                  const count = cuisineStat?.count || 0;
                  return (
                    <button
                      key={cuisine.id}
                      onClick={() => handleCuisineSelect(cuisine)}
                      disabled={count === 0}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1.5 ${
                        selectedCuisine === cuisine.id
                          ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white font-medium shadow-lg shadow-orange-500/20'
                          : count === 0 
                            ? 'bg-white/5 text-white/20 cursor-not-allowed'
                            : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 border border-white/10'
                      }`}
                    >
                      <span>{cuisine.label}</span>
                      {count > 0 && (
                        <span className="text-xs bg-white/10 px-1.5 rounded">{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Результаты */}
      <section className="px-4 pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {selectedMood && <span>{MOOD_CATEGORIES.find(m => m.id === selectedMood)?.emoji}</span>}
              {selectedCuisine && <span>{CUISINES.find(c => c.id === selectedCuisine)?.label.split(' ')[0]}</span>}
              <span>
                {selectedMood 
                  ? MOOD_CATEGORIES.find(m => m.id === selectedMood)?.label
                  : selectedCuisine
                    ? CUISINES.find(c => c.id === selectedCuisine)?.label.split(' ').slice(1).join(' ')
                    : userLocation 
                      ? 'Рядом с вами' 
                      : 'Все места'}
              </span>
            </h2>
            <span className="text-white/40 text-sm">
              {restaurants.length}{totalCount > restaurants.length ? ` из ${totalCount}` : ''} мест
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden bg-white/5 animate-pulse border border-white/5">
                  <div className="h-48 bg-white/10"></div>
                  <div className="p-4 space-y-3">
                    <div className="h-5 bg-white/10 rounded-lg w-3/4"></div>
                    <div className="h-4 bg-white/10 rounded-lg w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : restaurants.length === 0 ? (
            <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/10">
              <div className="text-8xl mb-6">🍳</div>
              <h3 className="text-2xl font-bold text-white mb-2">Пока пусто</h3>
              <p className="text-white/50 mb-8">Запустите парсинг в админ-панели</p>
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 rounded-xl font-semibold text-white hover:opacity-90 transition-opacity"
              >
                <span>🚀</span>
                <span>Добавить рестораны</span>
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayedRestaurants.map((restaurant) => (
                  <Link
                    key={restaurant.id}
                    href={`/restaurants/${restaurant.slug}`}
                    className="group"
                  >
                    <div className={`rounded-2xl overflow-hidden border transition-colors ${
                      theme === 'dark' 
                        ? 'bg-white/5 border-white/10 hover:border-white/20' 
                        : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md'
                    }`}>
                      {/* Изображение */}
                      <div className="h-44 relative overflow-hidden">
                        {restaurant.images?.[0] ? (
                          <img
                            src={restaurant.images[0]}
                            alt={restaurant.name}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center ${
                            theme === 'dark' 
                              ? 'bg-gradient-to-br from-orange-500/20 to-pink-500/20' 
                              : 'bg-gradient-to-br from-orange-100 to-pink-100'
                          }`}>
                            <span className="text-5xl opacity-30">🍽️</span>
                          </div>
                        )}
                        
                        {/* Многослойный градиент для глубины */}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f1a] via-transparent to-transparent"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        
                        {/* Верхняя панель с бейджами */}
                        <div className="absolute top-0 left-0 right-0 p-3 flex items-start justify-between">
                          {/* Левые бейджи - кухня */}
                          <div className="flex flex-wrap gap-1.5 max-w-[60%]">
                            {restaurant.cuisine?.slice(0, 2).map((c, i) => (
                              <span 
                                key={i} 
                                className="px-2.5 py-1 bg-black/50 backdrop-blur-md rounded-lg text-xs font-medium text-white/90 border border-white/10"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                          
                          {/* Правые бейджи */}
                          <div className="flex flex-col gap-1.5 items-end">
                            {restaurant.priceRange && (
                              <span className="px-2.5 py-1 bg-emerald-500/80 backdrop-blur-sm rounded-lg text-xs font-bold text-white shadow-lg shadow-emerald-500/30">
                                {restaurant.priceRange}
                              </span>
                            )}
                            {restaurant.distance !== undefined && (
                              <span className="px-2.5 py-1 bg-blue-500/80 backdrop-blur-sm rounded-lg text-xs font-bold text-white shadow-lg shadow-blue-500/30">
                                📍 {restaurant.distance < 1 
                                  ? `${Math.round(restaurant.distance * 1000)}м` 
                                  : `${restaurant.distance.toFixed(1)}км`}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Рейтинг - плавающий бейдж внизу */}
                        {restaurant.rating && (
                          <div className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-2 bg-black/70 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl">
                            <div className="flex items-center gap-1">
                              <span className="text-amber-400 text-lg drop-shadow-glow">★</span>
                              <span className="font-black text-lg text-white">{restaurant.rating.toFixed(1)}</span>
                            </div>
                            <div className="w-px h-4 bg-white/20"></div>
                            <span className="text-white/60 text-xs">{restaurant.ratingCount} отзывов</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Контент карточки */}
                      <div className="p-5">
                        {/* Название */}
                        <h3 className={`font-bold text-lg line-clamp-1 transition-colors ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>
                          {restaurant.name}
                        </h3>
                        
                        {/* Адрес */}
                        <div className={`flex items-center gap-2 mt-3 text-sm ${
                          theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                        }`}>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                            theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'
                          }`}>
                            📍
                          </div>
                          <span className="line-clamp-1">{restaurant.address}</span>
                        </div>
                        
                        {/* Нижняя панель - действия */}
                        <div className={`flex items-center justify-between mt-4 pt-4 border-t ${
                          theme === 'dark' ? 'border-white/5' : 'border-gray-100'
                        }`}>
                          <span className={`text-xs ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>
                            {restaurant.cuisine?.length || 0} категорий
                          </span>
                          <div className="flex items-center gap-1.5 text-orange-400 text-sm font-medium group-hover:translate-x-1 transition-transform">
                            <span>Подробнее</span>
                            <span>→</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              
              {/* Загрузить ещё */}
              {hasMore && restaurants.length > 0 && (
                <div className="text-center mt-10">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-8 py-4 bg-gradient-to-r from-orange-500/20 to-pink-500/20 hover:from-orange-500/30 hover:to-pink-500/30 border border-orange-500/30 rounded-2xl font-semibold text-white transition-all disabled:opacity-50 flex items-center gap-3 mx-auto"
                  >
                    {loadingMore ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        <span>Загрузка...</span>
                      </>
                    ) : (
                      <>
                        <span>📥</span>
                        <span>Загрузить ещё</span>
                        {totalCount > 0 && (
                          <span className="text-white/50 text-sm">
                            ({restaurants.length} из {totalCount})
                          </span>
                        )}
                      </>
                    )}
                  </button>
                </div>
              )}
              
              {/* Все загружено */}
              {!hasMore && restaurants.length > 0 && (
                <div className="text-center mt-10 text-white/40">
                  ✨ Показаны все {restaurants.length} заведений
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className={`border-t py-8 ${
        theme === 'dark' ? 'border-white/5' : 'border-gray-200'
      }`}>
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img 
              src={theme === 'dark' ? '/delever-icon.svg' : '/Delever logo original svg.svg'}
              alt="Delever" 
              className="h-5 w-auto" 
            />
            <span className={`font-bold ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
              Food Map
            </span>
          </div>
          <p className={`text-sm ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>
            Карта ресторанов и доставка еды
          </p>
          <div className={`flex items-center justify-center gap-4 mt-3 text-xs ${
            theme === 'dark' ? 'text-white/20' : 'text-gray-300'
          }`}>
            <a href="https://delever.io" target="_blank" rel="noopener" className="hover:opacity-70 transition">
              delever.io
            </a>
            <span>•</span>
            <span>© 2025 Delever</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
