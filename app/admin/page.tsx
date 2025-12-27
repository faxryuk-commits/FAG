'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ScraperField {
  key: string;
  label: string;
  type: string;
  description: string;
  example: any;
  required?: boolean;
  mapTo?: string;
}

interface InputField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'city' | 'category';
  placeholder?: string;
  options?: { value: string; label: string }[];
  default: any;
}

interface Scraper {
  id: string;
  name: string;
  description: string;
  icon: string;
  costPerItem: number;
  avgTimePerItem: number;
  fields: ScraperField[];
  inputFields: InputField[];
}

interface SyncJob {
  id: string;
  source: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  stats: any;
  createdAt: string;
}

interface DbStats {
  total: number;
  bySource: Array<{ source: string; count: number; avgRating: number | null }>;
  potentialDuplicates: number;
}

// Интерфейс для статистики задачи
interface JobStats {
  runId?: string;
  processed?: number;
  errors?: number;
  total?: number;
  lastProcessed?: string;
  processedItems?: Array<{ name: string; status: 'success' | 'error'; error?: string }>;
}

// Интерфейс для использования Apify
interface ApifyUsage {
  currentUsage: {
    totalUsd: number;
    actorComputeUnits: number;
    dataTransferGb: number;
    proxyGb: number;
    storageGb: number;
  };
  limits: {
    maxMonthlyUsd: number;
    usedUsd: number;
    remainingUsd: number;
  };
  usagePercent: number;
}

// Интерфейс для ресторана (для удаления)
interface RestaurantItem {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string | null;
  source: string;
  rating: number | null;
  cuisine: string[];
  isArchived: boolean;
}

// Интерфейс для дубликатов
interface DuplicateRestaurant {
  id: string;
  name: string;
  address: string;
  city: string;
  source: string;
  rating: number | null;
  ratingCount: number;
  images: string[];
  latitude: number;
  longitude: number;
  phone: string | null;
  website: string | null;
}

interface DuplicateGroup {
  id: string;
  restaurants: DuplicateRestaurant[];
  similarity: number;
  distance: number;
  reason: string;
}

// Интерфейс для статистики обогащения
interface EnrichStats {
  total: number;
  stats: {
    noImages: number;
    noImagesTotal: number; // Всего без фото (вкл. недавние)
    noRating: number;
    noHours: number;
    noReviews: number;
    badHours: number; // Записи с плейсхолдер часами 00:00-23:59
    badHoursTotal: number; // Всего с плейсхолдер часами (вкл. кулдаун)
    importedCount: number;
    incompleteImports: number;
    incompleteImportsTotal: number; // Всего неполных (вкл. недавние)
    recentlyUpdated: number; // На кулдауне (обновлены < 7 дней)
  };
  needsEnrichment: number;
  needsHoursUpdate: number;
  needsHoursUpdateTotal: number; // Всего нуждающихся (вкл. кулдаун)
  cooldownDays: number;
}

// Компонент таймера с реалтайм прогрессом
function JobTimer({ 
  startedAt, 
  estimatedSeconds, 
  stats,
}: { 
  startedAt: string; 
  estimatedSeconds: number;
  stats?: JobStats;
}) {
  const [elapsed, setElapsed] = useState(0);
  
  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const interval = setInterval(() => {
      const now = Date.now();
      setElapsed(Math.floor((now - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  // ⚡ УДАЛЁН дублирующий polling - главный компонент уже делает это

  const remaining = Math.max(0, estimatedSeconds - elapsed);
  const realProgress = stats?.total ? ((stats.processed || 0) / stats.total) * 100 : 0;
  const progress = realProgress > 0 ? realProgress : Math.min(100, (elapsed / estimatedSeconds) * 100);
  
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="mt-3">
      {/* Реалтайм статистика */}
      {stats?.total && (
        <div className="mb-3 p-2 rounded-lg bg-white/5">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-white/70">Обработано:</span>
            <span className="text-white font-medium">
              {stats.processed || 0} / {stats.total}
              {stats.errors ? <span className="text-red-400 ml-2">({stats.errors} ошибок)</span> : ''}
            </span>
          </div>
          {stats.lastProcessed && (
            <div className="text-xs text-white/50 truncate">
              Последний: {stats.lastProcessed}
            </div>
          )}
        </div>
      )}

      {/* Список последних обработанных */}
      {stats?.processedItems && stats.processedItems.length > 0 && (
        <div className="mb-3 max-h-32 overflow-y-auto rounded-lg bg-black/20 p-2">
          <div className="text-xs text-white/50 mb-1">Последние записи:</div>
          {stats.processedItems.slice(-5).reverse().map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs py-0.5">
              <span className={item.status === 'success' ? 'text-green-400' : 'text-red-400'}>
                {item.status === 'success' ? '✓' : '✗'}
              </span>
              <span className="text-white/70 truncate flex-1">{item.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Progress bar */}
      <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-white/50">
        <span>⏱️ {formatTime(elapsed)} прошло</span>
        <span>~{formatTime(remaining)} осталось</span>
      </div>
    </div>
  );
}

// Модальное окно выборочного удаления и архивирования
function SelectiveDeleteModal({ 
  isOpen, 
  onClose,
  onDeleted,
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [restaurants, setRestaurants] = useState<RestaurantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [cityFilter, setCityFilter] = useState<string>('');
  const [showArchived, setShowArchived] = useState(false);
  const [archivedCount, setArchivedCount] = useState(0);

  useEffect(() => {
    if (isOpen) {
      fetchRestaurants();
      setSelected(new Set());
    }
  }, [isOpen, showArchived]);

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const url = showArchived 
        ? '/api/restaurants?limit=1000&includeArchived=true'
        : '/api/restaurants?limit=1000';
      const res = await fetch(url);
      const data = await res.json();
      setRestaurants(data.restaurants || []);
      setArchivedCount(data.archivedCount || 0);
    } catch (error) {
      console.error('Error fetching restaurants:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const selectAll = () => {
    const filtered = filteredRestaurants;
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(r => r.id)));
    }
  };

  // Архивирование выбранных
  const archiveSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Архивировать ${selected.size} ресторанов?\n\nОни будут скрыты, но не удалены.`)) return;
    
    setProcessing(true);
    try {
      const res = await fetch('/api/restaurants/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), archive: true }),
      });
      const data = await res.json();
      
      if (res.ok) {
        alert(`✅ ${data.message}`);
        setSelected(new Set());
        fetchRestaurants();
        onDeleted();
      } else {
        alert(`❌ Ошибка: ${data.error}`);
      }
    } catch (error) {
      alert(`❌ Ошибка: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  // Восстановление из архива
  const restoreSelected = async () => {
    if (selected.size === 0) return;
    
    setProcessing(true);
    try {
      const res = await fetch('/api/restaurants/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', ids: Array.from(selected) }),
      });
      const data = await res.json();
      
      if (res.ok) {
        alert(`✅ ${data.message}`);
        setSelected(new Set());
        fetchRestaurants();
        onDeleted();
      } else {
        alert(`❌ Ошибка: ${data.error}`);
      }
    } catch (error) {
      alert(`❌ Ошибка: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  // Удаление выбранных
  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`⚠️ УДАЛИТЬ ${selected.size} ресторанов НАВСЕГДА?\n\nЭто действие нельзя отменить!`)) return;
    
    setProcessing(true);
    try {
      const res = await fetch('/api/restaurants/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const data = await res.json();
      
      if (res.ok) {
        alert(`✅ ${data.message}`);
        setSelected(new Set());
        fetchRestaurants();
        onDeleted();
      } else {
        alert(`❌ Ошибка: ${data.error}`);
      }
    } catch (error) {
      alert(`❌ Ошибка: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const filteredRestaurants = restaurants.filter(r => {
    const matchesSearch = !search || 
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.address.toLowerCase().includes(search.toLowerCase());
    const matchesSource = !sourceFilter || r.source === sourceFilter;
    const matchesCity = !cityFilter || r.city === cityFilter;
    const matchesArchived = showArchived ? r.isArchived : !r.isArchived;
    return matchesSearch && matchesSource && matchesCity && matchesArchived;
  });

  const sources = [...new Set(restaurants.map(r => r.source))];
  const cities = [...new Set(restaurants.map(r => r.city))].sort();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-5xl max-h-[90vh] bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">
              {showArchived ? '📦 Архив' : '🗂️ Управление данными'}
            </h2>
            <p className="text-sm text-white/50">
              {showArchived ? 'Восстановите или удалите архивированные записи' : 'Архивируйте или удалите ненужные данные'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Toggle Archived */}
            <button
              onClick={() => {
                setShowArchived(!showArchived);
                setSelected(new Set());
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                showArchived 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              📦 Архив {archivedCount > 0 && `(${archivedCount})`}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-white/10 flex flex-wrap gap-3 flex-shrink-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Поиск по названию..."
            className="flex-1 min-w-[200px] px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-white/30"
          />
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30"
          >
            <option value="" className="bg-[#1a1a2e]">📍 Все источники</option>
            {sources.map(s => (
              <option key={s} value={s} className="bg-[#1a1a2e]">
                {s === 'google' ? '🗺️ Google' : s === 'yandex' ? '🔴 Яндекс' : '🟢 2ГИС'}
              </option>
            ))}
          </select>
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30"
          >
            <option value="" className="bg-[#1a1a2e]">🏙️ Все города ({cities.length})</option>
            {cities.map(city => (
              <option key={city} value={city} className="bg-[#1a1a2e]">
                {city}
              </option>
            ))}
          </select>
        </div>

        {/* Select All Bar */}
        <div className="px-6 py-2 border-b border-white/10 flex items-center justify-between bg-white/5 flex-shrink-0">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.size === filteredRestaurants.length && filteredRestaurants.length > 0}
              onChange={selectAll}
              className="w-5 h-5 rounded border-white/30 bg-white/10 text-purple-500 focus:ring-purple-500"
            />
            <span className="text-white/70">
              Выбрать все ({filteredRestaurants.length})
            </span>
          </label>
          {selected.size > 0 && (
            <span className="text-purple-300 font-medium">
              Выбрано: {selected.size}
            </span>
          )}
        </div>

        {/* Restaurant List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-4xl animate-spin">⏳</div>
            </div>
          ) : filteredRestaurants.length === 0 ? (
            <div className="text-center py-12 text-white/40">
              <div className="text-4xl mb-2">{showArchived ? '📭' : '✨'}</div>
              <p>{showArchived ? 'Архив пуст' : 'Рестораны не найдены'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRestaurants.map(restaurant => (
                <label
                  key={restaurant.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${
                    selected.has(restaurant.id)
                      ? showArchived ? 'bg-amber-500/20 border-amber-500/50' : 'bg-red-500/20 border-red-500/50'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(restaurant.id)}
                    onChange={() => toggleSelect(restaurant.id)}
                    className={`w-5 h-5 rounded border-white/30 bg-white/10 focus:ring-purple-500 ${
                      showArchived ? 'text-amber-500' : 'text-red-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white truncate">{restaurant.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/50">
                        {restaurant.source === 'google' ? '🗺️' : restaurant.source === 'yandex' ? '🔴' : '🟢'}
                      </span>
                      {restaurant.city && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                          📍 {restaurant.city}
                        </span>
                      )}
                      {restaurant.rating && (
                        <span className="text-xs text-amber-400">★ {restaurant.rating.toFixed(1)}</span>
                      )}
                    </div>
                    <p className="text-sm text-white/40 truncate">{restaurant.address}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 text-white/70 hover:text-white transition-colors"
          >
            Закрыть
          </button>
          
          <div className="flex items-center gap-3">
            {showArchived ? (
              <>
                {/* Режим архива - восстановление и удаление */}
                <button
                  onClick={restoreSelected}
                  disabled={selected.size === 0 || processing}
                  className="px-5 py-2 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {processing ? <span className="animate-spin">⏳</span> : '↩️'} 
                  Восстановить ({selected.size})
                </button>
                <button
                  onClick={deleteSelected}
                  disabled={selected.size === 0 || processing}
                  className="px-5 py-2 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  🗑️ Удалить навсегда
                </button>
              </>
            ) : (
              <>
                {/* Обычный режим - архивирование и удаление */}
                <button
                  onClick={archiveSelected}
                  disabled={selected.size === 0 || processing}
                  className="px-5 py-2 bg-amber-500 text-white font-medium rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {processing ? <span className="animate-spin">⏳</span> : '📦'} 
                  Архивировать ({selected.size})
                </button>
                <button
                  onClick={deleteSelected}
                  disabled={selected.size === 0 || processing}
                  className="px-5 py-2 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  🗑️ Удалить ({selected.size})
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Модальное окно просмотра и объединения дубликатов
function DuplicatesModal({ 
  isOpen, 
  onClose,
  onMerged,
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onMerged: () => void;
}) {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [merging, setMerging] = useState<string | null>(null);
  const [selectedKeep, setSelectedKeep] = useState<Record<string, string>>({});
  const [totalGroups, setTotalGroups] = useState(0);
  const [totalRestaurants, setTotalRestaurants] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  useEffect(() => {
    if (isOpen) {
      setGroups([]);
      setOffset(0);
      fetchDuplicates(0, true);
    }
  }, [isOpen]);

  const fetchDuplicates = async (newOffset: number, reset = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    try {
      const res = await fetch(`/api/duplicates?limit=${LIMIT}&offset=${newOffset}`);
      const data = await res.json();
      
      const newGroups = data.groups || [];
      
      if (reset) {
        setGroups(newGroups);
      } else {
        setGroups(prev => [...prev, ...newGroups]);
      }
      
      setTotalGroups(data.total || 0);
      setTotalRestaurants(data.totalRestaurants || 0);
      setHasMore(data.pagination?.hasMore || false);
      setOffset(newOffset + LIMIT);
      
      // По умолчанию выбираем с наибольшим рейтингом или фото
      const defaults: Record<string, string> = { ...selectedKeep };
      for (const group of newGroups) {
        if (!defaults[group.id]) {
          // Приоритет: есть фото > есть рейтинг > первый
          const sorted = [...group.restaurants].sort((a, b) => {
            const aScore = (a.images?.length || 0) * 10 + (a.rating || 0);
            const bScore = (b.images?.length || 0) * 10 + (b.rating || 0);
            return bScore - aScore;
          });
          defaults[group.id] = sorted[0]?.id || group.restaurants[0]?.id;
        }
      }
      setSelectedKeep(defaults);
    } catch (error) {
      console.error('Error fetching duplicates:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchDuplicates(offset);
    }
  };

  const mergeGroup = async (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    const keepId = selectedKeep[groupId];
    if (!keepId) {
      alert('Выберите какой ресторан оставить');
      return;
    }

    const mergeIds = group.restaurants.filter(r => r.id !== keepId).map(r => r.id);
    
    if (!confirm(`Объединить ${group.restaurants.length} ресторанов?\n\nБудет оставлен: ${group.restaurants.find(r => r.id === keepId)?.name}\nБудут удалены: ${mergeIds.length} записей`)) {
      return;
    }

    setMerging(groupId);
    try {
      const res = await fetch('/api/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepId, mergeIds }),
      });
      const data = await res.json();

      if (res.ok) {
        alert(`✅ ${data.message}`);
        fetchDuplicates(0, true);
        onMerged();
      } else {
        alert(`❌ Ошибка: ${data.error}`);
      }
    } catch (error) {
      alert(`❌ Ошибка: ${error}`);
    } finally {
      setMerging(null);
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'google': return '🗺️';
      case 'yandex': return '🔴';
      case '2gis': return '🟢';
      default: return '📍';
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'google': return 'border-blue-500/50 bg-blue-500/10';
      case 'yandex': return 'border-red-500/50 bg-red-500/10';
      case '2gis': return 'border-green-500/50 bg-green-500/10';
      default: return 'border-white/20 bg-white/5';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-6xl max-h-[90vh] bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              🔍 Потенциальные дубликаты
            </h2>
            <p className="text-sm text-white/50">
              {totalGroups} групп • {totalRestaurants} ресторанов • Показано {groups.length}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setGroups([]);
                setOffset(0);
                fetchDuplicates(0, true);
              }}
              className="px-3 py-1.5 bg-white/10 text-white/70 text-sm rounded-lg hover:bg-white/20 transition-colors"
            >
              🔄 Обновить
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-4xl animate-spin">⏳</div>
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">✨</div>
              <h3 className="text-xl font-bold text-white mb-2">Дубликатов не найдено!</h3>
              <p className="text-white/50">Все рестораны уникальны</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map((group, idx) => (
                <div key={group.id} className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                  {/* Group Header */}
                  <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🔗</span>
                      <div>
                        <div className="text-white font-medium">
                          Группа #{idx + 1} • {group.restaurants.length} ресторанов
                        </div>
                        <div className="text-sm text-amber-400">{group.reason}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => mergeGroup(group.id)}
                      disabled={merging === group.id}
                      className="px-4 py-2 bg-purple-500 text-white text-sm font-medium rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {merging === group.id ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          Объединяю...
                        </>
                      ) : (
                        <>
                          🔗 Объединить
                        </>
                      )}
                    </button>
                  </div>

                  {/* Restaurants in group */}
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.restaurants.map(restaurant => {
                      const isSelected = selectedKeep[group.id] === restaurant.id;
                      return (
                        <button
                          key={restaurant.id}
                          onClick={() => setSelectedKeep({ ...selectedKeep, [group.id]: restaurant.id })}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            isSelected 
                              ? 'border-green-500 bg-green-500/20 ring-2 ring-green-500/30' 
                              : `${getSourceColor(restaurant.source)} hover:border-white/40`
                          }`}
                        >
                          {/* Selection indicator */}
                          <div className="flex items-center justify-between mb-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              restaurant.source === 'google' ? 'bg-blue-500/30 text-blue-300' :
                              restaurant.source === 'yandex' ? 'bg-red-500/30 text-red-300' :
                              'bg-green-500/30 text-green-300'
                            }`}>
                              {getSourceIcon(restaurant.source)} {restaurant.source}
                            </span>
                            {isSelected && (
                              <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded font-medium">
                                ✓ Оставить
                              </span>
                            )}
                          </div>

                          {/* Image */}
                          {restaurant.images[0] && (
                            <div className="w-full h-24 rounded-lg overflow-hidden mb-3 bg-black/20">
                              <img 
                                src={restaurant.images[0]} 
                                alt={restaurant.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          )}

                          {/* Info */}
                          <h4 className="text-white font-medium mb-1 truncate">{restaurant.name}</h4>
                          <p className="text-sm text-white/50 truncate mb-2">{restaurant.address}</p>
                          
                          {/* Stats */}
                          <div className="flex items-center gap-3 text-xs text-white/40">
                            {restaurant.rating && (
                              <span className="flex items-center gap-1">
                                <span className="text-amber-400">★</span>
                                {restaurant.rating.toFixed(1)}
                                <span className="text-white/30">({restaurant.ratingCount})</span>
                              </span>
                            )}
                            {restaurant.phone && <span>📞</span>}
                            {restaurant.website && <span>🌐</span>}
                            <span>{restaurant.images.length} 📷</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              
              {/* Load More Button */}
              {hasMore && (
                <div className="flex justify-center pt-4">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {loadingMore ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        Загрузка...
                      </>
                    ) : (
                      <>
                        📥 Загрузить ещё ({totalGroups - groups.length} осталось)
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between flex-shrink-0">
          <div className="text-white/50 text-sm">
            💡 Выберите ресторан для сохранения в каждой группе. Данные из остальных будут объединены.
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

// Секция сетей и франшиз
// Редактор ресторана
function RestaurantEditor({ 
  restaurantId, 
  onClose, 
  onSaved 
}: { 
  restaurantId: string; 
  onClose: () => void; 
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'menu' | 'hours'>('info');

  useEffect(() => {
    fetchRestaurant();
  }, [restaurantId]);

  const fetchRestaurant = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/restaurants/${restaurantId}`);
      const data = await res.json();
      setRestaurant(data.restaurant);
      
      // Загружаем меню
      const menuRes = await fetch(`/api/restaurants/${restaurantId}/menu`);
      const menuData = await menuRes.json();
      setMenuItems(menuData.items || []);
    } catch (error) {
      console.error('Error fetching restaurant:', error);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Сохраняем основные данные
      const res = await fetch(`/api/restaurants/${restaurantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(restaurant)
      });

      if (!res.ok) throw new Error('Failed to save');

      // Сохраняем меню
      await fetch(`/api/restaurants/${restaurantId}/menu`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: menuItems })
      });

      alert('✅ Сохранено!');
      onSaved();
    } catch (error) {
      alert('❌ Ошибка сохранения');
    }
    setSaving(false);
  };

  const updateField = (field: string, value: any) => {
    setRestaurant((prev: any) => ({ ...prev, [field]: value }));
  };

  const addMenuItem = () => {
    setMenuItems([...menuItems, { name: '', price: '', category: '', description: '' }]);
  };

  const updateMenuItem = (index: number, field: string, value: any) => {
    const updated = [...menuItems];
    updated[index] = { ...updated[index], [field]: value };
    setMenuItems(updated);
  };

  const removeMenuItem = (index: number) => {
    setMenuItems(menuItems.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="text-white">Загрузка...</div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="text-white">Ресторан не найден</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a2e] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Хедер */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">✏️ Редактирование</h2>
            <p className="text-sm text-white/50">{restaurant.name}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl">×</button>
        </div>

        {/* Табы */}
        <div className="flex border-b border-white/10">
          {[
            { id: 'info', label: '📋 Информация' },
            { id: 'menu', label: '🍽️ Меню' },
            { id: 'hours', label: '🕐 Время работы' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Контент */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'info' && (
            <div className="space-y-4">
              {/* Название */}
              <div>
                <label className="block text-sm text-white/60 mb-1">Название</label>
                <input
                  type="text"
                  value={restaurant.name || ''}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                />
              </div>

              {/* Описание */}
              <div>
                <label className="block text-sm text-white/60 mb-1">Описание</label>
                <textarea
                  value={restaurant.description || ''}
                  onChange={(e) => updateField('description', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white resize-none"
                />
              </div>

              {/* Адрес */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1">Адрес</label>
                  <input
                    type="text"
                    value={restaurant.address || ''}
                    onChange={(e) => updateField('address', e.target.value)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">Город</label>
                  <input
                    type="text"
                    value={restaurant.city || ''}
                    onChange={(e) => updateField('city', e.target.value)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                  />
                </div>
              </div>

              {/* Контакты */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1">Телефон</label>
                  <input
                    type="text"
                    value={restaurant.phone || ''}
                    onChange={(e) => updateField('phone', e.target.value)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">Email</label>
                  <input
                    type="email"
                    value={restaurant.email || ''}
                    onChange={(e) => updateField('email', e.target.value)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                  />
                </div>
              </div>

              {/* Ссылки */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1">Сайт</label>
                  <input
                    type="url"
                    value={restaurant.website || ''}
                    onChange={(e) => updateField('website', e.target.value)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">Ссылка на меню</label>
                  <input
                    type="url"
                    value={restaurant.menuUrl || ''}
                    onChange={(e) => updateField('menuUrl', e.target.value)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                  />
                </div>
              </div>

              {/* Ценовая категория и кухня */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1">Ценовая категория</label>
                  <select
                    value={restaurant.priceRange || ''}
                    onChange={(e) => updateField('priceRange', e.target.value)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                  >
                    <option value="">Не указано</option>
                    <option value="$">$ — Бюджетно</option>
                    <option value="$$">$$ — Средне</option>
                    <option value="$$$">$$$ — Выше среднего</option>
                    <option value="$$$$">$$$$ — Премиум</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">Бренд/Сеть</label>
                  <input
                    type="text"
                    value={restaurant.brand || ''}
                    onChange={(e) => updateField('brand', e.target.value)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    placeholder="McDonald's, KFC..."
                  />
                </div>
              </div>

              {/* Типы кухни */}
              <div>
                <label className="block text-sm text-white/60 mb-1">
                  Типы кухни (через запятую)
                </label>
                <input
                  type="text"
                  value={(restaurant.cuisine || []).join(', ')}
                  onChange={(e) => updateField('cuisine', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                  placeholder="Узбекская, Европейская, Фастфуд"
                />
              </div>

              {/* Статусы */}
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-white/60">
                  <input
                    type="checkbox"
                    checked={restaurant.isActive}
                    onChange={(e) => updateField('isActive', e.target.checked)}
                    className="rounded"
                  />
                  Активен
                </label>
                <label className="flex items-center gap-2 text-sm text-white/60">
                  <input
                    type="checkbox"
                    checked={restaurant.isVerified}
                    onChange={(e) => updateField('isVerified', e.target.checked)}
                    className="rounded"
                  />
                  Верифицирован
                </label>
                <label className="flex items-center gap-2 text-sm text-white/60">
                  <input
                    type="checkbox"
                    checked={restaurant.isArchived}
                    onChange={(e) => updateField('isArchived', e.target.checked)}
                    className="rounded"
                  />
                  В архиве
                </label>
              </div>
            </div>
          )}

          {activeTab === 'menu' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/60">
                  {menuItems.length} позиций в меню
                </p>
                <button
                  onClick={addMenuItem}
                  className="px-4 py-2 bg-cyan-500/20 text-cyan-300 text-sm rounded-lg hover:bg-cyan-500/30"
                >
                  + Добавить позицию
                </button>
              </div>

              {menuItems.length === 0 ? (
                <div className="text-center py-12 text-white/40">
                  <p className="text-4xl mb-2">🍽️</p>
                  <p>Меню пустое</p>
                  <p className="text-sm">Добавьте позиции вручную</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {menuItems.map((item, index) => (
                    <div key={index} className="p-4 bg-white/5 rounded-lg border border-white/10">
                      <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-4">
                          <input
                            type="text"
                            value={item.name || ''}
                            onChange={(e) => updateMenuItem(index, 'name', e.target.value)}
                            placeholder="Название блюда"
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            value={item.price || ''}
                            onChange={(e) => updateMenuItem(index, 'price', e.target.value)}
                            placeholder="Цена"
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="text"
                            value={item.category || ''}
                            onChange={(e) => updateMenuItem(index, 'category', e.target.value)}
                            placeholder="Категория"
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="text"
                            value={item.description || ''}
                            onChange={(e) => updateMenuItem(index, 'description', e.target.value)}
                            placeholder="Описание"
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm"
                          />
                        </div>
                        <div className="col-span-1 flex items-center justify-center">
                          <button
                            onClick={() => removeMenuItem(index)}
                            className="text-red-400 hover:text-red-300"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'hours' && (
            <div className="space-y-3">
              <p className="text-sm text-white/60 mb-4">
                Время работы заведения
              </p>
              {[
                { day: 0, name: 'Воскресенье' },
                { day: 1, name: 'Понедельник' },
                { day: 2, name: 'Вторник' },
                { day: 3, name: 'Среда' },
                { day: 4, name: 'Четверг' },
                { day: 5, name: 'Пятница' },
                { day: 6, name: 'Суббота' }
              ].map(({ day, name }) => {
                const hours = restaurant.workingHours?.find((h: any) => h.dayOfWeek === day);
                return (
                  <div key={day} className="flex items-center gap-4 p-3 bg-white/5 rounded-lg">
                    <span className="w-32 text-sm text-white/60">{name}</span>
                    <input
                      type="time"
                      value={hours?.openTime || '09:00'}
                      onChange={(e) => {
                        const newHours = [...(restaurant.workingHours || [])];
                        const idx = newHours.findIndex((h: any) => h.dayOfWeek === day);
                        if (idx >= 0) {
                          newHours[idx] = { ...newHours[idx], openTime: e.target.value };
                        } else {
                          newHours.push({ dayOfWeek: day, openTime: e.target.value, closeTime: '22:00' });
                        }
                        updateField('workingHours', newHours);
                      }}
                      className="px-3 py-1 bg-white/5 border border-white/10 rounded text-white text-sm"
                    />
                    <span className="text-white/40">—</span>
                    <input
                      type="time"
                      value={hours?.closeTime || '22:00'}
                      onChange={(e) => {
                        const newHours = [...(restaurant.workingHours || [])];
                        const idx = newHours.findIndex((h: any) => h.dayOfWeek === day);
                        if (idx >= 0) {
                          newHours[idx] = { ...newHours[idx], closeTime: e.target.value };
                        } else {
                          newHours.push({ dayOfWeek: day, openTime: '09:00', closeTime: e.target.value });
                        }
                        updateField('workingHours', newHours);
                      }}
                      className="px-3 py-1 bg-white/5 border border-white/10 rounded text-white text-sm"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Футер */}
        <div className="p-4 border-t border-white/10 flex justify-between">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white/5 text-white/60 rounded-lg hover:bg-white/10"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : '💾 Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChainsSection() {
  const [stats, setStats] = useState<{
    totalChains: number;
    totalBranches: number;
    franchises: number;
    localChains: number;
  } | null>(null);
  const [chains, setChains] = useState<Array<{
    brand: string;
    type: string;
    count: number;
    avgRating: number | null;
    totalReviews: number;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    fetchChains();
  }, []);

  const fetchChains = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/chains');
      const data = await res.json();
      setStats(data.stats);
      setChains(data.chains || []);
    } catch (error) {
      console.error('Error fetching chains:', error);
    } finally {
      setLoading(false);
    }
  };

  const autoDetectBrands = async () => {
    if (!confirm('Автоматически определить бренды для всех ресторанов?')) return;
    
    setDetecting(true);
    try {
      const res = await fetch('/api/chains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'autoDetect' }),
      });
      const data = await res.json();
      
      if (res.ok) {
        alert(`✅ ${data.message}`);
        fetchChains();
      } else {
        alert(`❌ Ошибка: ${data.error}`);
      }
    } catch (error) {
      alert(`❌ Ошибка: ${error}`);
    } finally {
      setDetecting(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'franchise': return '🌍';
      case 'chain': return '🏪';
      case 'group': return '🏢';
      default: return '📍';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'franchise': return 'Франшиза';
      case 'chain': return 'Сеть';
      case 'group': return 'Группа';
      default: return type;
    }
  };

  return (
    <div className="mt-6 pt-6 border-t border-white/10">
      <h3 className="text-sm font-medium text-white/60 mb-3">🏪 Сети и франшизы</h3>
      <p className="text-xs text-white/40 mb-3">
        Филиалы одной сети не считаются дубликатами
      </p>
      
      {loading ? (
        <div className="text-center py-4 text-white/40">Загрузка...</div>
      ) : stats ? (
        <div className="space-y-3">
          {/* Статистика */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-white/40">Всего сетей</div>
              <div className="text-blue-400 font-bold text-lg">{stats.totalChains}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-white/40">Филиалов</div>
              <div className="text-green-400 font-bold text-lg">{stats.totalBranches}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-white/40">🌍 Франшизы</div>
              <div className="text-purple-400 font-bold text-lg">{stats.franchises}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-white/40">🏪 Локальные</div>
              <div className="text-amber-400 font-bold text-lg">{stats.localChains}</div>
            </div>
          </div>

          {/* Топ сетей */}
          {chains.length > 0 && (
            <div className="bg-white/5 rounded-lg p-3 max-h-40 overflow-y-auto">
              <div className="text-xs text-white/40 mb-2">Топ сетей:</div>
              <div className="space-y-1">
                {chains.slice(0, 10).map((chain, idx) => (
                  <div key={chain.brand} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-white/30">{idx + 1}.</span>
                      <span>{getTypeIcon(chain.type)}</span>
                      <span className="text-white">{chain.brand}</span>
                      <span className="text-xs text-white/30">({getTypeLabel(chain.type)})</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-white/50">{chain.count} точек</span>
                      {chain.avgRating && (
                        <span className="text-amber-400">★ {chain.avgRating}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Кнопка автоопределения */}
          <button
            onClick={autoDetectBrands}
            disabled={detecting}
            className="w-full py-2.5 bg-blue-500/20 text-blue-300 text-sm rounded-lg hover:bg-blue-500/30 transition-colors font-medium disabled:opacity-50"
          >
            {detecting ? '⏳ Определяю...' : '🔍 Автоопределение брендов'}
          </button>
        </div>
      ) : (
        <div className="text-center py-4 text-red-400">Ошибка загрузки</div>
      )}
    </div>
  );
}

// Секция качества данных
function QualitySection() {
  const [stats, setStats] = useState<any>(null);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchQuality = async (currentFilter = filter) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quality?filter=${currentFilter}&limit=100`);
      const data = await res.json();
      setStats(data.stats);
      setRestaurants(data.restaurants || []);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error fetching quality:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQuality();
  }, []);

  const handleArchive = async (type: 'selected' | 'filter' | 'critical') => {
    let body: any = { action: 'archive' };
    
    if (type === 'selected') {
      body.ids = Array.from(selectedIds);
    } else if (type === 'critical') {
      body.filter = 'critical';
    } else {
      body.filter = filter;
    }

    if (!confirm(`Архивировать ${type === 'selected' ? selectedIds.size : 'выбранные'} записей?`)) return;

    const res = await fetch('/api/quality', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    
    if (res.ok) {
      alert(`✅ ${data.message}`);
      fetchQuality();
    } else {
      alert(`❌ ${data.error}`);
    }
  };

  const handleRestore = async () => {
    if (!confirm('Восстановить все архивированные записи?')) return;

    const res = await fetch('/api/quality', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore' })
    });
    const data = await res.json();
    
    if (res.ok) {
      alert(`✅ ${data.message}`);
      fetchQuality();
    } else {
      alert(`❌ ${data.error}`);
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === restaurants.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(restaurants.map(r => r.id)));
    }
  };

  const filters = [
    { id: 'all', label: 'Все', count: stats?.total },
    { id: 'no_photos', label: '📷 Без фото', count: stats?.issues?.no_photos, color: 'red' },
    { id: 'no_rating', label: '⭐ Без рейтинга', count: stats?.issues?.no_rating, color: 'red' },
    { id: 'no_reviews', label: '💬 Без отзывов', count: stats?.issues?.no_reviews, color: 'orange' },
    { id: 'no_phone', label: '📞 Без телефона', count: stats?.issues?.no_phone, color: 'yellow' },
    { id: 'low_rating', label: '👎 Низкий рейтинг', count: stats?.issues?.low_rating, color: 'orange' },
    { id: 'low_quality', label: '⚠️ Низкое качество', count: null, color: 'red' },
    { id: 'archived', label: '📦 Архив', count: stats?.archived, color: 'gray' },
  ];

  const getIssueLabel = (issue: string) => {
    const labels: Record<string, string> = {
      no_photos: '📷',
      no_reviews: '💬',
      no_rating: '⭐',
      no_phone: '📞',
      no_hours: '🕐',
      low_rating: '👎'
    };
    return labels[issue] || issue;
  };

  return (
    <div className="mt-6 pt-6 border-t border-white/10">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-white/60">📊 Качество данных</h3>
        <button
          onClick={() => setShowModal(true)}
          className="text-xs text-cyan-400 hover:text-cyan-300"
        >
          Подробнее →
        </button>
      </div>

      {loading && !stats ? (
        <div className="text-white/40 text-sm">Загрузка...</div>
      ) : stats && (
        <>
          {/* Статистика */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-green-500/10 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-green-400">
                {stats.total - (stats.issues?.no_photos || 0) - (stats.issues?.no_rating || 0)}
              </div>
              <div className="text-xs text-white/40">Качественных</div>
            </div>
            <div className="bg-red-500/10 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-red-400">
                {stats.issues?.critical || 0}
              </div>
              <div className="text-xs text-white/40">Критичных</div>
            </div>
          </div>

          {/* Быстрые проблемы */}
          <div className="space-y-1 mb-3">
            {stats.issues?.no_photos > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">📷 Без фото</span>
                <span className="text-red-400">{stats.issues.no_photos}</span>
              </div>
            )}
            {stats.issues?.no_rating > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">⭐ Без рейтинга</span>
                <span className="text-red-400">{stats.issues.no_rating}</span>
              </div>
            )}
            {stats.issues?.no_reviews > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">💬 Без отзывов</span>
                <span className="text-orange-400">{stats.issues.no_reviews}</span>
              </div>
            )}
            {stats.archived > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">📦 В архиве</span>
                <span className="text-white/40">{stats.archived}</span>
              </div>
            )}
          </div>

          {/* Кнопки действий */}
          <div className="flex gap-2">
            <button
              onClick={() => handleArchive('critical')}
              disabled={!stats.issues?.critical}
              className="flex-1 py-2 bg-red-500/20 text-red-300 text-xs rounded-lg hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              📦 Архивировать критичные
            </button>
            {stats.archived > 0 && (
              <button
                onClick={handleRestore}
                className="py-2 px-3 bg-green-500/20 text-green-300 text-xs rounded-lg hover:bg-green-500/30"
              >
                ↩️
              </button>
            )}
          </div>
        </>
      )}

      {/* Модальное окно с полным списком */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a2e] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">📊 Управление качеством данных</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-white/60 hover:text-white text-xl"
              >
                ×
              </button>
            </div>

            {/* Фильтры */}
            <div className="p-4 border-b border-white/10">
              <div className="flex flex-wrap gap-2">
                {filters.map(f => (
                  <button
                    key={f.id}
                    onClick={() => {
                      setFilter(f.id);
                      fetchQuality(f.id);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      filter === f.id
                        ? 'bg-cyan-500 text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {f.label}
                    {f.count !== null && f.count !== undefined && (
                      <span className="ml-1 opacity-60">({f.count})</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Панель действий */}
            {selectedIds.size > 0 && (
              <div className="p-3 bg-cyan-500/10 border-b border-white/10 flex items-center justify-between">
                <span className="text-sm text-cyan-300">
                  Выбрано: {selectedIds.size}
                </span>
                <button
                  onClick={() => handleArchive('selected')}
                  className="px-4 py-1.5 bg-red-500/20 text-red-300 text-sm rounded-lg hover:bg-red-500/30"
                >
                  📦 Архивировать выбранные
                </button>
              </div>
            )}

            {/* Список */}
            <div className="flex-1 overflow-auto p-4">
              {loading ? (
                <div className="text-center text-white/40 py-8">Загрузка...</div>
              ) : restaurants.length === 0 ? (
                <div className="text-center text-white/40 py-8">Нет записей</div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={selectAll}
                      className="text-xs text-cyan-400 hover:text-cyan-300"
                    >
                      {selectedIds.size === restaurants.length ? 'Снять все' : 'Выбрать все'}
                    </button>
                    <span className="text-xs text-white/40">
                      ({restaurants.length} записей)
                    </span>
                  </div>

                  <div className="space-y-2">
                    {restaurants.map(r => (
                      <div
                        key={r.id}
                        className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                          selectedIds.has(r.id)
                            ? 'bg-cyan-500/10 border-cyan-500/30'
                            : 'bg-white/5 border-white/10 hover:border-white/20'
                        } ${r.isArchived ? 'opacity-50' : ''}`}
                        onClick={() => toggleSelect(r.id)}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(r.id)}
                            onChange={() => toggleSelect(r.id)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white truncate">
                                {r.name}
                              </span>
                              {r.isArchived && (
                                <span className="text-xs bg-gray-500/20 text-gray-400 px-1.5 py-0.5 rounded">
                                  архив
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-white/40 truncate">
                              {r.address}
                            </div>
                            <div className="flex items-center gap-3 mt-1.5">
                              {/* Качество */}
                              <div className={`text-xs font-medium ${
                                r.qualityScore >= 70 ? 'text-green-400' :
                                r.qualityScore >= 40 ? 'text-yellow-400' : 'text-red-400'
                              }`}>
                                {r.qualityScore}%
                              </div>
                              {/* Проблемы */}
                              <div className="flex gap-1">
                                {r.issues.map((issue: string) => (
                                  <span
                                    key={issue}
                                    className="text-sm opacity-60"
                                    title={issue}
                                  >
                                    {getIssueLabel(issue)}
                                  </span>
                                ))}
                              </div>
                              {/* Данные */}
                              <div className="flex items-center gap-2 text-xs text-white/40 ml-auto">
                                {r.rating && (
                                  <span>⭐ {r.rating.toFixed(1)}</span>
                                )}
                                {r.ratingCount > 0 && (
                                  <span>💬 {r.ratingCount}</span>
                                )}
                                {(r.images as string[])?.length > 0 && (
                                  <span>📷 {(r.images as string[]).length}</span>
                                )}
                                {/* Кнопка редактирования */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingId(r.id);
                                  }}
                                  className="ml-2 px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded hover:bg-cyan-500/30"
                                >
                                  ✏️
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Футер */}
            <div className="p-4 border-t border-white/10 flex justify-between">
              <button
                onClick={() => fetchQuality()}
                className="px-4 py-2 bg-white/5 text-white/60 rounded-lg hover:bg-white/10"
              >
                🔄 Обновить
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Редактор ресторана */}
      {editingId && (
        <RestaurantEditor
          restaurantId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            fetchQuality();
          }}
        />
      )}
    </div>
  );
}

// Секция обогащения данных
function EnrichSection() {
  const [stats, setStats] = useState<EnrichStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [result, setResult] = useState<{ jobId?: string; message?: string; error?: string } | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/enrich');
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching enrich stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEnrichment = async (batchSize: number, mode: string = 'incomplete', force: boolean = false) => {
    const modeLabel = mode === 'hours' ? 'обновление часов' : 'обогащение';
    const useForce = force || forceUpdate;
    const forceNote = useForce ? '\n\n⚠️ ПРИНУДИТЕЛЬНОЕ обновление (игнорирует 7-дневный кулдаун)' : '';
    if (!confirm(`Запустить ${modeLabel} для ${batchSize} записей?${forceNote}\n\nЭто использует Apify кредиты.`)) return;
    
    setEnriching(true);
    setResult(null);
    
    try {
      const res = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize, mode, force: useForce }),
      });
      const data = await res.json();
      
      if (res.ok) {
        setResult({ message: data.message, jobId: data.jobId });
      } else {
        const errorMsg = data.details 
          ? `${data.error}: ${data.details}` 
          : data.error || 'Ошибка запуска';
        setResult({ error: errorMsg });
      }
    } catch (error: any) {
      setResult({ error: `Сетевая ошибка: ${error?.message || error}` });
    } finally {
      setEnriching(false);
      fetchStats();
    }
  };

  // Принудительное обновление (без подтверждения чекбокса)
  const startEnrichmentForce = (batchSize: number, mode: string) => {
    startEnrichment(batchSize, mode, true);
  };

  return (
    <div className="mt-6 pt-6 border-t border-white/10">
      <h3 className="text-sm font-medium text-white/60 mb-3">🔄 Актуализация данных</h3>
      <p className="text-xs text-white/40 mb-3">
        Обогатить неполные записи (фото, рейтинги, отзывы) через Google Maps
      </p>
      
      {loading ? (
        <div className="text-center py-4 text-white/40">Загрузка...</div>
      ) : stats ? (
        <div className="space-y-3">
          {/* Информация о кулдауне */}
          {stats.stats.recentlyUpdated > 0 && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-blue-300 text-sm font-medium mb-1">
                <span>🛡️</span>
                <span>{stats.stats.recentlyUpdated} записей на кулдауне</span>
              </div>
              <p className="text-xs text-white/50">
                Обновлены за последние {stats.cooldownDays || 7} дней. 
                Используйте "Принудительно" для повторного обновления.
              </p>
            </div>
          )}
          
          {/* Чекбокс принудительного обновления */}
          <label className="flex items-center gap-2 cursor-pointer p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
            <input
              type="checkbox"
              checked={forceUpdate}
              onChange={(e) => setForceUpdate(e.target.checked)}
              className="w-4 h-4 rounded accent-orange-500"
            />
            <span className="text-sm text-white/70">
              ⚠️ Принудительно (игнорировать 7-дневный кулдаун)
            </span>
          </label>
          
          {/* Статистика */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-white/40">Без фото</div>
              <div className="text-orange-400 font-bold text-lg">
                {stats.stats.noImages}
                {stats.stats.noImagesTotal !== stats.stats.noImages && (
                  <span className="text-xs text-white/30 ml-1">
                    (всего {stats.stats.noImagesTotal})
                  </span>
                )}
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-white/40">Без рейтинга</div>
              <div className="text-yellow-400 font-bold text-lg">{stats.stats.noRating}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-white/40">Импортировано</div>
              <div className="text-blue-400 font-bold text-lg">{stats.stats.importedCount}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-white/40">К обогащению</div>
              <div className="text-red-400 font-bold text-lg">
                {stats.needsEnrichment}
                {stats.stats.incompleteImportsTotal !== stats.stats.incompleteImports && (
                  <span className="text-xs text-white/30 ml-1">
                    (всего {stats.stats.incompleteImportsTotal})
                  </span>
                )}
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-white/40">⏰ Плейсхолдер часы</div>
              <div className="text-orange-400 font-bold text-lg">{stats.stats.badHours || 0}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-white/40">🛡️ На кулдауне</div>
              <div className="text-cyan-400 font-bold text-lg">{stats.stats.recentlyUpdated || 0}</div>
            </div>
          </div>
          
          {/* Секция обновления рабочих часов */}
          {(stats.needsHoursUpdateTotal > 0 || stats.stats.badHoursTotal > 0) && (
            <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <h4 className="text-orange-300 font-medium text-sm mb-2">⏰ Обновить время работы</h4>
              <p className="text-xs text-white/50 mb-3">
                {stats.stats.badHoursTotal || 0} записей с плейсхолдер часами (00:00-23:59)
                {stats.stats.badHours !== stats.stats.badHoursTotal && (
                  <span className="text-cyan-300"> • {stats.stats.badHours || 0} готовы, {(stats.stats.badHoursTotal || 0) - (stats.stats.badHours || 0)} на кулдауне</span>
                )}
              </p>
              
              {/* Обычное обновление */}
              {stats.stats.badHours > 0 && (
                <div className="mb-3">
                  <div className="text-xs text-white/40 mb-2">Обычное обновление:</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEnrichment(20, 'hours')}
                      disabled={enriching}
                      className="flex-1 py-2 bg-orange-500/20 text-orange-300 text-xs rounded-lg hover:bg-orange-500/30 transition-colors font-medium disabled:opacity-50"
                    >
                      {enriching ? '⏳...' : '20 записей'}
                    </button>
                    <button
                      onClick={() => startEnrichment(100, 'hours')}
                      disabled={enriching}
                      className="flex-1 py-2 bg-orange-500/20 text-orange-300 text-xs rounded-lg hover:bg-orange-500/30 transition-colors font-medium disabled:opacity-50"
                    >
                      {enriching ? '⏳...' : '100 записей'}
                    </button>
                  </div>
                </div>
              )}
              
              {/* Принудительное обновление */}
              <div>
                <div className="text-xs text-white/40 mb-2">⚠️ Принудительно (игнорирует кулдаун):</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEnrichmentForce(20, 'hours')}
                    disabled={enriching}
                    className="flex-1 py-2 bg-red-500/20 text-red-300 text-xs rounded-lg hover:bg-red-500/30 transition-colors font-medium disabled:opacity-50 border border-red-500/30"
                  >
                    {enriching ? '⏳...' : '🔄 20 записей'}
                  </button>
                  <button
                    onClick={() => startEnrichmentForce(100, 'hours')}
                    disabled={enriching}
                    className="flex-1 py-2 bg-red-500/20 text-red-300 text-xs rounded-lg hover:bg-red-500/30 transition-colors font-medium disabled:opacity-50 border border-red-500/30"
                  >
                    {enriching ? '⏳...' : '🔄 100 записей'}
                  </button>
                  <button
                    onClick={() => startEnrichmentForce(stats.stats.badHoursTotal || 500, 'hours')}
                    disabled={enriching}
                    className="flex-1 py-2 bg-red-500/20 text-red-300 text-xs rounded-lg hover:bg-red-500/30 transition-colors font-medium disabled:opacity-50 border border-red-500/30"
                  >
                    {enriching ? '⏳...' : `🔄 ВСЕ ${stats.stats.badHoursTotal || 0}`}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Кнопки обогащения */}
          {stats.needsEnrichment > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => startEnrichment(20, 'incomplete')}
                disabled={enriching}
                className="w-full py-2.5 bg-green-500/20 text-green-300 text-sm rounded-lg hover:bg-green-500/30 transition-colors font-medium disabled:opacity-50"
              >
                {enriching ? '⏳ Запуск...' : '🚀 Обогатить 20 записей (~$0.20)'}
              </button>
              <button
                onClick={() => startEnrichment(50, 'incomplete')}
                disabled={enriching}
                className="w-full py-2.5 bg-blue-500/20 text-blue-300 text-sm rounded-lg hover:bg-blue-500/30 transition-colors font-medium disabled:opacity-50"
              >
                {enriching ? '⏳ Запуск...' : '🚀 Обогатить 50 записей (~$0.50)'}
              </button>
              <button
                onClick={() => {
                  const total = stats?.needsEnrichment || 0;
                  const estimatedCost = (total * 0.01).toFixed(2);
                  if (confirm(`⚠️ Обогатить ВСЕ ${total} записей?\n\nПримерная стоимость: ~$${estimatedCost}\nВремя: ~${Math.ceil(total / 20 * 2)} мин\n\nДанные будут обрабатываться порциями по 20 записей.`)) {
                    startEnrichment(total, 'incomplete');
                  }
                }}
                disabled={enriching}
                className="w-full py-2.5 bg-purple-500/20 text-purple-300 text-sm rounded-lg hover:bg-purple-500/30 transition-colors font-medium disabled:opacity-50"
              >
                {enriching ? '⏳ Запуск...' : `🚀 Обогатить ВСЕ ${stats?.needsEnrichment || 0} записей (~$${((stats?.needsEnrichment || 0) * 0.01).toFixed(2)})`}
              </button>
            </div>
          )}
          
          {/* Результат */}
          {result && (
            <div className={`p-3 rounded-lg text-sm ${result.error ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
              {result.error || result.message}
              {result.jobId && (
                <div className="text-xs mt-1 text-white/50">
                  Job ID: {result.jobId}
                </div>
              )}
            </div>
          )}
          
          {stats.needsEnrichment === 0 && (
            <div className="text-center py-4 text-green-400 text-sm">
              ✅ Все записи актуальны!
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4 text-red-400">Ошибка загрузки статистики</div>
      )}
    </div>
  );
}

// Интерфейс для статистики использования API
interface ApiUsageStats {
  currentMonth: {
    year: number;
    month: number;
    requests: number;
    cost: number;
    freeLimit: number;
    remainingFree: number;
    usagePercent: number;
  };
  previousMonth: {
    requests: number;
    cost: number;
  };
  allTime: {
    requests: number;
    cost: number;
  };
}

// Детальный интерфейс ресторана для CMS
interface RestaurantDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string;
  city: string;
  country: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  website: string | null;
  email: string | null;
  menuUrl: string | null;
  rating: number | null;
  ratingCount: number;
  priceRange: string | null;
  cuisine: string[];
  images: string[];
  source: string;
  sourceId: string;
  sourceUrl: string | null;
  brand: string | null;
  isActive: boolean;
  isVerified: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  lastSynced: string | null;
  workingHours: Array<{
    id: string;
    dayOfWeek: number;
    openTime: string;
    closeTime: string;
    isClosed: boolean;
  }>;
  menuItems: Array<{
    id: string;
    name: string;
    description: string | null;
    price: number | null;
    category: string | null;
    image: string | null;
  }>;
  reviews: Array<{
    id: string;
    author: string;
    rating: number;
    text: string | null;
    date: string;
    photos: string[];
  }>;
}

// Опции обновления через Google Places API (New)
// Актуальные цены: https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
const REFRESH_OPTIONS = [
  { id: 'basic', label: 'Основное', desc: 'Рейтинг, телефон, сайт', cost: '$0.003' },
  { id: 'hours', label: 'Время работы', desc: 'Расписание по дням', cost: '$0.005' },
  { id: 'photos', label: 'Фотографии', desc: 'Новые фото из Google', cost: '$0.007' },
  { id: 'reviews', label: 'Отзывы', desc: 'Последние отзывы', cost: '$0.005' },
  { id: 'full', label: 'Всё сразу', desc: 'Полное обновление', cost: '$0.017' },
];

// Предустановленные категории меню
const MENU_CATEGORIES = [
  '🥗 Салаты',
  '🍲 Супы',
  '🍖 Горячее',
  '🍕 Пицца',
  '🍔 Бургеры',
  '🌯 Шаурма',
  '🍜 Лапша',
  '🍚 Плов',
  '🥟 Самса',
  '🍰 Десерты',
  '🥤 Напитки',
  '🍺 Алкоголь',
  '🍳 Завтраки',
  '👶 Детское',
  '🥡 Сеты',
];

// Компонент редактора меню
function MenuEditor({ 
  restaurantId, 
  initialItems, 
  onUpdate 
}: { 
  restaurantId: string; 
  initialItems: Array<{ id: string; name: string; price: number | null; category: string | null; description?: string | null }>;
  onUpdate: () => void;
}) {
  const [items, setItems] = useState(initialItems);
  const [newItem, setNewItem] = useState({ name: '', price: '', category: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ name: '', price: '', category: '', description: '' });
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // Группировка по категориям
  const groupedItems = items.reduce((acc, item) => {
    const cat = item.category || 'Без категории';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, typeof items>);

  const addItem = async () => {
    if (!newItem.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/restaurants/${restaurantId}/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newItem.name,
          price: newItem.price ? parseFloat(newItem.price) : null,
          category: newItem.category || null,
          description: newItem.description || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setItems(prev => [...prev, data.item]);
        setNewItem({ name: '', price: '', category: '', description: '' });
        onUpdate();
      }
    } catch (error) {
      console.error('Error adding menu item:', error);
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!confirm('Удалить позицию?')) return;
    try {
      await fetch(`/api/restaurants/${restaurantId}/menu?itemId=${itemId}`, { method: 'DELETE' });
      setItems(prev => prev.filter(i => i.id !== itemId));
      onUpdate();
    } catch (error) {
      console.error('Error deleting menu item:', error);
    }
  };

  const startEdit = (item: typeof items[0]) => {
    setEditingId(item.id);
    setEditValues({
      name: item.name,
      price: item.price?.toString() || '',
      category: item.category || '',
      description: item.description || '',
    });
  };

  const saveEdit = async () => {
    if (!editingId || !editValues.name.trim()) return;
    setSaving(true);
    try {
      // Обновляем через PUT (массовое обновление)
      const updatedItems = items.map(item => 
        item.id === editingId 
          ? { ...item, name: editValues.name, price: editValues.price ? parseFloat(editValues.price) : null, category: editValues.category || null, description: editValues.description || null }
          : item
      );
      
      await fetch(`/api/restaurants/${restaurantId}/menu`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updatedItems }),
      });
      
      setItems(updatedItems);
      setEditingId(null);
      onUpdate();
    } catch (error) {
      console.error('Error updating menu item:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Быстрые категории */}
      <div className="flex flex-wrap gap-1">
        {MENU_CATEGORIES.slice(0, 10).map(cat => (
          <button
            key={cat}
            onClick={() => setNewItem(p => ({ ...p, category: cat }))}
            className={`px-2 py-1 text-xs rounded-lg transition-colors ${
              newItem.category === cat 
                ? 'bg-blue-500 text-white' 
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {cat}
          </button>
        ))}
        <button
          onClick={() => setShowCategoryPicker(!showCategoryPicker)}
          className="px-2 py-1 text-xs bg-white/5 text-white/40 rounded-lg hover:bg-white/10"
        >
          ещё...
        </button>
      </div>

      {/* Дополнительные категории */}
      {showCategoryPicker && (
        <div className="flex flex-wrap gap-1 p-2 bg-white/5 rounded-lg">
          {MENU_CATEGORIES.slice(10).map(cat => (
            <button
              key={cat}
              onClick={() => { setNewItem(p => ({ ...p, category: cat })); setShowCategoryPicker(false); }}
              className="px-2 py-1 text-xs bg-white/10 text-white/70 rounded-lg hover:bg-white/20"
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Форма добавления */}
      <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg space-y-2">
        <div className="text-sm text-green-400 font-medium">+ Добавить позицию</div>
        <div className="grid grid-cols-12 gap-2">
          <input
            type="text"
            value={newItem.name}
            onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
            placeholder="Название блюда *"
            className="col-span-5 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
          />
          <input
            type="number"
            value={newItem.price}
            onChange={e => setNewItem(p => ({ ...p, price: e.target.value }))}
            placeholder="Цена"
            className="col-span-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
          />
          <input
            type="text"
            value={newItem.category}
            onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}
            placeholder="Категория"
            className="col-span-3 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
          />
          <button
            onClick={addItem}
            disabled={saving || !newItem.name.trim()}
            className="col-span-2 px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-50"
          >
            {saving ? '...' : '+ Добавить'}
          </button>
        </div>
        <input
          type="text"
          value={newItem.description}
          onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))}
          placeholder="Описание (опционально)"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
        />
      </div>

      {/* Статистика */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-white/40">Всего: <span className="text-white font-medium">{items.length}</span> позиций</span>
        <span className="text-white/40">Категорий: <span className="text-white font-medium">{Object.keys(groupedItems).length}</span></span>
      </div>

      {/* Список по категориям */}
      {items.length === 0 ? (
        <div className="text-center py-8 text-white/40">
          <div className="text-3xl mb-2">🍽️</div>
          Меню пустое. Добавьте первую позицию выше.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedItems).map(([category, categoryItems]) => (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white/60">{category}</span>
                <span className="text-xs text-white/30">({categoryItems.length})</span>
              </div>
              <div className="space-y-1">
                {categoryItems.map(item => (
                  <div key={item.id} className="group">
                    {editingId === item.id ? (
                      // Режим редактирования
                      <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg space-y-2">
                        <div className="grid grid-cols-12 gap-2">
                          <input
                            type="text"
                            value={editValues.name}
                            onChange={e => setEditValues(p => ({ ...p, name: e.target.value }))}
                            className="col-span-5 px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm"
                          />
                          <input
                            type="number"
                            value={editValues.price}
                            onChange={e => setEditValues(p => ({ ...p, price: e.target.value }))}
                            className="col-span-2 px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm"
                          />
                          <input
                            type="text"
                            value={editValues.category}
                            onChange={e => setEditValues(p => ({ ...p, category: e.target.value }))}
                            className="col-span-3 px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm"
                          />
                          <div className="col-span-2 flex gap-1">
                            <button onClick={saveEdit} disabled={saving} className="flex-1 px-2 py-1.5 bg-green-500 text-white rounded text-xs">✓</button>
                            <button onClick={() => setEditingId(null)} className="flex-1 px-2 py-1.5 bg-white/10 text-white/60 rounded text-xs">✕</button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={editValues.description}
                          onChange={e => setEditValues(p => ({ ...p, description: e.target.value }))}
                          placeholder="Описание"
                          className="w-full px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm"
                        />
                      </div>
                    ) : (
                      // Режим просмотра
                      <div className="flex items-center gap-3 px-3 py-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white text-sm truncate">{item.name}</div>
                          {item.description && <div className="text-xs text-white/40 truncate">{item.description}</div>}
                        </div>
                        {item.price && (
                          <div className="text-green-400 font-medium text-sm whitespace-nowrap">
                            {item.price.toLocaleString()} сум
                          </div>
                        )}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEdit(item)} className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded text-xs">✏️</button>
                          <button onClick={() => deleteItem(item.id)} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded text-xs">🗑️</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Компонент аналитики ресторана
function RestaurantAnalytics({ restaurantId }: { restaurantId: string }) {
  const [data, setData] = useState<{
    totals?: {
      views: number;
      cardViews: number;
      calls: number;
      routeClicks: number;
      shares: number;
      menuViews: number;
      websiteClicks: number;
      favorites: number;
    };
    funnel?: {
      listToCard: number;
      cardToEngage: number;
      engageToIntent: number;
    };
    chart?: Array<{
      date: string;
      views: number;
      cardViews: number;
      calls: number;
      routes: number;
    }>;
    comparison?: {
      competitorsCount: number;
      yourViews: number;
      avgCompetitorViews: number;
      viewsVsAvg: number;
      rank: number;
    };
    recommendations?: Array<{
      type: string;
      priority: string;
      title: string;
      description: string;
      impact: string;
    }>;
    peakHours?: number[];
    peakDays?: number[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  const DAYS_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  useEffect(() => {
    fetchStats();
  }, [restaurantId, period]);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/restaurant/${restaurantId}?period=${period}`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
      } else {
        const err = await res.json();
        setError(err.message || 'Ошибка загрузки');
      }
    } catch (err) {
      setError('Не удалось загрузить аналитику');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-white/40">
        <div className="animate-spin text-2xl mb-2">⏳</div>
        Загрузка аналитики...
      </div>
    );
  }

  if (error || !data?.totals) {
    return (
      <div className="text-center py-8 text-white/40">
        <div className="text-3xl mb-2">📊</div>
        {error || 'Нет данных аналитики'}
        <div className="text-xs mt-2 text-white/30">
          Данные появятся когда пользователи начнут просматривать этот ресторан
        </div>
      </div>
    );
  }

  const { totals, funnel, chart, comparison, recommendations, peakHours, peakDays } = data;

  return (
    <div className="space-y-4">
      {/* Период */}
      <div className="flex gap-2">
        {(['7d', '30d', '90d'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              period === p ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {p === '7d' ? '7 дней' : p === '30d' ? '30 дней' : '90 дней'}
          </button>
        ))}
      </div>

      {/* Основные метрики */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-center gap-2">
            <span className="text-lg">👁️</span>
            <div>
              <div className="text-xl font-bold text-blue-400">{totals.views.toLocaleString()}</div>
              <div className="text-xs text-white/40">Показы в списке</div>
            </div>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <div className="flex items-center gap-2">
            <span className="text-lg">🖱️</span>
            <div>
              <div className="text-xl font-bold text-purple-400">{totals.cardViews.toLocaleString()}</div>
              <div className="text-xs text-white/40">Открытия карточки</div>
            </div>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="flex items-center gap-2">
            <span className="text-lg">📞</span>
            <div>
              <div className="text-xl font-bold text-green-400">{totals.calls.toLocaleString()}</div>
              <div className="text-xs text-white/40">Звонки</div>
            </div>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <div className="flex items-center gap-2">
            <span className="text-lg">🗺️</span>
            <div>
              <div className="text-xl font-bold text-orange-400">{totals.routeClicks.toLocaleString()}</div>
              <div className="text-xs text-white/40">Маршруты</div>
            </div>
          </div>
        </div>
      </div>

      {/* Дополнительные метрики */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
          <div className="flex items-center gap-2">
            <span>🍽️</span>
            <div>
              <div className="text-lg font-bold text-white">{totals.menuViews}</div>
              <div className="text-xs text-white/40">Меню</div>
            </div>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
          <div className="flex items-center gap-2">
            <span>🌐</span>
            <div>
              <div className="text-lg font-bold text-white">{totals.websiteClicks}</div>
              <div className="text-xs text-white/40">Сайт</div>
            </div>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
          <div className="flex items-center gap-2">
            <span>📤</span>
            <div>
              <div className="text-lg font-bold text-white">{totals.shares}</div>
              <div className="text-xs text-white/40">Шеры</div>
            </div>
          </div>
        </div>
      </div>

      {/* Воронка конверсии */}
      {funnel && (
        <div className="p-4 rounded-lg bg-gradient-to-r from-blue-500/10 to-green-500/10 border border-white/10">
          <h4 className="text-sm font-medium text-white/60 mb-3">📈 Воронка конверсии</h4>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-center">
              <div className="text-white/40 text-xs">Показ→Карточка</div>
              <div className="text-xl font-bold text-blue-400">{funnel.listToCard}%</div>
            </div>
            <div className="text-white/20">→</div>
            <div className="text-center">
              <div className="text-white/40 text-xs">Карточка→Интерес</div>
              <div className="text-xl font-bold text-purple-400">{funnel.cardToEngage}%</div>
            </div>
            <div className="text-white/20">→</div>
            <div className="text-center">
              <div className="text-white/40 text-xs">Интерес→Действие</div>
              <div className="text-xl font-bold text-green-400">{funnel.engageToIntent}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Сравнение с конкурентами */}
      {comparison && comparison.competitorsCount > 0 && (
        <div className="p-4 rounded-lg bg-white/5 border border-white/10">
          <h4 className="text-sm font-medium text-white/60 mb-3">🏆 Сравнение с конкурентами</h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">#{comparison.rank}</div>
              <div className="text-xs text-white/40">Позиция из {comparison.competitorsCount}</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${comparison.viewsVsAvg >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {comparison.viewsVsAvg >= 0 ? '+' : ''}{comparison.viewsVsAvg}%
              </div>
              <div className="text-xs text-white/40">vs среднее</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{comparison.avgCompetitorViews}</div>
              <div className="text-xs text-white/40">среднее у конкурентов</div>
            </div>
          </div>
        </div>
      )}

      {/* Пиковое время */}
      {((peakHours && peakHours.length > 0) || (peakDays && peakDays.length > 0)) && (
        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
          <h4 className="text-sm font-medium text-white/60 mb-2">⏰ Когда вас ищут</h4>
          <div className="flex gap-4 text-sm">
            {peakHours && peakHours.length > 0 && (
              <div>
                <span className="text-white/40">Часы: </span>
                <span className="text-white">{peakHours.map(h => `${h}:00`).join(', ')}</span>
              </div>
            )}
            {peakDays && peakDays.length > 0 && (
              <div>
                <span className="text-white/40">Дни: </span>
                <span className="text-white">{peakDays.map(d => DAYS_RU[d]).join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Рекомендации */}
      {recommendations && recommendations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-white/60">💡 Рекомендации</h4>
          {recommendations.slice(0, 3).map((rec, i) => (
            <div key={i} className={`p-3 rounded-lg border ${
              rec.priority === 'high' ? 'bg-red-500/10 border-red-500/20' :
              rec.priority === 'medium' ? 'bg-yellow-500/10 border-yellow-500/20' :
              'bg-white/5 border-white/10'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-white text-sm">{rec.title}</span>
                <span className="text-xs text-green-400">{rec.impact}</span>
              </div>
              <p className="text-xs text-white/50 mt-1">{rec.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* График по дням */}
      {chart && chart.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-white/60 mb-2">📅 По дням</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/40 border-b border-white/10">
                  <th className="text-left py-2 px-2">Дата</th>
                  <th className="text-right py-2 px-2">👁️</th>
                  <th className="text-right py-2 px-2">🖱️</th>
                  <th className="text-right py-2 px-2">📞</th>
                  <th className="text-right py-2 px-2">🗺️</th>
                </tr>
              </thead>
              <tbody>
                {chart.slice(-7).reverse().map(day => (
                  <tr key={day.date} className="border-b border-white/5 text-white/70">
                    <td className="py-2 px-2">{new Date(day.date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                    <td className="text-right py-2 px-2">{day.views}</td>
                    <td className="text-right py-2 px-2">{day.cardViews}</td>
                    <td className="text-right py-2 px-2 text-green-400">{day.calls}</td>
                    <td className="text-right py-2 px-2 text-orange-400">{day.routes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Компонент истории изменений
function ChangeHistory({ restaurantId }: { restaurantId: string }) {
  const [logs, setLogs] = useState<Array<{
    id: string;
    action: string;
    source: string;
    requestType: string | null;
    requestData: any;
    responseData: any;
    success: boolean;
    errorMessage: string | null;
    cost: number | null;
    changedFields: string[];
    createdAt: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [restaurantId]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/restaurants/${restaurantId}/history`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      refresh: '🔄 Обновление из Google',
      manual_edit: '✏️ Ручное редактирование',
      archive: '📦 Архивирование',
      restore: '↩️ Восстановление',
      update: '💾 Сохранение',
    };
    return labels[action] || action;
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      google_api: 'Google Places API',
      manual: 'Вручную',
      apify: 'Apify',
      system: 'Система',
    };
    return labels[source] || source;
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-white/40">
        <div className="animate-spin text-2xl mb-2">⏳</div>
        Загрузка истории...
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-white/40">
        <div className="text-2xl mb-2">📜</div>
        История изменений пуста
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-white/40 mb-2">
        {logs.length} записей в истории
      </div>
      {logs.map(log => (
        <div 
          key={log.id} 
          className={`p-3 rounded-lg text-xs ${
            log.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-white">{getActionLabel(log.action)}</span>
            <span className="text-white/30">
              {new Date(log.createdAt).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2 text-white/50 mb-1">
            <span>{getSourceLabel(log.source)}</span>
            {log.requestType && (
              <>
                <span>•</span>
                <span>{log.requestType}</span>
              </>
            )}
            {log.cost && (
              <>
                <span>•</span>
                <span className="text-green-400">${log.cost.toFixed(3)}</span>
              </>
            )}
          </div>
          {log.changedFields && log.changedFields.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {log.changedFields.map(field => (
                <span key={field} className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[10px]">
                  {field}
                </span>
              ))}
            </div>
          )}
          {!log.success && log.errorMessage && (
            <div className="mt-1 text-red-300 text-[10px]">
              ❌ {log.errorMessage}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Accordion карточка ресторана с inline редактированием
function RestaurantAccordionCard({
  restaurant: r,
  index,
  isExpanded,
  onToggle,
  onSaved,
}: {
  restaurant: {
    id: string;
    name: string;
    address: string;
    rating: number | null;
    ratingCount: number;
    lastSynced: string | null;
    source: string;
    images: string[];
    isActive: boolean;
    isArchived: boolean;
    isVerified: boolean;
    phone: string | null;
  };
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onSaved: () => void;
}) {
  const [detail, setDetail] = useState<RestaurantDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editedData, setEditedData] = useState<Partial<RestaurantDetail>>({});
  const [editedHours, setEditedHours] = useState<RestaurantDetail['workingHours']>([]);
  const [refreshResult, setRefreshResult] = useState<{ success: boolean; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'analytics' | 'photos' | 'menu' | 'reviews' | 'history'>('edit');

  const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  // Загружаем детали при развороте
  useEffect(() => {
    if (isExpanded && !detail) {
      fetchDetail();
    }
  }, [isExpanded]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/restaurants/${r.id}`);
      if (res.ok) {
        const data = await res.json();
        const rest = data.restaurant || data;
        setDetail(rest);
        setEditedData({
          name: rest.name,
          address: rest.address,
          city: rest.city,
          phone: rest.phone,
          website: rest.website,
          email: rest.email,
          menuUrl: rest.menuUrl,
          description: rest.description,
          priceRange: rest.priceRange,
          cuisine: rest.cuisine,
          brand: rest.brand,
          isActive: rest.isActive,
          isVerified: rest.isVerified,
          isArchived: rest.isArchived,
        });
        // Инициализируем часы работы
        const existingHours = rest.workingHours || [];
        const allDays = [0, 1, 2, 3, 4, 5, 6].map(day => {
          const existing = existingHours.find((h: any) => h.dayOfWeek === day);
          return existing || { id: `new-${day}`, dayOfWeek: day, openTime: '09:00', closeTime: '22:00', isClosed: false };
        });
        setEditedHours(allDays);
      }
    } catch (error) {
      console.error('Error fetching restaurant:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/restaurants/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editedData, workingHours: editedHours }),
      });
      if (res.ok) {
        // Логируем в историю
        await fetch(`/api/restaurants/${detail.id}/history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'manual_edit',
            source: 'manual',
            requestData: editedData,
            success: true,
          }),
        });
        onSaved();
        fetchDetail();
      } else {
        const data = await res.json();
        alert(`❌ ${data.error}`);
      }
    } catch (error) {
      alert(`❌ ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async (fields: string = 'basic') => {
    if (!detail) return;
    setRefreshing(true);
    setRefreshResult(null);
    try {
      const res = await fetch(`/api/restaurants/${detail.id}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields, force: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setRefreshResult({ success: true, message: '✅ Обновлено из Google' });
        fetchDetail();
        onSaved();
      } else {
        setRefreshResult({ success: false, message: `❌ ${data.error || 'Ошибка'}` });
      }
    } catch (error) {
      setRefreshResult({ success: false, message: `❌ ${error}` });
    } finally {
      setRefreshing(false);
    }
  };

  const updateHour = (dayOfWeek: number, field: 'openTime' | 'closeTime' | 'isClosed', value: string | boolean) => {
    setEditedHours(prev => {
      const existing = prev.find(h => h.dayOfWeek === dayOfWeek);
      if (existing) {
        return prev.map(h => h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h);
      }
      return [...prev, { id: `new-${dayOfWeek}`, dayOfWeek, openTime: '09:00', closeTime: '22:00', isClosed: false, [field]: value }];
    });
  };

  return (
    <div className={`bg-white/5 rounded-xl border transition-all ${isExpanded ? 'border-blue-500/50 bg-white/10' : 'border-white/10 hover:border-white/20'}`}>
      {/* Заголовок карточки - кликабельный */}
      <div
        onClick={onToggle}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
      >
        {/* Номер */}
        <span className="w-10 text-center text-white/30 text-sm font-mono">{index}</span>
        
        {/* Фото */}
        {r.images[0] ? (
          <img src={r.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center text-white/30 flex-shrink-0">📷</div>
        )}
        
        {/* Инфо */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-white truncate">{r.name}</div>
          <div className="text-sm text-white/40 truncate">{r.address}</div>
        </div>
        
        {/* Рейтинг */}
        <div className="flex items-center gap-1 px-2">
          {r.rating ? (
            <>
              <span className="text-yellow-400 font-medium">{r.rating.toFixed(1)}</span>
              <span className="text-white/30 text-xs">({r.ratingCount})</span>
            </>
          ) : (
            <span className="text-white/20">—</span>
          )}
        </div>
        
        {/* Статусы */}
        <div className="flex gap-1">
          {r.isActive && <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">✓</span>}
          {r.isVerified && <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">⭐</span>}
          {r.isArchived && <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded">📦</span>}
        </div>
        
        {/* Стрелка */}
        <span className={`text-white/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
      </div>
      
      {/* Развёрнутое содержимое */}
      {isExpanded && (
        <div className="border-t border-white/10">
          {loading ? (
            <div className="text-center py-8 text-white/40">
              <div className="text-2xl mb-2">⏳</div>
              Загрузка данных...
            </div>
          ) : detail ? (
            <>
              {/* Вкладки */}
              <div className="flex border-b border-white/10 px-4">
                {[
                  { id: 'edit', label: '✏️ Редактирование', count: null },
                  { id: 'analytics', label: '📊 Аналитика', count: null },
                  { id: 'photos', label: '📷 Фото', count: detail.images?.length || 0 },
                  { id: 'menu', label: '🍽️ Меню', count: detail.menuItems?.length || 0 },
                  { id: 'reviews', label: '💬 Отзывы', count: detail.reviews?.length || 0 },
                  { id: 'history', label: '📜 История', count: null },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'text-blue-400 border-blue-400'
                        : 'text-white/40 border-transparent hover:text-white/60'
                    }`}
                  >
                    {tab.label} {tab.count !== null && <span className="text-white/30">({tab.count})</span>}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {/* TAB: Редактирование */}
                {activeTab === 'edit' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Левая колонка - основные данные */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-white/60 border-b border-white/10 pb-2">📝 Основные данные</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-white/40 mb-1">Название</label>
                          <input type="text" value={editedData.name ?? ''} onChange={e => setEditedData(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50" />
                        </div>
                        <div>
                          <label className="block text-xs text-white/40 mb-1">Телефон</label>
                          <input type="text" value={editedData.phone ?? ''} onChange={e => setEditedData(p => ({ ...p, phone: e.target.value }))} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-white/40 mb-1">Адрес</label>
                        <input type="text" value={editedData.address ?? ''} onChange={e => setEditedData(p => ({ ...p, address: e.target.value }))} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-white/40 mb-1">Город</label>
                          <input type="text" value={editedData.city ?? ''} onChange={e => setEditedData(p => ({ ...p, city: e.target.value }))} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50" />
                        </div>
                        <div>
                          <label className="block text-xs text-white/40 mb-1">Бренд/Сеть</label>
                          <input type="text" value={editedData.brand ?? ''} onChange={e => setEditedData(p => ({ ...p, brand: e.target.value }))} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-white/40 mb-1">Сайт</label>
                          <input type="url" value={editedData.website ?? ''} onChange={e => setEditedData(p => ({ ...p, website: e.target.value }))} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50" />
                        </div>
                        <div>
                          <label className="block text-xs text-white/40 mb-1">Меню URL</label>
                          <input type="url" value={editedData.menuUrl ?? ''} onChange={e => setEditedData(p => ({ ...p, menuUrl: e.target.value }))} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50" />
                        </div>
                      </div>
                      {/* Статусы */}
                      <div className="flex items-center gap-4 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={editedData.isActive ?? true} onChange={e => setEditedData(p => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 rounded" />
                          <span className="text-sm text-green-400">Активен</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={editedData.isVerified ?? false} onChange={e => setEditedData(p => ({ ...p, isVerified: e.target.checked }))} className="w-4 h-4 rounded" />
                          <span className="text-sm text-blue-400">Проверен</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={editedData.isArchived ?? false} onChange={e => setEditedData(p => ({ ...p, isArchived: e.target.checked }))} className="w-4 h-4 rounded" />
                          <span className="text-sm text-orange-400">В архиве</span>
                        </label>
                      </div>
                    </div>
                    
                    {/* Правая колонка - время работы и Google */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-white/60 border-b border-white/10 pb-2">🕐 Время работы</h4>
                      <div className="grid grid-cols-7 gap-1">
                        {editedHours.sort((a, b) => a.dayOfWeek - b.dayOfWeek).map(h => (
                          <div key={h.dayOfWeek} className="text-center">
                            <div className="text-xs text-white/40 mb-1">{DAYS[h.dayOfWeek]}</div>
                            {h.isClosed ? <div className="text-xs text-red-400 py-1">Закр</div> : (
                              <div className="space-y-0.5">
                                <input type="time" value={h.openTime} onChange={e => updateHour(h.dayOfWeek, 'openTime', e.target.value)} className="w-full px-1 py-0.5 bg-white/5 border border-white/10 rounded text-white text-[10px]" />
                                <input type="time" value={h.closeTime} onChange={e => updateHour(h.dayOfWeek, 'closeTime', e.target.value)} className="w-full px-1 py-0.5 bg-white/5 border border-white/10 rounded text-white text-[10px]" />
                              </div>
                            )}
                            <label className="flex items-center justify-center gap-1 mt-1 cursor-pointer">
                              <input type="checkbox" checked={h.isClosed} onChange={e => updateHour(h.dayOfWeek, 'isClosed', e.target.checked)} className="w-3 h-3 rounded" />
                              <span className="text-[9px] text-white/30">Вых</span>
                            </label>
                          </div>
                        ))}
                      </div>
                      
                      {/* Google обновление */}
                      <div className="pt-2 border-t border-white/10">
                        <h4 className="text-sm font-medium text-white/60 mb-2">🔄 Обновить из Google</h4>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => handleRefresh('basic')} disabled={refreshing} className="px-3 py-1.5 bg-blue-500/20 text-blue-400 text-xs rounded-lg hover:bg-blue-500/30 disabled:opacity-50">Базовые</button>
                          <button onClick={() => handleRefresh('hours')} disabled={refreshing} className="px-3 py-1.5 bg-purple-500/20 text-purple-400 text-xs rounded-lg hover:bg-purple-500/30 disabled:opacity-50">Часы работы</button>
                          <button onClick={() => handleRefresh('photos')} disabled={refreshing} className="px-3 py-1.5 bg-green-500/20 text-green-400 text-xs rounded-lg hover:bg-green-500/30 disabled:opacity-50">Фото</button>
                          <button onClick={() => handleRefresh('full')} disabled={refreshing} className="px-3 py-1.5 bg-orange-500/20 text-orange-400 text-xs rounded-lg hover:bg-orange-500/30 disabled:opacity-50">Всё</button>
                        </div>
                        {refreshing && <div className="text-xs text-white/40 mt-2">⏳ Обновление...</div>}
                        {refreshResult && <div className={`text-xs mt-2 ${refreshResult.success ? 'text-green-400' : 'text-red-400'}`}>{refreshResult.message}</div>}
                      </div>
                      
                      {/* Мета */}
                      <div className="pt-2 border-t border-white/10 text-xs text-white/30 space-y-1">
                        <div>ID: <span className="text-white/50 font-mono">{detail.id}</span></div>
                        <div>Источник: <span className="text-white/50">{detail.source}</span></div>
                        {detail.sourceId && <div>Source ID: <span className="text-white/50 font-mono text-[10px]">{detail.sourceId}</span></div>}
                        {detail.lastSynced && <div>Синхр: <span className="text-white/50">{new Date(detail.lastSynced).toLocaleString()}</span></div>}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB: Аналитика */}
                {activeTab === 'analytics' && (
                  <RestaurantAnalytics restaurantId={detail.id} />
                )}

                {/* TAB: Фото */}
                {activeTab === 'photos' && (
                  <div>
                    {detail.images && detail.images.length > 0 ? (
                      <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                        {detail.images.map((img, i) => (
                          <div key={i} className="aspect-square rounded-lg overflow-hidden bg-white/5">
                            <img src={img} alt={`Фото ${i + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-white/40">
                        <div className="text-3xl mb-2">📷</div>
                        Нет фотографий
                        <button onClick={() => handleRefresh('photos')} className="block mx-auto mt-3 px-4 py-2 bg-blue-500/20 text-blue-400 text-sm rounded-lg hover:bg-blue-500/30">
                          Загрузить из Google
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB: Меню */}
                {activeTab === 'menu' && (
                  <MenuEditor 
                    restaurantId={detail.id} 
                    initialItems={detail.menuItems || []} 
                    onUpdate={fetchDetail}
                  />
                )}

                {/* TAB: Отзывы */}
                {activeTab === 'reviews' && (
                  <div>
                    {detail.reviews && detail.reviews.length > 0 ? (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {detail.reviews.map(review => (
                          <div key={review.id} className="p-3 bg-white/5 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium text-white">{review.author || 'Аноним'}</span>
                              <span className="text-yellow-400">{'⭐'.repeat(review.rating || 0)}</span>
                              {review.date && <span className="text-xs text-white/30">{new Date(review.date).toLocaleDateString()}</span>}
                            </div>
                            {review.text && <p className="text-sm text-white/70">{review.text}</p>}
                            {review.photos && review.photos.length > 0 && (
                              <div className="flex gap-2 mt-2">
                                {review.photos.slice(0, 3).map((photo, i) => (
                                  <img key={i} src={photo} alt="" className="w-16 h-16 object-cover rounded" />
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-white/40">
                        <div className="text-3xl mb-2">💬</div>
                        Нет отзывов
                      </div>
                    )}
                  </div>
                )}

                {/* TAB: История */}
                {activeTab === 'history' && (
                  <ChangeHistory restaurantId={detail.id} />
                )}
              </div>

              {/* Кнопки действий */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-white/5">
                <div className="text-xs text-white/30">
                  {saving ? '⏳ Сохранение...' : 'Нажмите Сохранить для применения изменений'}
                </div>
                <div className="flex gap-2">
                  <button onClick={onToggle} className="px-4 py-2 bg-white/5 text-white/60 rounded-lg hover:bg-white/10 text-sm">Закрыть</button>
                  <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium disabled:opacity-50">💾 Сохранить</button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-white/40">Ошибка загрузки</div>
          )}
        </div>
      )}
    </div>
  );
}

// Модальное окно детального редактирования ресторана (устаревшее, оставлено для совместимости)
function RestaurantDetailModal({
  isOpen,
  restaurantId,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  restaurantId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [restaurant, setRestaurant] = useState<RestaurantDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<'info' | 'hours' | 'menu' | 'photos' | 'reviews' | 'meta' | 'update' | 'history'>('info');
  const [editedData, setEditedData] = useState<Partial<RestaurantDetail>>({});
  const [editedHours, setEditedHours] = useState<RestaurantDetail['workingHours']>([]);
  const [newMenuItem, setNewMenuItem] = useState({ name: '', price: '', category: '', description: '' });
  const [selectedRefreshFields, setSelectedRefreshFields] = useState<string[]>(['basic']);
  const [refreshResult, setRefreshResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen && restaurantId) {
      fetchRestaurantDetail();
      setActiveSection('info');
      setRefreshResult(null);
    }
  }, [isOpen, restaurantId]);

  const fetchRestaurantDetail = async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/restaurants/${restaurantId}`);
      if (res.ok) {
        const data = await res.json();
        const r = data.restaurant || data;
        setRestaurant(r);
        setEditedData({
          name: r.name,
          address: r.address,
          city: r.city,
          phone: r.phone,
          website: r.website,
          email: r.email,
          menuUrl: r.menuUrl,
          description: r.description,
          priceRange: r.priceRange,
          cuisine: r.cuisine,
          brand: r.brand,
          isActive: r.isActive,
          isVerified: r.isVerified,
          isArchived: r.isArchived,
        });
        // Инициализируем часы работы для всех 7 дней
        const existingHours = r.workingHours || [];
        const allDays = [0, 1, 2, 3, 4, 5, 6].map(day => {
          const existing = existingHours.find((h: any) => h.dayOfWeek === day);
          return existing || {
            id: `new-${day}`,
            dayOfWeek: day,
            openTime: '09:00',
            closeTime: '22:00',
            isClosed: false,
          };
        });
        setEditedHours(allDays);
      }
    } catch (error) {
      console.error('Error fetching restaurant:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!restaurant) return;
    setSaving(true);
    
    // Определяем какие поля изменились
    const changedFields: string[] = [];
    Object.keys(editedData).forEach(key => {
      const original = (restaurant as any)[key];
      const edited = (editedData as any)[key];
      if (JSON.stringify(original) !== JSON.stringify(edited)) {
        changedFields.push(key);
      }
    });
    
    try {
      // Сохраняем основные данные
      const res = await fetch(`/api/restaurants/${restaurant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedData),
      });
      
      if (res.ok) {
        // Сохраняем время работы
        await fetch(`/api/restaurants/${restaurant.id}/hours`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hours: editedHours }),
        });
        
        // Логируем в историю изменений
        await fetch(`/api/restaurants/${restaurant.id}/history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'manual_edit',
            source: 'manual',
            requestData: editedData,
            responseData: { success: true },
            success: true,
            changedFields: changedFields.length > 0 ? changedFields : ['workingHours'],
          }),
        });
        
        alert('✅ Данные сохранены');
        onSaved();
        fetchRestaurantDetail();
      } else {
        const data = await res.json();
        
        // Логируем ошибку
        await fetch(`/api/restaurants/${restaurant.id}/history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'manual_edit',
            source: 'manual',
            requestData: editedData,
            success: false,
            errorMessage: data.error,
          }),
        });
        
        alert(`❌ Ошибка: ${data.error}`);
      }
    } catch (error) {
      alert(`❌ Ошибка: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async (fields: string = 'basic') => {
    if (!restaurant) return;
    setRefreshing(true);
    setRefreshResult(null);
    
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields, force: true }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setRefreshResult({ success: true, message: '✅ Данные успешно обновлены из Google' });
        fetchRestaurantDetail();
      } else if (res.status === 429) {
        setRefreshResult({ success: false, message: `⏳ Кулдаун активен. Попробуйте позже.` });
      } else if (res.status === 501) {
        setRefreshResult({ success: false, message: `🔧 Google API не настроен: ${data.hint || ''}` });
      } else {
        setRefreshResult({ success: false, message: `❌ ${data.error || 'Ошибка обновления'}` });
      }
    } catch (error) {
      setRefreshResult({ success: false, message: `❌ Ошибка сети: ${error}` });
    } finally {
      setRefreshing(false);
    }
  };

  const addMenuItem = async () => {
    if (!restaurant || !newMenuItem.name) return;
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMenuItem.name,
          price: newMenuItem.price ? parseFloat(newMenuItem.price) : null,
          category: newMenuItem.category || null,
          description: newMenuItem.description || null,
        }),
      });
      
      if (res.ok) {
        setNewMenuItem({ name: '', price: '', category: '', description: '' });
        fetchRestaurantDetail();
      }
    } catch (error) {
      console.error('Error adding menu item:', error);
    }
  };

  const deleteMenuItem = async (itemId: string) => {
    if (!restaurant || !confirm('Удалить позицию меню?')) return;
    try {
      await fetch(`/api/restaurants/${restaurant.id}/menu?itemId=${itemId}`, {
        method: 'DELETE',
      });
      fetchRestaurantDetail();
    } catch (error) {
      console.error('Error deleting menu item:', error);
    }
  };

  const updateHour = (dayOfWeek: number, field: 'openTime' | 'closeTime' | 'isClosed', value: string | boolean) => {
    setEditedHours(prev => {
      const existing = prev.find(h => h.dayOfWeek === dayOfWeek);
      if (existing) {
        return prev.map(h => h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h);
      } else {
        return [...prev, { 
          id: `new-${dayOfWeek}`, 
          dayOfWeek, 
          openTime: '09:00', 
          closeTime: '22:00', 
          isClosed: false,
          [field]: value 
        }];
      }
    });
  };

  const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  if (!isOpen) return null;

  return (
    <>
      {/* Затемнение фона */}
      <div 
        className="fixed inset-0 z-40 bg-black/30 transition-opacity"
        onClick={onClose}
      />
      
      {/* Боковая панель справа - как в Яндекс Доставке */}
      <div className="fixed top-0 right-0 z-50 h-screen w-[420px] max-w-[95vw] bg-white shadow-2xl flex flex-col animate-[slideIn_0.2s_ease-out]">
        {/* Header - компактный */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {loading ? 'Загрузка...' : 'Ресторан'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full">
            ✕
          </button>
        </div>

        {/* Скроллируемый контент */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-5 space-y-4">
              <div className="h-10 bg-gray-100 rounded animate-pulse" />
              <div className="h-10 bg-gray-100 rounded animate-pulse" />
              <div className="h-10 bg-gray-100 rounded animate-pulse" />
            </div>
          ) : restaurant ? (
            <div className="p-5 space-y-6">
              {/* Секция: Роль/Статус */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-500">Статус</span>
                  <a href="#" className="text-sm text-blue-500 hover:underline">Подробнее</a>
                </div>
                <div className="space-y-2">
                  {[
                    { key: 'isActive', label: 'Активен', desc: 'отображается на сайте', color: 'green' },
                    { key: 'isVerified', label: 'Верифицирован', desc: 'данные проверены', color: 'blue' },
                    { key: 'isArchived', label: 'В архиве', desc: 'скрыт из выдачи', color: 'orange' },
                  ].map(status => (
                    <label 
                      key={status.key}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        (editedData as any)[status.key] ?? (restaurant as any)[status.key]
                          ? `border-${status.color}-200 bg-${status.color}-50`
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div>
                        <div className="font-medium text-gray-900">{status.label}</div>
                        <div className="text-xs text-gray-500">{status.desc}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={(editedData as any)[status.key] ?? (restaurant as any)[status.key]}
                        onChange={e => setEditedData(p => ({ ...p, [status.key]: e.target.checked }))}
                        className={`w-5 h-5 rounded accent-${status.color}-500`}
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Секция: Данные */}
              <div>
                <div className="text-sm font-medium text-gray-500 mb-3">Данные</div>
                <div className="space-y-3">
                  {/* Название */}
                  <div>
                    <label className="block text-sm text-gray-500 mb-1.5">Название</label>
                    <input
                      type="text"
                      value={editedData.name ?? restaurant.name ?? ''}
                      onChange={e => setEditedData(p => ({ ...p, name: e.target.value }))}
                      placeholder="Обязательно"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  
                  {/* Телефон */}
                  <div>
                    <label className="block text-sm text-gray-500 mb-1.5">Телефон</label>
                    <input
                      type="text"
                      value={editedData.phone ?? restaurant.phone ?? ''}
                      onChange={e => setEditedData(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+998 XX XXX XX XX"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  
                  {/* Адрес */}
                  <div>
                    <label className="block text-sm text-gray-500 mb-1.5">Адрес</label>
                    <input
                      type="text"
                      value={editedData.address ?? restaurant.address ?? ''}
                      onChange={e => setEditedData(p => ({ ...p, address: e.target.value }))}
                      placeholder="Улица, дом"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Сайт */}
                  <div>
                    <label className="block text-sm text-gray-500 mb-1.5">Сайт</label>
                    <input
                      type="url"
                      value={editedData.website ?? restaurant.website ?? ''}
                      onChange={e => setEditedData(p => ({ ...p, website: e.target.value }))}
                      placeholder="https://..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Секция: Дополнительно (сворачиваемая) */}
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer text-sm font-medium text-gray-500 mb-3 list-none">
                  <span>Дополнительно</span>
                  <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-500 mb-1.5">Город</label>
                      <input
                        type="text"
                        value={editedData.city ?? restaurant.city ?? ''}
                        onChange={e => setEditedData(p => ({ ...p, city: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1.5">Ценовой уровень</label>
                      <select
                        value={editedData.priceRange ?? restaurant.priceRange ?? ''}
                        onChange={e => setEditedData(p => ({ ...p, priceRange: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:border-blue-500"
                      >
                        <option value="">—</option>
                        <option value="$">$</option>
                        <option value="$$">$$</option>
                        <option value="$$$">$$$</option>
                        <option value="$$$$">$$$$</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1.5">Бренд/Сеть</label>
                      <input
                        type="text"
                        value={editedData.brand ?? restaurant.brand ?? ''}
                        onChange={e => setEditedData(p => ({ ...p, brand: e.target.value }))}
                        placeholder="Evos, KFC..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1.5">Email</label>
                      <input
                        type="email"
                        value={editedData.email ?? restaurant.email ?? ''}
                        onChange={e => setEditedData(p => ({ ...p, email: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1.5">Ссылка на меню</label>
                    <input
                      type="url"
                      value={editedData.menuUrl ?? restaurant.menuUrl ?? ''}
                      onChange={e => setEditedData(p => ({ ...p, menuUrl: e.target.value }))}
                      placeholder="https://..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1.5">Кухня</label>
                      <input
                        type="text"
                        value={(editedData.cuisine ?? restaurant.cuisine)?.join(', ') ?? ''}
                        onChange={e => setEditedData(p => ({ ...p, cuisine: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                        placeholder="Узбекская, Европейская..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                </div>
              </details>

              {/* Секция: Время работы (сворачиваемая) */}
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer text-sm font-medium text-gray-500 mb-3 list-none">
                  <span>🕐 Время работы</span>
                  <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="space-y-2 pt-2">
                  {DAYS.map((dayName, idx) => {
                    const hour = editedHours.find(h => h.dayOfWeek === idx);
                    return (
                      <div key={idx} className="flex items-center gap-3 py-2 border-b border-gray-100">
                        <span className="w-10 text-sm font-medium text-gray-600">{dayName}</span>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={hour?.isClosed ?? false}
                            onChange={e => updateHour(idx, 'isClosed', e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span className="text-xs text-gray-400">Выходной</span>
                        </label>
                        {!hour?.isClosed && (
                          <>
                            <input
                              type="time"
                              value={hour?.openTime || '09:00'}
                              onChange={e => updateHour(idx, 'openTime', e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                            <span className="text-gray-400">—</span>
                            <input
                              type="time"
                              value={hour?.closeTime || '22:00'}
                              onChange={e => updateHour(idx, 'closeTime', e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </details>

              {/* Секция: Google обновление */}
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer text-sm font-medium text-gray-500 mb-3 list-none">
                  <span>🔄 Обновить из Google</span>
                  <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="space-y-3 pt-2">
                  {refreshResult && (
                    <div className={`p-3 rounded-lg text-sm ${refreshResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {refreshResult.success ? '✅' : '❌'} {refreshResult.message}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {REFRESH_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setSelectedRefreshFields([opt.id])}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          selectedRefreshFields.includes(opt.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-medium text-gray-900 text-sm">{opt.label}</div>
                        <div className="text-xs text-blue-600">{opt.cost}</div>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => handleRefresh(selectedRefreshFields[0] as any)}
                    disabled={refreshing}
                    className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 disabled:opacity-50"
                  >
                    {refreshing ? '⏳ Обновление...' : '🔄 Обновить'}
                  </button>
                  <div className="text-xs text-gray-400 text-center">
                    Синхр: {restaurant.lastSynced ? new Date(restaurant.lastSynced).toLocaleString() : 'Никогда'}
                  </div>
                </div>
              </details>

              {/* Секция: История */}
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer text-sm font-medium text-gray-500 mb-3 list-none">
                  <span>📜 История изменений</span>
                  <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="pt-2">
                  <ChangeHistory restaurantId={restaurant.id} />
                </div>
              </details>

              {/* Метаинфо - компактно внизу */}
              <div className="text-xs text-gray-400 pt-4 border-t border-gray-200 space-y-1">
                <div className="flex justify-between">
                  <span>ID:</span>
                  <span className="font-mono">{restaurant.id.slice(0, 16)}...</span>
                </div>
                <div className="flex justify-between">
                  <span>Источник:</span>
                  <span className="capitalize">{restaurant.source}</span>
                </div>
                <div className="flex justify-between">
                  <span>Рейтинг:</span>
                  <span>⭐ {restaurant.rating?.toFixed(1) || '—'} ({restaurant.ratingCount})</span>
                </div>
              </div>

            </div>
          ) : (
            <div className="p-5 text-center text-gray-500">
              Не удалось загрузить данные
            </div>
          )}
        </div>

        {/* Footer с кнопкой сохранения */}
        <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="w-full py-3.5 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-xl font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? '⏳ Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </>
  );
}

// Полнофункциональная CMS панель управления ресторанами
function RestaurantManagementPanel() {
  const [restaurants, setRestaurants] = useState<Array<{
    id: string;
    name: string;
    address: string;
    rating: number | null;
    ratingCount: number;
    lastSynced: string | null;
    source: string;
    images: string[];
    isActive: boolean;
    isArchived: boolean;
    isVerified: boolean;
    phone: string | null;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'archived' | 'noPhotos' | 'noRating' | 'unverified'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(50);
  const [stats, setStats] = useState<{
    total: number;
    active: number;
    archived: number;
    verified: number;
    noPhotos: number;
    noRating: number;
  } | null>(null);
  
  // Географические фильтры
  const [cities, setCities] = useState<Array<{ name: string; count: number }>>([]);
  const [countries, setCountries] = useState<Array<{ name: string; count: number }>>([]);
  const [regions, setRegions] = useState<Array<{ name: string; count: number }>>([]);
  const [districts, setDistricts] = useState<Array<{ name: string; count: number }>>([]);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [geoStats, setGeoStats] = useState<{ total: number; withCountry: number; withRegion: number; withDistrict: number } | null>(null);
  const [updatingGeo, setUpdatingGeo] = useState(false);

  // Загрузка списка городов и стран
  useEffect(() => {
    fetch('/api/locations')
      .then(res => res.json())
      .then(data => {
        setCities(data.cities || []);
        setCountries(data.countries || []);
        setRegions(data.regions || []);
        setDistricts(data.districts || []);
      })
      .catch(console.error);
    
    // Статистика географии
    fetch('/api/geo-update')
      .then(res => res.json())
      .then(data => setGeoStats(data))
      .catch(console.error);
  }, []);

  // Обновить географию для всех
  const updateAllGeo = async () => {
    setUpdatingGeo(true);
    try {
      const res = await fetch('/api/geo-update', { method: 'POST' });
      const data = await res.json();
      alert(data.message || 'Готово');
      // Обновляем списки
      const locRes = await fetch('/api/locations');
      const locData = await locRes.json();
      setCities(locData.cities || []);
      setCountries(locData.countries || []);
      setRegions(locData.regions || []);
      setDistricts(locData.districts || []);
    } catch (error) {
      alert('Ошибка: ' + error);
    } finally {
      setUpdatingGeo(false);
    }
  };

  useEffect(() => {
    fetchRestaurants();
    fetchStats();
  }, [filter, page, limit, selectedCity, selectedCountry, selectedRegion, selectedDistrict]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/quality');
      if (res.ok) {
        const data = await res.json();
        setStats({
          total: data.total || 0,
          active: data.active || 0,
          archived: data.archived || 0,
          verified: data.verified || 0,
          noPhotos: data.noPhotos || 0,
          noRating: data.noRating || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
        includeAll: 'true',
      });
      
      // Применяем фильтры
      if (filter === 'archived') params.append('archived', 'true');
      if (filter === 'noPhotos') params.append('noPhotos', 'true');
      if (filter === 'noRating') params.append('noRating', 'true');
      if (filter === 'active') params.append('active', 'true');
      if (filter === 'unverified') params.append('unverified', 'true');
      if (searchQuery) params.append('search', searchQuery);
      
      // Географические фильтры
      if (selectedCity) params.append('filterCity', selectedCity);
      if (selectedCountry) params.append('country', selectedCountry);
      if (selectedRegion) params.append('region', selectedRegion);
      if (selectedDistrict) params.append('district', selectedDistrict);
      
      const res = await fetch(`/api/restaurants?${params}`);
      const data = await res.json();
      
      const items = (data.restaurants || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        address: r.address,
        rating: r.rating,
        ratingCount: r.ratingCount,
        lastSynced: r.lastSynced,
        source: r.source,
        images: r.images || [],
        isActive: r.isActive ?? true,
        isArchived: r.isArchived ?? false,
        isVerified: r.isVerified ?? false,
        phone: r.phone,
      }));

      setRestaurants(items);
      setTotal(data.total || items.length);
    } catch (error) {
      console.error('Error fetching restaurants:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Статистика - кликабельные карточки */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <button 
            onClick={() => { setFilter('all'); setPage(0); }}
            className={`rounded-xl p-3 text-center transition-all ${filter === 'all' ? 'bg-white/20 ring-2 ring-white/30' : 'bg-white/5 hover:bg-white/10'}`}
          >
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-white/40">Всего</div>
          </button>
          <button 
            onClick={() => { setFilter('active'); setPage(0); }}
            className={`rounded-xl p-3 text-center transition-all ${filter === 'active' ? 'bg-green-500/30 ring-2 ring-green-500/50' : 'bg-green-500/10 hover:bg-green-500/20'}`}
          >
            <div className="text-2xl font-bold text-green-400">{stats.active}</div>
            <div className="text-xs text-white/40">Активные</div>
          </button>
          <button 
            onClick={() => { setFilter('unverified'); setPage(0); }}
            className={`rounded-xl p-3 text-center transition-all ${filter === 'unverified' ? 'bg-blue-500/30 ring-2 ring-blue-500/50' : 'bg-blue-500/10 hover:bg-blue-500/20'}`}
          >
            <div className="text-2xl font-bold text-blue-400">{stats.total - stats.verified}</div>
            <div className="text-xs text-white/40">Не проверены</div>
          </button>
          <button 
            onClick={() => { setFilter('archived'); setPage(0); }}
            className={`rounded-xl p-3 text-center transition-all ${filter === 'archived' ? 'bg-orange-500/30 ring-2 ring-orange-500/50' : 'bg-orange-500/10 hover:bg-orange-500/20'}`}
          >
            <div className="text-2xl font-bold text-orange-400">{stats.archived}</div>
            <div className="text-xs text-white/40">В архиве</div>
          </button>
          <button 
            onClick={() => { setFilter('noPhotos'); setPage(0); }}
            className={`rounded-xl p-3 text-center transition-all ${filter === 'noPhotos' ? 'bg-red-500/30 ring-2 ring-red-500/50' : 'bg-red-500/10 hover:bg-red-500/20'}`}
          >
            <div className="text-2xl font-bold text-red-400">{stats.noPhotos}</div>
            <div className="text-xs text-white/40">Без фото</div>
          </button>
          <button 
            onClick={() => { setFilter('noRating'); setPage(0); }}
            className={`rounded-xl p-3 text-center transition-all ${filter === 'noRating' ? 'bg-yellow-500/30 ring-2 ring-yellow-500/50' : 'bg-yellow-500/10 hover:bg-yellow-500/20'}`}
          >
            <div className="text-2xl font-bold text-yellow-400">{stats.noRating}</div>
            <div className="text-xs text-white/40">Без рейтинга</div>
          </button>
        </div>
      )}

      {/* Поиск и географические фильтры */}
      <div className="space-y-3">
        {/* Строка поиска */}
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="🔍 Поиск по названию, адресу, телефону..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchRestaurants()}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-white/30"
            />
          </div>
          <button
            onClick={() => { setPage(0); fetchRestaurants(); }}
            className="px-6 py-3 bg-blue-500/30 text-blue-300 rounded-xl hover:bg-blue-500/40 font-medium"
          >
            Найти
          </button>
        </div>
        
        {/* Географические фильтры */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-white/40 text-sm">📍 География:</span>
          
          {/* Страна */}
          <select
            value={selectedCountry}
            onChange={e => { setSelectedCountry(e.target.value); setPage(0); }}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/30"
          >
            <option value="">Все страны</option>
            {countries.map(c => (
              <option key={c.name} value={c.name || ''}>
                {c.name || 'Не указана'} ({c.count})
              </option>
            ))}
          </select>
          
          {/* Регион */}
          <select
            value={selectedRegion}
            onChange={e => { setSelectedRegion(e.target.value); setPage(0); }}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/30"
          >
            <option value="">Все регионы</option>
            {regions.slice(0, 30).map(r => (
              <option key={r.name} value={r.name || ''}>
                {r.name || 'Не указан'} ({r.count})
              </option>
            ))}
          </select>
          
          {/* Город */}
          <select
            value={selectedCity}
            onChange={e => { setSelectedCity(e.target.value); setPage(0); }}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/30"
          >
            <option value="">Все города</option>
            {cities.slice(0, 50).map(c => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.count})
              </option>
            ))}
          </select>
          
          {/* Район */}
          <select
            value={selectedDistrict}
            onChange={e => { setSelectedDistrict(e.target.value); setPage(0); }}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/30"
          >
            <option value="">Все районы</option>
            {districts.slice(0, 30).map(d => (
              <option key={d.name} value={d.name || ''}>
                {d.name || 'Не указан'} ({d.count})
              </option>
            ))}
          </select>
          
          {/* Кнопка сброса фильтров */}
          {(selectedCity || selectedCountry || selectedRegion || selectedDistrict || searchQuery) && (
            <button
              onClick={() => { 
                setSelectedCity(''); 
                setSelectedCountry(''); 
                setSelectedRegion('');
                setSelectedDistrict('');
                setSearchQuery('');
                setFilter('all');
                setPage(0);
              }}
              className="px-3 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 text-sm"
            >
              ✕ Сбросить
            </button>
          )}
          
          {/* Кнопка авто-определения */}
          <button
            onClick={updateAllGeo}
            disabled={updatingGeo}
            className="px-3 py-2 bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 text-sm disabled:opacity-50"
            title="Автоматически определить страну, регион и район из адресов"
          >
            {updatingGeo ? '⏳' : '🔄'} Авто-определение
          </button>
          
          {/* Статистика покрытия */}
          {geoStats && (
            <span className="text-xs text-white/30 ml-2">
              Покрытие: страны {geoStats.withCountry}/{geoStats.total}, регионы {geoStats.withRegion}/{geoStats.total}
            </span>
          )}
        </div>
      </div>

      {/* Настройки отображения */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-sm">На странице:</span>
          {[30, 50, 100, 200].map(n => (
            <button
              key={n}
              onClick={() => { setLimit(n); setPage(0); }}
              className={`px-3 py-1 text-sm rounded-lg ${
                limit === n ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="text-white/40 text-sm">
          Всего: <span className="text-white font-medium">{total}</span> записей
        </div>
      </div>

      {/* Список ресторанов - Accordion */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-12 text-white/40 bg-white/5 rounded-xl">
            <div className="text-3xl mb-2">⏳</div>
            Загрузка...
          </div>
        ) : restaurants.length === 0 ? (
          <div className="text-center py-12 text-white/40 bg-white/5 rounded-xl">
            <div className="text-3xl mb-2">📭</div>
            Ничего не найдено
          </div>
        ) : (
          restaurants.map((r, idx) => (
            <RestaurantAccordionCard
              key={r.id}
              restaurant={r}
              index={page * limit + idx + 1}
              isExpanded={selectedRestaurant === r.id}
              onToggle={() => setSelectedRestaurant(selectedRestaurant === r.id ? null : r.id)}
              onSaved={fetchRestaurants}
            />
          ))
        )}
      </div>

      {/* Пагинация */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-xl mt-4">
        <div className="text-sm text-white/40">
          Показано <span className="text-white">{page * limit + 1}</span>–<span className="text-white">{Math.min((page + 1) * limit, total)}</span> из <span className="text-white">{total}</span>
        </div>
        
        <div className="flex items-center gap-1">
            {/* Первая страница */}
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="px-2 py-1.5 bg-white/5 text-white/60 rounded-lg hover:bg-white/10 disabled:opacity-30 text-sm"
              title="Первая"
            >
              ««
            </button>
            
            {/* Назад */}
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 bg-white/5 text-white/60 rounded-lg hover:bg-white/10 disabled:opacity-30 text-sm"
            >
              ‹
            </button>
            
            {/* Номера страниц */}
            <div className="flex items-center gap-1 mx-2">
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i;
                } else if (page < 4) {
                  pageNum = i;
                } else if (page > totalPages - 5) {
                  pageNum = totalPages - 7 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                
                if (pageNum < 0 || pageNum >= totalPages) return null;
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                      page === pageNum
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
            </div>
            
            {/* Вперёд */}
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 bg-white/5 text-white/60 rounded-lg hover:bg-white/10 disabled:opacity-30 text-sm"
            >
              ›
            </button>
            
            {/* Последняя страница */}
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
              className="px-2 py-1.5 bg-white/5 text-white/60 rounded-lg hover:bg-white/10 disabled:opacity-30 text-sm"
              title="Последняя"
            >
              »»
            </button>
            
            {/* Перейти к странице */}
            <div className="flex items-center gap-1 ml-4">
              <span className="text-white/40 text-sm">Стр:</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={page + 1}
                onChange={e => {
                  const p = parseInt(e.target.value) - 1;
                  if (p >= 0 && p < totalPages) setPage(p);
                }}
                className="w-16 px-2 py-1.5 bg-white/10 border border-white/10 rounded-lg text-white text-sm text-center focus:outline-none focus:border-white/30"
              />
            <span className="text-white/40 text-sm">/ {totalPages}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Модальное окно мониторинга парсинга
function ParsingMonitorModal({ 
  isOpen, 
  onClose, 
  jobId,
  source,
}: { 
  isOpen: boolean; 
  onClose: () => void;
  jobId: string | null;
  source: string;
}) {
  const [job, setJob] = useState<SyncJob | null>(null);
  const [allItems, setAllItems] = useState<Array<{ name: string; status: 'success' | 'error'; error?: string; time: Date }>>([]);

  useEffect(() => {
    if (!isOpen || !jobId) return;

    let isCancelled = false;
    let intervalId: NodeJS.Timeout | null = null;

    const fetchStatus = async () => {
      if (isCancelled) return;
      
      try {
        const res = await fetch(`/api/sync?jobId=${jobId}`);
        const data = await res.json();
        
        if (isCancelled) return;
        
        if (data.job) {
          setJob(data.job);
          
          // Добавляем новые элементы в лог
          const stats = data.job.stats as JobStats;
          if (stats?.processedItems) {
            setAllItems(prev => {
              const newItems = stats.processedItems!.filter(
                item => !prev.some(p => p.name === item.name)
              ).map(item => ({ ...item, time: new Date() }));
              return [...prev, ...newItems];
            });
          }
          
          // ⚡ ОПТИМИЗАЦИЯ: Останавливаем polling если задача завершена
          if (['completed', 'failed', 'cancelled'].includes(data.job.status)) {
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
          }
        }
        
        // Если есть результаты, показываем их
        if (data.results) {
          setJob(prev => prev ? { ...prev, status: 'completed', stats: data.results } : null);
          // Остановить polling после получения результатов
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      } catch (error) {
        console.error('Error fetching job status:', error);
      }
    };

    // Первый запрос сразу
    fetchStatus();
    // Polling каждые 3 секунды (вместо 2)
    intervalId = setInterval(fetchStatus, 3000);
    
    return () => {
      isCancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [isOpen, jobId]);

  // Сброс при закрытии
  useEffect(() => {
    if (!isOpen) {
      setAllItems([]);
      setJob(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const stats = job?.stats as JobStats;
  const isCompleted = job?.status === 'completed';
  const isFailed = job?.status === 'failed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              isCompleted ? 'bg-green-500' : isFailed ? 'bg-red-500' : 'bg-blue-500 animate-pulse'
            }`}></div>
            <h2 className="text-xl font-bold text-white">
              {isCompleted ? '✅ Парсинг завершён' : isFailed ? '❌ Ошибка' : '🔄 Парсинг выполняется...'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 py-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/70">Источник: <span className="text-white font-medium capitalize">{source}</span></span>
            {stats?.total && (
              <span className="text-white font-medium">
                {stats.processed || 0} / {stats.total}
                {stats.errors ? <span className="text-red-400 ml-2">({stats.errors} ошибок)</span> : ''}
              </span>
            )}
          </div>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${
                isCompleted 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                  : isFailed 
                    ? 'bg-gradient-to-r from-red-500 to-orange-500'
                    : 'bg-gradient-to-r from-blue-500 to-purple-500'
              }`}
              style={{ width: `${stats?.total ? ((stats.processed || 0) / stats.total) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Live Log */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white/70">📋 Лог выгрузки</h3>
            <span className="text-xs text-white/50">{allItems.length} записей</span>
          </div>
          
          <div className="h-64 overflow-y-auto rounded-xl bg-black/30 p-3 space-y-1 font-mono text-sm">
            {allItems.length === 0 ? (
              <div className="flex items-center justify-center h-full text-white/30">
                <div className="text-center">
                  <div className="text-3xl mb-2 animate-pulse">⏳</div>
                  <div>Ожидание данных...</div>
                </div>
              </div>
            ) : (
              <>
                {allItems.map((item, idx) => (
                  <div 
                    key={idx} 
                    className={`flex items-start gap-2 py-1 px-2 rounded ${
                      item.status === 'success' 
                        ? 'bg-green-500/10' 
                        : 'bg-red-500/10'
                    } ${idx === allItems.length - 1 ? 'animate-pulse' : ''}`}
                  >
                    <span className={item.status === 'success' ? 'text-green-400' : 'text-red-400'}>
                      {item.status === 'success' ? '✓' : '✗'}
                    </span>
                    <span className="text-white/80 flex-1">{item.name}</span>
                    <span className="text-white/30 text-xs">
                      {item.time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))}
                {!isCompleted && !isFailed && (
                  <div className="flex items-center gap-2 py-1 px-2 text-white/50">
                    <span className="animate-spin">⟳</span>
                    <span>Загрузка...</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
          {isCompleted ? (
            <>
              <div className="text-green-400">
                ✅ Успешно обработано: {stats?.processed || 0} из {stats?.total || 0}
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium rounded-xl hover:scale-105 transition-transform"
              >
                Готово
              </button>
            </>
          ) : isFailed ? (
            <>
              <div className="text-red-400">
                ❌ {job?.error || 'Произошла ошибка'}
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition-colors"
              >
                Закрыть
              </button>
            </>
          ) : (
            <>
              <div className="text-white/50 text-sm">
                Не закрывайте это окно до завершения
              </div>
              <button
                onClick={async () => {
                  if (jobId && confirm('Остановить парсинг?')) {
                    await fetch(`/api/sync?jobId=${jobId}`, { method: 'DELETE' });
                    onClose();
                  }
                }}
                className="px-6 py-2 bg-red-500/20 text-red-300 font-medium rounded-xl hover:bg-red-500/30 transition-colors"
              >
                🛑 Остановить
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Хеш пароля для проверки (простая защита)
const ADMIN_PASSWORD_HASH = 'a3f2b8c9d4e5f6a7b8c9d0e1f2a3b4c5'; // placeholder
const ADMIN_SESSION_KEY = 'foodguide_admin_session';

// Простая хеш-функция
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// Проверка пароля
function checkPassword(password: string): boolean {
  return password === 'F^%r!dd!n1988';
}

// Компонент формы входа
function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Небольшая задержка для UX
    setTimeout(() => {
      if (checkPassword(password)) {
        // Сохраняем сессию
        if (typeof window !== 'undefined') {
          const session = {
            hash: simpleHash(password + Date.now().toString()),
            expires: Date.now() + 24 * 60 * 60 * 1000 // 24 часа
          };
          localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
        }
        onLogin();
      } else {
        setError('Неверный пароль');
        setLoading(false);
      }
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f1a] via-[#1a1a2e] to-[#16213e] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">🔐</div>
            <h1 className="text-xl font-bold text-white">Админ-панель</h1>
            <p className="text-white/40 text-sm mt-1">Delever Food Map</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50 transition-colors"
                autoFocus
              />
            </div>
            
            {error && (
              <div className="text-red-400 text-sm text-center bg-red-500/10 py-2 rounded-lg">
                {error}
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? '⏳ Проверка...' : 'Войти'}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <a href="/" className="text-white/30 text-sm hover:text-white/50 transition-colors">
              ← Вернуться на сайт
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  // Состояние авторизации
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  
  const [scrapers, setScrapers] = useState<Scraper[]>([]);
  const [selectedScraper, setSelectedScraper] = useState<Scraper | null>(null);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [inputValues, setInputValues] = useState<Record<string, any>>({});
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [step, setStep] = useState<'select' | 'configure' | 'fields' | 'confirm'>('select');
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [apifyUsage, setApifyUsage] = useState<ApifyUsage | null>(null);
  const [showMonitor, setShowMonitor] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<string>('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'parsing' | 'management'>('parsing');
  const [googleApiUsage, setGoogleApiUsage] = useState<{
    currentMonth: {
      year: number;
      month: number;
      requests: number;
      cost: number;
      freeLimit: number;
      remainingFree: number;
      usagePercent: number;
    };
    previousMonth: { requests: number; cost: number };
    allTime: { requests: number; cost: number };
  } | null>(null);
  
  // Проверка сессии при загрузке
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const sessionStr = localStorage.getItem(ADMIN_SESSION_KEY);
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session.expires > Date.now()) {
          setIsAuthenticated(true);
          return;
        }
      }
    } catch (e) {
      console.error('Session check error:', e);
    }
    setIsAuthenticated(false);
  }, []);
  
  // Функция выхода
  const handleLogout = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(ADMIN_SESSION_KEY);
    setIsAuthenticated(false);
  };

  // Загрузка использования Apify
  const fetchApifyUsage = async () => {
    try {
      const res = await fetch('/api/apify-usage');
      if (res.ok) {
        const data = await res.json();
        setApifyUsage(data);
      }
    } catch (error) {
      console.error('Failed to fetch Apify usage:', error);
    }
  };

  // Загрузка использования Google Places API
  const fetchGoogleApiUsage = async () => {
    try {
      const res = await fetch('/api/usage');
      if (res.ok) {
        const data = await res.json();
        setGoogleApiUsage(data);
      }
    } catch (error) {
      console.error('Failed to fetch Google API usage:', error);
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/sync');
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  // Проверяем есть ли активные задачи
  const hasRunningJobs = jobs.some(j => j.status === 'running');

  // Загрузка скреперов и статистики (только когда авторизован)
  useEffect(() => {
    if (!isAuthenticated) return;
    
    fetch('/api/scrapers')
      .then(res => res.json())
      .then(data => setScrapers(data.scrapers || []))
      .catch(console.error);
    
    // Загрузка статистики БД
    fetch('/api/consolidate')
      .then(res => res.json())
      .then(data => setDbStats(data))
      .catch(console.error);
    
    // Загрузка использования Apify
    fetchApifyUsage();
    
    // Загрузка использования Google API
    fetchGoogleApiUsage();
    
    // Начальная загрузка задач
    fetchJobs();
  }, [isAuthenticated]);

  // Polling только когда есть активные задачи
  useEffect(() => {
    if (!isAuthenticated || !hasRunningJobs) return;
    
    // Polling каждые 10 сек только если есть running задачи
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated, hasRunningJobs]);
  
  // Показываем загрузку пока проверяем сессию
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f0f1a] via-[#1a1a2e] to-[#16213e] flex items-center justify-center">
        <div className="text-white/50">⏳ Загрузка...</div>
      </div>
    );
  }
  
  // Показываем форму входа если не авторизован
  if (!isAuthenticated) {
    return <LoginForm onLogin={() => setIsAuthenticated(true)} />;
  }

  // Выбор скрейпера
  const selectScraper = (scraper: Scraper) => {
    setSelectedScraper(scraper);
    // Установка дефолтных значений
    const defaults: Record<string, any> = {};
    scraper.inputFields.forEach(f => {
      defaults[f.key] = f.default;
    });
    setInputValues(defaults);
    // Выбрать все обязательные поля
    const required = new Set(scraper.fields.filter(f => f.required).map(f => f.key));
    setSelectedFields(required);
    setStep('configure');
  };

  // Расчет стоимости
  const count = inputValues.maxResults || inputValues.maxReviews || 50;
  const cost = selectedScraper ? (selectedScraper.costPerItem * count).toFixed(3) : '0';
  const time = selectedScraper ? selectedScraper.avgTimePerItem * count : 0;
  const timeFormatted = time < 60 ? `~${Math.round(time)} сек` : `~${Math.round(time / 60)} мин`;

  // Переключение поля
  const toggleField = (key: string) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(key)) {
      // Не даем отключить обязательные поля
      const field = selectedScraper?.fields.find(f => f.key === key);
      if (!field?.required) {
        newSelected.delete(key);
      }
    } else {
      newSelected.add(key);
    }
    setSelectedFields(newSelected);
  };

  // Запуск парсинга
  const startScraping = async () => {
    if (!selectedScraper) return;
    
    setSyncing(true);
    try {
      const sourceMap: Record<string, string> = {
        'google-maps': 'google',
        'google-reviews': 'google',
        'yandex-maps': 'yandex',
        '2gis': '2gis',
      };

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: sourceMap[selectedScraper.id] || 'google',
          searchQuery: inputValues.searchQuery || inputValues.placeUrl,
          location: inputValues.location || inputValues.city,
          maxResults: count,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Открываем модальное окно мониторинга
        setActiveJobId(data.jobId);
        setActiveSource(sourceMap[selectedScraper.id] || 'google');
        setShowMonitor(true);
        setStep('select');
        setSelectedScraper(null);
        fetchJobs();
      } else {
        alert(`❌ Ошибка: ${data.error}`);
      }
    } catch (error) {
      alert(`❌ Ошибка: ${error}`);
    } finally {
      setSyncing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-700',
      running: 'bg-blue-100 text-blue-700 animate-pulse',
      completed: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
      cancelled: 'bg-orange-100 text-orange-700',
    };
    return styles[status] || styles.pending;
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      pending: 'ожидание',
      running: 'выполняется',
      completed: 'завершено',
      failed: 'ошибка',
      cancelled: 'отменено',
    };
    return texts[status] || status;
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <img src="/delever-icon.svg" alt="Delever" className="w-10 h-10 rounded-xl" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Центр управления</h1>
              <p className="text-sm text-white/60">Парсинг данных • Мониторинг • Аналитика</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Навигация по страницам */}
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
              <Link href="/" className="px-3 py-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-md text-sm transition">
                🏠 Главная
              </Link>
              <Link href="/account" className="px-3 py-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-md text-sm transition">
                👤 Кабинет
              </Link>
              <Link href="/merchant" className="px-3 py-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-md text-sm transition">
                🏪 Мерчант
              </Link>
              <Link href="/merchant/integrations" className="px-3 py-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-md text-sm transition">
                🔌 Интеграции
              </Link>
              <Link href="/auth/login" className="px-3 py-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-md text-sm transition">
                🔐 Вход
              </Link>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded-lg transition-colors text-sm"
            >
              🚪 Выйти
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Apify Usage Banner */}
        {apifyUsage && (
          <div className="mb-6 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-orange-500/20 backdrop-blur-xl rounded-2xl border border-purple-500/30 p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💳</span>
                <div>
                  <div className="text-white font-bold">Apify Usage</div>
                  <div className="text-white/60 text-sm">Месячное использование</div>
                </div>
              </div>
              
              <div className="flex-1 max-w-md mx-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-white/70">
                    ${apifyUsage.limits.usedUsd.toFixed(2)} / ${apifyUsage.limits.maxMonthlyUsd.toFixed(2)}
                  </span>
                  <span className={`font-medium ${apifyUsage.usagePercent > 80 ? 'text-red-400' : apifyUsage.usagePercent > 50 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {apifyUsage.usagePercent.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      apifyUsage.usagePercent > 80 
                        ? 'bg-gradient-to-r from-red-500 to-orange-500' 
                        : apifyUsage.usagePercent > 50 
                          ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                          : 'bg-gradient-to-r from-green-500 to-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, apifyUsage.usagePercent)}%` }}
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-green-400">${apifyUsage.limits.remainingUsd.toFixed(2)}</div>
                  <div className="text-xs text-white/50">Осталось</div>
                </div>
                <button
                  onClick={fetchApifyUsage}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                  title="Обновить"
                >
                  🔄
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Google Places API Usage Banner */}
        <div className="mb-6 bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-teal-500/20 backdrop-blur-xl rounded-2xl border border-green-500/30 p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌍</span>
              <div>
                <div className="text-white font-bold">Google Places API</div>
                <div className="text-white/60 text-sm">Точечное обновление (в 60x дешевле!)</div>
              </div>
            </div>
            
            {googleApiUsage ? (
              <>
                <div className="flex-1 max-w-md mx-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white/70">
                      ${googleApiUsage.currentMonth.cost.toFixed(2)} / ${googleApiUsage.currentMonth.freeLimit}
                    </span>
                    <span className={`font-medium ${googleApiUsage.currentMonth.usagePercent > 80 ? 'text-red-400' : googleApiUsage.currentMonth.usagePercent > 50 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {googleApiUsage.currentMonth.usagePercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        googleApiUsage.currentMonth.usagePercent > 80 
                          ? 'bg-gradient-to-r from-red-500 to-orange-500' 
                          : googleApiUsage.currentMonth.usagePercent > 50 
                            ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                            : 'bg-gradient-to-r from-green-500 to-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, googleApiUsage.currentMonth.usagePercent)}%` }}
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-lg font-bold text-emerald-400">{googleApiUsage.currentMonth.requests}</div>
                    <div className="text-xs text-white/50">Запросов</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-400">${googleApiUsage.currentMonth.remainingFree.toFixed(0)}</div>
                    <div className="text-xs text-white/50">Осталось</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-teal-400">{Math.floor(googleApiUsage.currentMonth.remainingFree / 0.017).toLocaleString()}</div>
                    <div className="text-xs text-white/50">Обновлений</div>
                  </div>
                  <button
                    onClick={fetchGoogleApiUsage}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                    title="Обновить"
                  >
                    🔄
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-4 text-white/60">
                <span>$0.017 за обновление</span>
                <span>•</span>
                <span>$200/мес бесплатно</span>
                <span>•</span>
                <span className="text-green-400">~11,700 обновлений</span>
              </div>
            )}
          </div>
          
          {googleApiUsage && googleApiUsage.allTime.requests > 0 && (
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/50">
              <span>
                Всего: {googleApiUsage.allTime.requests.toLocaleString()} запросов (${googleApiUsage.allTime.cost.toFixed(2)})
              </span>
              {googleApiUsage.previousMonth.requests > 0 && (
                <span>
                  Прошлый месяц: {googleApiUsage.previousMonth.requests} (${googleApiUsage.previousMonth.cost.toFixed(2)})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Вкладки навигации */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setActiveTab('parsing')}
            className={`px-6 py-3 rounded-xl font-medium text-sm transition-all ${
              activeTab === 'parsing'
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            🔍 Парсинг данных
          </button>
          <button
            onClick={() => setActiveTab('management')}
            className={`px-6 py-3 rounded-xl font-medium text-sm transition-all ${
              activeTab === 'management'
                ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            🎯 Управление ресторанами
          </button>
        </div>

        {/* Контент вкладки Парсинг */}
        {activeTab === 'parsing' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          
          {/* Main Panel */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Database Stats Banner */}
            {dbStats && dbStats.total > 0 && (
              <div className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 backdrop-blur-xl rounded-2xl border border-emerald-500/30 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📊</span>
                    <div>
                      <div className="text-white font-bold">В базе уже {dbStats.total} ресторанов</div>
                      <div className="text-white/60 text-sm flex items-center gap-3">
                        {dbStats.bySource.map(s => (
                          <span key={s.source} className="capitalize">
                            {s.source === 'google' ? '🗺️' : s.source === 'yandex' ? '🔴' : '🟢'} {s.count}
                          </span>
                        ))}
                        {dbStats.potentialDuplicates > 0 && (
                          <button 
                            onClick={() => setShowDuplicatesModal(true)}
                            className="text-amber-400 hover:text-amber-300 hover:underline transition-colors"
                          >
                            ⚠️ ~{dbStats.potentialDuplicates} возможных дубликатов
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <Link
                    href="/"
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
                  >
                    Смотреть →
                  </Link>
                </div>
              </div>
            )}

            {/* Step 1: Select Scraper */}
            {step === 'select' && (
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8">
                <h2 className="text-2xl font-bold text-white mb-2">🔧 Выберите источник данных</h2>
                <p className="text-white/60 mb-6">Откуда будем парсить информацию о ресторанах?</p>
                
                {/* Warning about running jobs */}
                {jobs.some(j => j.status === 'running') && (
                  <div className="mb-6 p-4 rounded-xl bg-amber-500/20 border border-amber-500/30">
                    <div className="flex items-center gap-2 text-amber-300 font-medium">
                      <span className="animate-pulse">⏳</span>
                      Уже выполняется парсинг! Дождитесь завершения или проверьте результаты.
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {scrapers.map(scraper => {
                    const sourceMap: Record<string, string> = {
                      'google-places': 'google',
                      'google-reviews': 'google',
                      'yandex-maps': 'yandex',
                      '2gis': '2gis',
                    };
                    const sourceName = sourceMap[scraper.id] || scraper.id;
                    const existingCount = dbStats?.bySource.find(s => s.source === sourceName)?.count || 0;
                    
                    return (
                      <button
                        key={scraper.id}
                        onClick={() => selectScraper(scraper)}
                        className="p-6 rounded-2xl border-2 border-white/10 hover:border-purple-500/50 bg-white/5 hover:bg-white/10 transition-all text-left group relative"
                      >
                        {existingCount > 0 && (
                          <div className="absolute top-3 right-3 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                            ✓ {existingCount} в базе
                          </div>
                        )}
                        <div className="text-4xl mb-3">{scraper.icon}</div>
                        <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
                          {scraper.name}
                        </h3>
                        <p className="text-sm text-white/50 mt-1">{scraper.description}</p>
                        <div className="mt-4 flex items-center gap-4 text-xs text-white/40">
                          <span>~${scraper.costPerItem}/шт</span>
                          <span>{scraper.fields.length} полей</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Configure */}
            {step === 'configure' && selectedScraper && (
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8">
                <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setStep('select')} className="text-white/60 hover:text-white">
                    ← Назад
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{selectedScraper.icon}</span>
                    <div>
                      <h2 className="text-xl font-bold text-white">{selectedScraper.name}</h2>
                      <p className="text-sm text-white/60">Настройка параметров</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  {selectedScraper.inputFields.map(field => (
                    <div key={field.key}>
                      <label className="block text-sm font-medium text-white/80 mb-2">
                        {field.label}
                      </label>
                      
                      {/* Выбор категории - мультивыбор */}
                      {field.type === 'category' && (() => {
                        const allCategories = [
                          // Типы заведений
                          { group: 'Заведения', items: [
                            { value: 'рестораны', label: '🍽️ Рестораны' },
                            { value: 'кафе', label: '☕ Кафе' },
                            { value: 'бары', label: '🍺 Бары' },
                            { value: 'пабы', label: '🍻 Пабы' },
                            { value: 'столовые', label: '🥘 Столовые' },
                            { value: 'кофейни', label: '☕ Кофейни' },
                            { value: 'чайханы', label: '🍵 Чайханы' },
                            { value: 'фудкорт', label: '🏬 Фудкорты' },
                            { value: 'банкетные залы', label: '🎉 Банкетные залы' },
                            { value: 'караоке', label: '🎤 Караоке' },
                          ]},
                          // Фастфуд
                          { group: 'Фастфуд', items: [
                            { value: 'фастфуд', label: '🍔 Фастфуд' },
                            { value: 'бургеры', label: '🍔 Бургерные' },
                            { value: 'шаурма', label: '🌯 Шаурма/Донер' },
                            { value: 'хот-доги', label: '🌭 Хот-доги' },
                            { value: 'пиццерии', label: '🍕 Пиццерии' },
                          ]},
                          // Кухни мира
                          { group: 'Кухни мира', items: [
                            { value: 'узбекская кухня', label: '🥟 Узбекская' },
                            { value: 'русская кухня', label: '🥣 Русская' },
                            { value: 'грузинская кухня', label: '🍖 Грузинская' },
                            { value: 'турецкая кухня', label: '🥙 Турецкая' },
                            { value: 'корейская кухня', label: '🍜 Корейская' },
                            { value: 'китайская кухня', label: '🥡 Китайская' },
                            { value: 'японская кухня', label: '🍱 Японская' },
                            { value: 'итальянская кухня', label: '🍝 Итальянская' },
                            { value: 'мексиканская кухня', label: '🌮 Мексиканская' },
                            { value: 'индийская кухня', label: '🍛 Индийская' },
                            { value: 'тайская кухня', label: '🍲 Тайская' },
                            { value: 'вьетнамская кухня', label: '🍜 Вьетнамская' },
                          ]},
                          // Специализированные
                          { group: 'Специализация', items: [
                            { value: 'суши', label: '🍣 Суши/Роллы' },
                            { value: 'стейкхаус', label: '🥩 Стейкхаус' },
                            { value: 'морепродукты', label: '🦐 Морепродукты' },
                            { value: 'вегетарианские', label: '🥗 Вегетарианские' },
                            { value: 'халяль', label: '☪️ Халяль' },
                            { value: 'пекарни', label: '🥐 Пекарни' },
                            { value: 'кондитерские', label: '🎂 Кондитерские' },
                            { value: 'мороженое', label: '🍦 Мороженое' },
                          ]},
                        ];
                        
                        const selectedCats = (inputValues[field.key] || '').split(',').filter(Boolean);
                        const allFlat = allCategories.flatMap(g => g.items.map(i => i.value));
                        const isAllSelected = allFlat.every(v => selectedCats.includes(v));
                        
                        const toggleCategory = (value: string) => {
                          let cats = selectedCats.filter((c: string) => c !== value);
                          if (!selectedCats.includes(value)) {
                            cats = [...selectedCats, value];
                          }
                          setInputValues({
                            ...inputValues,
                            [field.key]: cats.join(',')
                          });
                        };
                        
                        const selectAll = () => {
                          setInputValues({
                            ...inputValues,
                            [field.key]: isAllSelected ? '' : allFlat.join(',')
                          });
                        };
                        
                        return (
                          <div className="space-y-3">
                            {/* Кнопки управления */}
                            <div className="flex gap-2 mb-2">
                              <button
                                type="button"
                                onClick={selectAll}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                  isAllSelected
                                    ? 'bg-green-500 text-white'
                                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                                }`}
                              >
                                {isAllSelected ? '✓ Все выбраны' : '☐ Выбрать все'}
                              </button>
                              {selectedCats.length > 0 && (
                                <span className="text-xs text-white/40 py-1.5">
                                  Выбрано: {selectedCats.length}
                                </span>
                              )}
                            </div>
                            
                            {/* Группы категорий */}
                            {allCategories.map(group => (
                              <div key={group.group}>
                                <div className="text-xs text-white/40 mb-1.5 uppercase tracking-wide">{group.group}</div>
                                <div className="flex flex-wrap gap-1.5">
                                  {group.items.map(cat => (
                                    <button
                                      key={cat.value}
                                      type="button"
                                      onClick={() => toggleCategory(cat.value)}
                                      className={`px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                                        selectedCats.includes(cat.value)
                                          ? 'bg-purple-500 text-white'
                                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                                      }`}
                                    >
                                      {cat.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                            
                            {/* Ручной ввод */}
                            <input
                              type="text"
                              value={inputValues[field.key] || ''}
                              onChange={(e) => setInputValues({
                                ...inputValues,
                                [field.key]: e.target.value
                              })}
                              placeholder="Или введите свой запрос (через запятую)..."
                              className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white text-sm placeholder-white/40 focus:outline-none focus:border-purple-500"
                            />
                          </div>
                        );
                      })()}
                      
                      {/* Выбор города */}
                      {field.type === 'city' && (
                        <div className="space-y-2">
                          <select
                            value={inputValues[field.key] || ''}
                            onChange={(e) => setInputValues({
                              ...inputValues,
                              [field.key]: e.target.value
                            })}
                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-purple-500"
                          >
                            <option value="" className="bg-[#1a1a2e]">Выберите город</option>
                            <optgroup label="🇺🇿 Узбекистан" className="bg-[#1a1a2e]">
                              <option value="Ташкент" className="bg-[#1a1a2e]">Ташкент</option>
                              <option value="Самарканд" className="bg-[#1a1a2e]">Самарканд</option>
                              <option value="Бухара" className="bg-[#1a1a2e]">Бухара</option>
                              <option value="Фергана" className="bg-[#1a1a2e]">Фергана</option>
                              <option value="Наманган" className="bg-[#1a1a2e]">Наманган</option>
                            </optgroup>
                            <optgroup label="🇷🇺 Россия" className="bg-[#1a1a2e]">
                              <option value="Москва" className="bg-[#1a1a2e]">Москва</option>
                              <option value="Санкт-Петербург" className="bg-[#1a1a2e]">Санкт-Петербург</option>
                              <option value="Казань" className="bg-[#1a1a2e]">Казань</option>
                              <option value="Екатеринбург" className="bg-[#1a1a2e]">Екатеринбург</option>
                              <option value="Сочи" className="bg-[#1a1a2e]">Сочи</option>
                            </optgroup>
                            <optgroup label="🇰🇿 Казахстан" className="bg-[#1a1a2e]">
                              <option value="Алматы" className="bg-[#1a1a2e]">Алматы</option>
                              <option value="Астана" className="bg-[#1a1a2e]">Астана</option>
                            </optgroup>
                            <optgroup label="🌍 Другие" className="bg-[#1a1a2e]">
                              <option value="Минск" className="bg-[#1a1a2e]">🇧🇾 Минск</option>
                              <option value="Тбилиси" className="bg-[#1a1a2e]">🇬🇪 Тбилиси</option>
                              <option value="Баку" className="bg-[#1a1a2e]">🇦🇿 Баку</option>
                              <option value="Ереван" className="bg-[#1a1a2e]">🇦🇲 Ереван</option>
                              <option value="Бишкек" className="bg-[#1a1a2e]">🇰🇬 Бишкек</option>
                            </optgroup>
                          </select>
                          <input
                            type="text"
                            value={inputValues[field.key] || ''}
                            onChange={(e) => setInputValues({
                              ...inputValues,
                              [field.key]: e.target.value
                            })}
                            placeholder="Или введите свой город/район..."
                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      )}
                      
                      {/* Выбор количества результатов */}
                      {field.type === 'select' && field.options && (
                        <div className="space-y-3">
                          {/* Быстрый выбор */}
                          <div className="flex flex-wrap gap-2">
                            {field.options.map(opt => {
                              const val = Number(opt.value);
                              const isFullScan = val === 0;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setInputValues({
                                    ...inputValues,
                                    [field.key]: val
                                  })}
                                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                    inputValues[field.key] === val
                                      ? isFullScan 
                                        ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white' 
                                        : 'bg-purple-500 text-white'
                                      : isFullScan
                                        ? 'bg-red-500/10 text-red-300 hover:bg-red-500/20 border border-red-500/30'
                                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                          
                          {/* Ручной ввод */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-white/40">Или введите число:</span>
                            <input
                              type="number"
                              min="1"
                              max="10000"
                              value={inputValues[field.key] || ''}
                              onChange={(e) => setInputValues({
                                ...inputValues,
                                [field.key]: e.target.value ? Number(e.target.value) : ''
                              })}
                              placeholder="Кол-во..."
                              className="w-28 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-purple-500"
                            />
                          </div>
                          
                          {/* Предупреждение при полном сканировании */}
                          {inputValues[field.key] === 0 && (
                            <div className="p-2 bg-red-500/20 border border-red-500/30 rounded-lg text-xs text-red-300">
                              ⚠️ <b>Полное сканирование</b> может занять много времени и средств. 
                              Рекомендуется для первичного сбора данных по городу.
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Обычные текстовые поля */}
                      {(field.type === 'text' || field.type === 'number') && (
                        <input
                          type={field.type === 'number' ? 'number' : 'text'}
                          value={inputValues[field.key] || ''}
                          onChange={(e) => setInputValues({
                            ...inputValues,
                            [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value
                          })}
                          placeholder={field.placeholder}
                          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
                        />
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setStep('fields')}
                  className="w-full mt-6 py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-colors"
                >
                  Далее: Выбор полей →
                </button>
              </div>
            )}

            {/* Step 3: Select Fields */}
            {step === 'fields' && selectedScraper && (
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8">
                <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setStep('configure')} className="text-white/60 hover:text-white">
                    ← Назад
                  </button>
                  <div>
                    <h2 className="text-xl font-bold text-white">📋 Выберите нужные поля</h2>
                    <p className="text-sm text-white/60">Какие данные нужно извлечь?</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedScraper.fields.map(field => (
                    <button
                      key={field.key}
                      onClick={() => toggleField(field.key)}
                      disabled={field.required}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        selectedFields.has(field.key)
                          ? 'border-purple-500 bg-purple-500/20'
                          : 'border-white/10 bg-white/5 hover:border-white/30'
                      } ${field.required ? 'opacity-80' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-white">{field.label}</span>
                        {field.required && (
                          <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">
                            Обязательное
                          </span>
                        )}
                        {selectedFields.has(field.key) && !field.required && (
                          <span className="text-purple-400">✓</span>
                        )}
                      </div>
                      <p className="text-xs text-white/50 mt-1">{field.description}</p>
                      <div className="mt-2 text-xs text-white/30 font-mono truncate">
                        Пример: {JSON.stringify(field.example)}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => {
                      const all = new Set(selectedScraper.fields.map(f => f.key));
                      setSelectedFields(all);
                    }}
                    className="px-4 py-2 text-sm text-white/60 hover:text-white border border-white/20 rounded-lg"
                  >
                    Выбрать все
                  </button>
                  <button
                    onClick={() => {
                      const required = new Set(selectedScraper.fields.filter(f => f.required).map(f => f.key));
                      setSelectedFields(required);
                    }}
                    className="px-4 py-2 text-sm text-white/60 hover:text-white border border-white/20 rounded-lg"
                  >
                    Только обязательные
                  </button>
                </div>

                <button
                  onClick={() => setStep('confirm')}
                  className="w-full mt-6 py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-colors"
                >
                  Далее: Подтверждение →
                </button>
              </div>
            )}

            {/* Step 4: Confirm */}
            {step === 'confirm' && selectedScraper && (
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8">
                <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setStep('fields')} className="text-white/60 hover:text-white">
                    ← Назад
                  </button>
                  <div>
                    <h2 className="text-xl font-bold text-white">🚀 Запуск парсинга</h2>
                    <p className="text-sm text-white/60">Проверьте настройки</p>
                  </div>
                </div>

                {/* Summary */}
                <div className="space-y-4 mb-6">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-sm text-white/50 mb-1">Источник</div>
                    <div className="text-white font-medium flex items-center gap-2">
                      <span>{selectedScraper.icon}</span>
                      {selectedScraper.name}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {selectedScraper.inputFields.map(field => (
                      <div key={field.key} className="p-4 rounded-xl bg-white/5 border border-white/10">
                        <div className="text-sm text-white/50 mb-1">{field.label}</div>
                        <div className="text-white font-medium">{inputValues[field.key]}</div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-sm text-white/50 mb-2">Выбранные поля ({selectedFields.size})</div>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(selectedFields).map(key => {
                        const field = selectedScraper.fields.find(f => f.key === key);
                        return (
                          <span key={key} className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded">
                            {field?.label || key}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Existing data warning */}
                {(() => {
                  const sourceMap: Record<string, string> = {
                    'google-places': 'google',
                    'google-reviews': 'google',
                    'yandex-maps': 'yandex',
                    '2gis': '2gis',
                  };
                  const sourceName = sourceMap[selectedScraper.id] || selectedScraper.id;
                  const existingCount = dbStats?.bySource.find(s => s.source === sourceName)?.count || 0;
                  
                  if (existingCount > 0) {
                    return (
                      <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/30 mb-6">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">ℹ️</span>
                          <div>
                            <div className="text-emerald-300 font-medium">
                              Уже есть {existingCount} ресторанов из {selectedScraper.name}
                            </div>
                            <div className="text-white/60 text-sm mt-1">
                              Дубликаты будут автоматически объединены. Новые данные дополнят существующие.
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Cost Calculator */}
                <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 mb-6">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-3xl font-bold text-white">{count}</div>
                      <div className="text-sm text-white/60">Записей</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-green-400">${cost}</div>
                      <div className="text-sm text-white/60">Стоимость</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-amber-400">{timeFormatted}</div>
                      <div className="text-sm text-white/60">Время</div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={startScraping}
                  disabled={syncing || jobs.some(j => j.status === 'running')}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {syncing ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Запуск...
                    </>
                  ) : jobs.some(j => j.status === 'running') ? (
                    <>
                      ⏳ Дождитесь завершения текущего парсинга
                    </>
                  ) : (
                    <>
                      🚀 Запустить парсинг
                    </>
                  )}
                </button>
              </div>
            )}

          </div>

          {/* Sidebar - Jobs */}
          <div className="lg:col-span-2">
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 sticky top-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">📋 История задач</h2>
                <button onClick={fetchJobs} className="text-white/50 hover:text-white text-sm">
                  🔄
                </button>
              </div>

              {jobs.length === 0 ? (
                <div className="text-center py-8 text-white/40">
                  <div className="text-4xl mb-2">📭</div>
                  <p>Задач пока нет</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {jobs.map(job => (
                    <div
                      key={job.id}
                      className="p-4 rounded-xl bg-white/5 border border-white/10"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium capitalize">{job.source}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(job.status)}`}>
                          {getStatusText(job.status)}
                        </span>
                      </div>
                      <div className="text-xs text-white/40">
                        {new Date(job.createdAt).toLocaleString('ru-RU')}
                      </div>
                      {job.stats?.processed !== undefined && (
                        <div className="mt-2 text-xs text-white/60">
                          ✅ {job.stats.processed} | ❌ {job.stats.errors}
                        </div>
                      )}
                      {job.error && (
                        <div className="mt-2 text-xs text-red-400 truncate">
                          {job.error}
                        </div>
                      )}
                      
                      {/* Таймер и кнопка проверки статуса */}
                      {job.status === 'running' && job.startedAt && (
                        <>
                          <JobTimer 
                            startedAt={job.startedAt} 
                            estimatedSeconds={100}
                            stats={job.stats as JobStats}
                          />
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={async () => {
                                const res = await fetch(`/api/sync?jobId=${job.id}`);
                                const data = await res.json();
                                if (data.results) {
                                  alert(`✅ Данные загружены!\n\nОбработано: ${data.results.processed}\nОшибок: ${data.results.errors}\nВсего: ${data.results.total}`);
                                } else if (data.job?.status === 'running') {
                                  alert('⏳ Парсинг ещё выполняется...\n\nПроверьте Apify Console для деталей:\nconsole.apify.com');
                                }
                                fetchJobs();
                              }}
                              className="flex-1 py-2 bg-blue-500/20 text-blue-300 text-xs rounded-lg hover:bg-blue-500/30 transition-colors"
                            >
                              🔍 Проверить
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm('Остановить парсинг? Уже полученные данные могут быть потеряны.')) return;
                                const res = await fetch(`/api/sync?jobId=${job.id}`, { method: 'DELETE' });
                                const data = await res.json();
                                if (data.success) {
                                  alert('🛑 Парсинг остановлен');
                                } else {
                                  alert(`❌ Ошибка: ${data.error}`);
                                }
                                fetchJobs();
                              }}
                              className="flex-1 py-2 bg-red-500/20 text-red-300 text-xs rounded-lg hover:bg-red-500/30 transition-colors"
                            >
                              🛑 Остановить
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Stats */}
              <div className="mt-6 pt-6 border-t border-white/10">
                <h3 className="text-sm font-medium text-white/60 mb-3">Быстрая статистика</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="text-lg font-bold text-green-400">
                      {jobs.filter(j => j.status === 'completed').length}
                    </div>
                    <div className="text-xs text-white/50">Завершено</div>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="text-lg font-bold text-blue-400">
                      {jobs.filter(j => j.status === 'running').length}
                    </div>
                    <div className="text-xs text-white/50">В процессе</div>
                  </div>
                </div>
              </div>

              {/* Consolidation */}
              <div className="mt-6 pt-6 border-t border-white/10">
                <h3 className="text-sm font-medium text-white/60 mb-3">🔄 Консолидация данных</h3>
                <p className="text-xs text-white/40 mb-3">
                  Объединяет дубликаты из разных источников (Google, Яндекс, 2ГИС)
                </p>
                <button
                  onClick={async () => {
                    if (!confirm('Запустить консолидацию? Это объединит похожие рестораны из разных источников.')) return;
                    
                    const res = await fetch('/api/consolidate', { method: 'POST' });
                    const data = await res.json();
                    
                    if (res.ok) {
                      alert(`✅ Консолидация завершена!\n\n${data.message}`);
                    } else {
                      alert(`❌ Ошибка: ${data.error}`);
                    }
                  }}
                  className="w-full py-2.5 bg-purple-500/20 text-purple-300 text-sm rounded-lg hover:bg-purple-500/30 transition-colors font-medium"
                >
                  🔗 Авто-объединение
                </button>
                <button
                  onClick={() => setShowDuplicatesModal(true)}
                  className="w-full mt-2 py-2.5 bg-amber-500/20 text-amber-300 text-sm rounded-lg hover:bg-amber-500/30 transition-colors font-medium"
                >
                  🔍 Просмотр дубликатов
                </button>
              </div>

              {/* Import JSON Section */}
              <div className="mt-6 pt-6 border-t border-white/10">
                <h3 className="text-sm font-medium text-white/60 mb-3">📥 Импорт JSON</h3>
                <p className="text-xs text-white/40 mb-3">
                  Загрузите JSON файл из Apify (Google Maps, Yandex, 2GIS)
                </p>
                <label className="block">
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      const text = await file.text();
                      let data;
                      try {
                        data = JSON.parse(text);
                      } catch {
                        alert('❌ Некорректный JSON файл');
                        return;
                      }
                      
                      if (!Array.isArray(data)) {
                        alert('❌ JSON должен быть массивом');
                        return;
                      }
                      
                      if (!confirm(`Импортировать ${data.length} записей?\n\nЭто может занять несколько минут.`)) {
                        return;
                      }
                      
                      // Разбиваем на чанки
                      const chunkSize = 100;
                      const chunks = [];
                      for (let i = 0; i < data.length; i += chunkSize) {
                        chunks.push(data.slice(i, i + chunkSize));
                      }
                      
                      let totalProcessed = 0;
                      let totalErrors = 0;
                      
                      for (let i = 0; i < chunks.length; i++) {
                        try {
                          const res = await fetch('/api/import', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ data: chunks[i], source: 'google' }),
                          });
                          const result = await res.json();
                          if (result.stats) {
                            totalProcessed += result.stats.processed || 0;
                            totalErrors += result.stats.errors || 0;
                          }
                        } catch (err) {
                          totalErrors += chunks[i].length;
                        }
                      }
                      
                      alert(`✅ Импорт завершён!\n\nОбработано: ${totalProcessed}\nОшибок: ${totalErrors}`);
                      
                      // Обновляем статистику
                      fetch('/api/consolidate')
                        .then(res => res.json())
                        .then(data => setDbStats(data))
                        .catch(console.error);
                      
                      e.target.value = '';
                    }}
                  />
                  <span className="w-full py-2.5 bg-blue-500/20 text-blue-300 text-sm rounded-lg hover:bg-blue-500/30 transition-colors font-medium flex items-center justify-center gap-2 cursor-pointer">
                    📂 Выбрать JSON файл
                  </span>
                </label>
              </div>

              {/* Chains Section */}
              <ChainsSection />

              {/* Quality Section */}
              <QualitySection />

              {/* Enrich Data Section */}
              <EnrichSection />


              {/* Delete Data Section */}
              <div className="mt-6 pt-6 border-t border-white/10">
                <h3 className="text-sm font-medium text-white/60 mb-3">🗑️ Удаление данных</h3>
                <p className="text-xs text-white/40 mb-3">
                  Удалить спарсенные данные (рестораны, отзывы, время работы)
                </p>
                
                {/* Selective Delete Button */}
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full mb-3 py-2.5 bg-orange-500/20 text-orange-300 text-sm rounded-lg hover:bg-orange-500/30 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <span>✏️</span>
                  <span>Выборочное удаление</span>
                </button>
                
                <div className="space-y-2">
                  {/* Delete by source */}
                  {dbStats?.bySource && dbStats.bySource.map(source => (
                    <button
                      key={source.source}
                      onClick={async () => {
                        if (!confirm(`Удалить все ${source.count} ресторанов из ${source.source}?\n\nЭто действие нельзя отменить!`)) return;
                        
                        const res = await fetch('/api/restaurants/delete', {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ source: source.source }),
                        });
                        const data = await res.json();
                        
                        if (res.ok) {
                          alert(`✅ ${data.message}`);
                          window.location.reload();
                        } else {
                          alert(`❌ Ошибка: ${data.error}`);
                        }
                      }}
                      className="w-full py-2 px-3 bg-red-500/10 text-red-300 text-sm rounded-lg hover:bg-red-500/20 transition-colors flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <span>{source.source === 'google' ? '🗺️' : source.source === 'yandex' ? '🔴' : '🟢'}</span>
                        <span className="capitalize">{source.source}</span>
                      </span>
                      <span className="text-white/50">{source.count} шт</span>
                    </button>
                  ))}
                  
                  {/* Delete all */}
                  <button
                    onClick={async () => {
                      const confirmation = prompt(
                        `⚠️ ОПАСНО! Вы собираетесь удалить ВСЕ данные!\n\n` +
                        `Это удалит ${dbStats?.total || 0} ресторанов и все связанные отзывы.\n\n` +
                        `Для подтверждения введите "УДАЛИТЬ ВСЁ":`
                      );
                      
                      if (confirmation !== 'УДАЛИТЬ ВСЁ') {
                        alert('Удаление отменено');
                        return;
                      }
                      
                      const res = await fetch('/api/restaurants/delete', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ all: true }),
                      });
                      const data = await res.json();
                      
                      if (res.ok) {
                        alert(`✅ ${data.message}`);
                        window.location.reload();
                      } else {
                        alert(`❌ Ошибка: ${data.error}`);
                      }
                    }}
                    disabled={!dbStats?.total}
                    className="w-full mt-3 py-2.5 bg-red-600/30 text-red-300 text-sm rounded-lg hover:bg-red-600/50 transition-colors font-medium border border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    🗑️ Удалить ВСЁ ({dbStats?.total || 0} ресторанов)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Контент вкладки Управление ресторанами */}
        {activeTab === 'management' && (
          <div className="space-y-6">
            {/* Заголовок */}
            <div className="bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-teal-500/20 backdrop-blur-xl rounded-2xl border border-green-500/30 p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-green-500/20 rounded-2xl flex items-center justify-center text-3xl">
                  🎯
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Управление ресторанами</h2>
                  <p className="text-white/60">
                    Точечное обновление данных через Google Places API
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-green-400">$0.017</div>
                  <div className="text-xs text-white/50 mt-1">за обновление</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-emerald-400">60x</div>
                  <div className="text-xs text-white/50 mt-1">дешевле Apify</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-teal-400">$200</div>
                  <div className="text-xs text-white/50 mt-1">бесплатно/мес</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-cyan-400">~11.7k</div>
                  <div className="text-xs text-white/50 mt-1">обновлений</div>
                </div>
              </div>
            </div>

            {/* Что обновляется */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <h3 className="text-lg font-bold text-white mb-4">📦 Что обновляется за $0.017:</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="flex items-center gap-2 text-white/70">
                  <span className="text-green-400">✅</span> Рейтинг
                </div>
                <div className="flex items-center gap-2 text-white/70">
                  <span className="text-green-400">✅</span> Количество отзывов
                </div>
                <div className="flex items-center gap-2 text-white/70">
                  <span className="text-green-400">✅</span> Телефон
                </div>
                <div className="flex items-center gap-2 text-white/70">
                  <span className="text-green-400">✅</span> Сайт
                </div>
                <div className="flex items-center gap-2 text-white/70">
                  <span className="text-green-400">✅</span> Время работы
                </div>
                <div className="flex items-center gap-2 text-white/70">
                  <span className="text-green-400">✅</span> Ценовая категория
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/10 text-sm text-white/50">
                💡 Фото обновляются отдельно: $0.007 за каждое
              </div>
            </div>

            {/* Основной блок управления */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <RestaurantManagementPanel />
            </div>
          </div>
        )}
      </div>

      {/* Модальное окно мониторинга */}
      <ParsingMonitorModal
        isOpen={showMonitor}
        onClose={() => {
          setShowMonitor(false);
          fetchJobs();
          fetchApifyUsage();
        }}
        jobId={activeJobId}
        source={activeSource}
      />

      {/* Модальное окно выборочного удаления */}
      <SelectiveDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onDeleted={() => {
          // Обновляем статистику после удаления
          fetch('/api/consolidate')
            .then(res => res.json())
            .then(data => setDbStats(data))
            .catch(console.error);
        }}
      />

      {/* Модальное окно дубликатов */}
      <DuplicatesModal
        isOpen={showDuplicatesModal}
        onClose={() => setShowDuplicatesModal(false)}
        onMerged={() => {
          // Обновляем статистику после объединения
          fetch('/api/consolidate')
            .then(res => res.json())
            .then(data => setDbStats(data))
            .catch(console.error);
        }}
      />
    </main>
  );
}
