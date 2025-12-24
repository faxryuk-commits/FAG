'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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

export default function AdminPage() {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  // Form state
  const [source, setSource] = useState<'google' | 'yandex' | '2gis'>('google');
  const [searchQuery, setSearchQuery] = useState('рестораны');
  const [location, setLocation] = useState('Москва');
  const [maxResults, setMaxResults] = useState(50);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000); // Обновляем каждые 5 секунд
    return () => clearInterval(interval);
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

  const startSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          searchQuery,
          location,
          maxResults,
        }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        alert(`✅ Синхронизация запущена!\nJob ID: ${data.jobId}`);
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

  const checkJobStatus = async (jobId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sync?jobId=${jobId}`);
      const data = await res.json();
      
      if (data.results) {
        alert(`✅ Результаты загружены!\nОбработано: ${data.results.processed}\nОшибок: ${data.results.errors}`);
      }
      
      fetchJobs();
    } catch (error) {
      console.error('Error checking status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-700',
      running: 'bg-blue-100 text-blue-700 animate-pulse',
      completed: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
    };
    return styles[status] || styles.pending;
  };

  const getSourceIcon = (source: string) => {
    const icons: Record<string, string> = {
      google: '🗺️',
      yandex: '🔴',
      '2gis': '🟢',
    };
    return icons[source] || '📍';
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-2xl">🍽️</Link>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Админ-панель</h1>
              <p className="text-sm text-gray-500">Управление синхронизацией данных</p>
            </div>
          </div>
          <Link
            href="/"
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            ← На главную
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sync Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-8">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                🔄 Запуск синхронизации
              </h2>

              <div className="space-y-4">
                {/* Source */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Источник данных
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['google', 'yandex', '2gis'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSource(s)}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          source === s
                            ? 'border-red-500 bg-red-50 text-red-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-2xl mb-1">{getSourceIcon(s)}</div>
                        <div className="text-xs font-medium capitalize">{s}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search Query */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Поисковый запрос
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="рестораны, кафе, суши..."
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Город / Локация
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="Москва, Санкт-Петербург..."
                  />
                </div>

                {/* Max Results */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Максимум результатов: {maxResults}
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="200"
                    step="10"
                    value={maxResults}
                    onChange={(e) => setMaxResults(Number(e.target.value))}
                    className="w-full accent-red-500"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>10</span>
                    <span>200</span>
                  </div>
                </div>

                {/* Submit */}
                <button
                  onClick={startSync}
                  disabled={syncing}
                  className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-500 text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {syncing ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Запуск...
                    </>
                  ) : (
                    <>
                      🚀 Запустить парсинг
                    </>
                  )}
                </button>

                <p className="text-xs text-gray-500 text-center">
                  ⚠️ Убедитесь, что APIFY_API_TOKEN настроен в Vercel
                </p>
              </div>
            </div>
          </div>

          {/* Jobs List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  📋 История задач
                </h2>
                <button
                  onClick={fetchJobs}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  🔄 Обновить
                </button>
              </div>

              {jobs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-5xl mb-4">📭</div>
                  <p>Задач пока нет</p>
                  <p className="text-sm">Запустите первую синхронизацию</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getSourceIcon(job.source)}</span>
                          <div>
                            <div className="font-medium text-gray-800 capitalize">
                              {job.source}
                            </div>
                            <div className="text-sm text-gray-500">
                              {new Date(job.createdAt).toLocaleString('ru-RU')}
                            </div>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(job.status)}`}>
                          {job.status}
                        </span>
                      </div>

                      {job.stats && (
                        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-4 text-sm">
                          {job.stats.processed !== undefined && (
                            <>
                              <div>
                                <span className="text-gray-500">Обработано:</span>{' '}
                                <span className="font-medium text-green-600">{job.stats.processed}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Ошибок:</span>{' '}
                                <span className="font-medium text-red-600">{job.stats.errors}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Всего:</span>{' '}
                                <span className="font-medium">{job.stats.total}</span>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {job.error && (
                        <div className="mt-3 p-3 bg-red-50 rounded-lg text-sm text-red-700">
                          ❌ {job.error}
                        </div>
                      )}

                      {job.status === 'running' && (
                        <div className="mt-3">
                          <button
                            onClick={() => checkJobStatus(job.id)}
                            disabled={loading}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            {loading ? 'Проверка...' : '🔍 Проверить статус'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

