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
  type: 'text' | 'number' | 'select';
  placeholder?: string;
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

// Компонент таймера с реалтайм прогрессом
function JobTimer({ 
  startedAt, 
  estimatedSeconds, 
  stats,
  onRefresh 
}: { 
  startedAt: string; 
  estimatedSeconds: number;
  stats?: JobStats;
  onRefresh?: () => void;
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

  // Авто-обновление каждые 5 секунд
  useEffect(() => {
    if (onRefresh) {
      const refreshInterval = setInterval(onRefresh, 5000);
      return () => clearInterval(refreshInterval);
    }
  }, [onRefresh]);

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

export default function AdminPage() {
  const [scrapers, setScrapers] = useState<Scraper[]>([]);
  const [selectedScraper, setSelectedScraper] = useState<Scraper | null>(null);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [inputValues, setInputValues] = useState<Record<string, any>>({});
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [step, setStep] = useState<'select' | 'configure' | 'fields' | 'confirm'>('select');
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [apifyUsage, setApifyUsage] = useState<ApifyUsage | null>(null);

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

  // Загрузка скреперов и статистики
  useEffect(() => {
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
    
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);
    const usageInterval = setInterval(fetchApifyUsage, 30000); // Обновляем каждые 30 сек
    return () => {
      clearInterval(interval);
      clearInterval(usageInterval);
    };
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/sync');
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

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
        alert(`✅ Парсинг запущен!\n\nJob ID: ${data.jobId}\nПримерное время: ${timeFormatted}\nСтоимость: ~$${cost}`);
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
            <Link href="/" className="text-3xl">🍽️</Link>
            <div>
              <h1 className="text-xl font-bold text-white">Центр управления</h1>
              <p className="text-sm text-white/60">Парсинг данных • Мониторинг • Аналитика</p>
            </div>
          </div>
          <Link
            href="/"
            className="px-4 py-2 text-white/70 hover:text-white transition-colors"
          >
            ← На сайт
          </Link>
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
                          <span className="text-amber-400">⚠️ ~{dbStats.potentialDuplicates} возможных дубликатов</span>
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

                <div className="space-y-4">
                  {selectedScraper.inputFields.map(field => (
                    <div key={field.key}>
                      <label className="block text-sm font-medium text-white/80 mb-2">
                        {field.label}
                      </label>
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
                            onRefresh={fetchJobs}
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
                  🔗 Объединить дубликаты
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
