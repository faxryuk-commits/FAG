'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface TelegramStats {
  totalLeads: number;
  totalMobile: number;
  withTelegram: number;
  mobileWithoutTelegram: number;
  telegramCoverage: string;
  canCheckMore: number;
}

interface CheckResult {
  total: number;
  checked: number;
  withTelegram: number;
  withoutTelegram: number;
  errors: number;
  details: Array<{
    leadId: string;
    phone: string;
    hasTelegram: boolean;
    telegramId?: string;
    username?: string;
  }>;
}

export default function TelegramFinderPage() {
  const [stats, setStats] = useState<TelegramStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchSize, setBatchSize] = useState(100);
  const [fullScanProgress, setFullScanProgress] = useState<{
    running: boolean;
    current: number;
    total: number;
    found: number;
  } | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/crm/telegram/check-contacts');
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const runTestCheck = async () => {
    setChecking(true);
    setError(null);
    setTestResult(null);
    
    try {
      const res = await fetch('/api/crm/telegram/check-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testMode: true, limit: batchSize }),
      });
      
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
        if (data.needsConfiguration) {
          setError(`${data.error}\n\n${data.help}`);
        }
      } else {
        setTestResult(data);
      }
    } catch (e) {
      setError('Ошибка сети');
    } finally {
      setChecking(false);
    }
  };

  const runRealCheck = async () => {
    if (!confirm(`Проверить ${batchSize} номеров через Telegram?\n\nЭто займёт около ${Math.ceil(batchSize / 100) * 3} секунд.`)) {
      return;
    }
    
    setChecking(true);
    setError(null);
    setCheckResult(null);
    
    try {
      const res = await fetch('/api/crm/telegram/check-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testMode: false, limit: batchSize }),
      });
      
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setCheckResult(data.result);
        fetchStats(); // Обновляем статистику
      }
    } catch (e) {
      setError('Ошибка сети');
    } finally {
      setChecking(false);
    }
  };

  // Проверка ВСЕЙ базы
  const runFullScan = async () => {
    if (!stats?.mobileWithoutTelegram) {
      alert('Нет номеров для проверки');
      return;
    }
    
    if (!confirm(`Проверить ВСЮ базу (${stats.mobileWithoutTelegram} номеров)?\n\nЭто займёт около ${Math.ceil(stats.mobileWithoutTelegram / 100) * 3} секунд.\n\nПроцесс можно будет остановить.`)) {
      return;
    }
    
    setError(null);
    setCheckResult(null);
    setFullScanProgress({
      running: true,
      current: 0,
      total: stats.mobileWithoutTelegram,
      found: 0,
    });
    
    const batchSizeForScan = 100;
    let offset = 0;
    let totalFound = 0;
    let allDetails: CheckResult['details'] = [];
    
    try {
      while (offset < stats.mobileWithoutTelegram) {
        const res = await fetch('/api/crm/telegram/check-contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            testMode: false, 
            limit: batchSizeForScan,
            offset: offset,
          }),
        });
        
        const data = await res.json();
        
        if (data.error) {
          setError(data.error);
          break;
        }
        
        if (data.result) {
          totalFound += data.result.withTelegram;
          allDetails = [...allDetails, ...data.result.details];
        }
        
        offset += batchSizeForScan;
        
        setFullScanProgress(prev => prev ? {
          ...prev,
          current: Math.min(offset, stats.mobileWithoutTelegram),
          found: totalFound,
        } : null);
        
        // Пауза между пачками
        await new Promise(r => setTimeout(r, 1000));
      }
      
      // Финальный результат
      setCheckResult({
        total: offset,
        checked: offset,
        withTelegram: totalFound,
        withoutTelegram: offset - totalFound,
        errors: 0,
        details: allDetails,
      });
      
      fetchStats();
      
    } catch (e) {
      setError('Ошибка при сканировании');
    } finally {
      setFullScanProgress(null);
    }
  };

  const stopFullScan = () => {
    setFullScanProgress(null);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/crm" className="text-white/50 hover:text-white transition-colors">
                ← CRM
              </Link>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-2xl">✈️</span>
                Telegram Finder
              </h1>
            </div>
            <Link 
              href="/crm/settings"
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-xl text-sm transition-all"
            >
              ⚙️ Настройки
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-8">
        {/* Статистика */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
          </div>
        ) : stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard 
              icon="📊" 
              value={stats.totalLeads} 
              label="Всего лидов" 
            />
            <StatCard 
              icon="📱" 
              value={stats.totalMobile} 
              label="Мобильных" 
              color="blue"
            />
            <StatCard 
              icon="✈️" 
              value={stats.withTelegram} 
              label="Есть Telegram" 
              color="sky"
            />
            <StatCard 
              icon="🔍" 
              value={stats.mobileWithoutTelegram} 
              label="Можно проверить" 
              color="purple"
            />
          </div>
        )}

        {/* Прогресс бар */}
        {stats && stats.totalMobile > 0 && (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/60 text-sm">Покрытие Telegram</span>
              <span className="text-sky-400 font-bold">{stats.telegramCoverage}%</span>
            </div>
            <div className="h-4 bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 rounded-full transition-all"
                style={{ width: `${stats.telegramCoverage}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-white/40">
              <span>{stats.withTelegram} найдено</span>
              <span>{stats.mobileWithoutTelegram} можно проверить</span>
            </div>
          </div>
        )}

        {/* Как это работает */}
        <div className="bg-gradient-to-br from-sky-500/10 to-cyan-500/10 border border-sky-500/20 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span>💡</span> Как это работает
          </h2>
          <div className="space-y-3 text-white/70 text-sm">
            <p>
              <strong className="text-white">1. Импорт контактов:</strong> Telegram API позволяет проверить, зарегистрированы ли номера телефонов в Telegram.
            </p>
            <p>
              <strong className="text-white">2. Получение данных:</strong> Для найденных номеров получаем telegram ID и username.
            </p>
            <p>
              <strong className="text-white">3. Коммуникация:</strong> После этого можно писать в Telegram напрямую по ID, даже без username!
            </p>
          </div>
          
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
            <p className="text-yellow-400 text-sm">
              ⚠️ <strong>Важно:</strong> Для работы нужна авторизация через личный Telegram аккаунт (MTProto API), не бот.
            </p>
          </div>
        </div>

        {/* Настройка проверки */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-bold text-white mb-4">🔍 Проверка номеров</h2>
          
          <div className="mb-4">
            <label className="text-white/60 text-sm mb-2 block">Количество номеров для проверки</label>
            <div className="flex gap-2">
              {[50, 100, 200, 500].map(n => (
                <button
                  key={n}
                  onClick={() => setBatchSize(n)}
                  className={`px-4 py-2 rounded-lg text-sm transition-all ${
                    batchSize === n 
                      ? 'bg-sky-500 text-white' 
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={runTestCheck}
              disabled={checking || !!fullScanProgress}
              className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-all disabled:opacity-50"
            >
              {checking ? '⏳ Проверяем...' : '👁️ Тест (без отправки)'}
            </button>
            <button
              onClick={runRealCheck}
              disabled={checking || !!fullScanProgress}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white rounded-xl font-medium transition-all disabled:opacity-50"
            >
              {checking ? '⏳ Проверяем...' : `🚀 Проверить ${batchSize}`}
            </button>
          </div>
          
          {/* Кнопка полной проверки */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <button
              onClick={runFullScan}
              disabled={checking || !!fullScanProgress || !stats?.mobileWithoutTelegram}
              className="w-full px-4 py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-bold text-lg transition-all disabled:opacity-50"
            >
              {fullScanProgress ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="animate-spin">⏳</span>
                  Сканирование... {fullScanProgress.current} / {fullScanProgress.total}
                </span>
              ) : (
                `🔥 ПРОВЕРИТЬ ВСЮ БАЗУ (${stats?.mobileWithoutTelegram || 0} номеров)`
              )}
            </button>
            
            {fullScanProgress && (
              <div className="mt-3">
                <div className="flex justify-between text-sm text-white/60 mb-2">
                  <span>Прогресс: {Math.round((fullScanProgress.current / fullScanProgress.total) * 100)}%</span>
                  <span className="text-green-400">Найдено TG: {fullScanProgress.found}</span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                    style={{ width: `${(fullScanProgress.current / fullScanProgress.total) * 100}%` }}
                  />
                </div>
                <button
                  onClick={stopFullScan}
                  className="mt-2 w-full py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm"
                >
                  ⏹️ Остановить
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Ошибка */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 mb-8">
            <h3 className="text-red-400 font-bold mb-2">❌ Ошибка</h3>
            <p className="text-white/70 whitespace-pre-wrap">{error}</p>
            {error.includes('MTProto') && (
              <Link 
                href="/crm/settings"
                className="inline-block mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm"
              >
                ⚙️ Настроить Telegram MTProto
              </Link>
            )}
          </div>
        )}

        {/* Результат теста */}
        {testResult && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-6 mb-8">
            <h3 className="text-blue-400 font-bold mb-4">👁️ Результат теста</h3>
            
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-black/20 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-white">{testResult.currentStats?.total || 0}</div>
                <div className="text-white/50 text-xs">Всего номеров</div>
              </div>
              <div className="bg-black/20 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-sky-400">{testResult.currentStats?.alreadyHaveTelegram || 0}</div>
                <div className="text-white/50 text-xs">Уже есть TG</div>
              </div>
              <div className="bg-black/20 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-purple-400">{testResult.currentStats?.needCheck || 0}</div>
                <div className="text-white/50 text-xs">Нужно проверить</div>
              </div>
            </div>
            
            {testResult.samplePhones && (
              <div>
                <div className="text-white/50 text-sm mb-2">Примеры номеров:</div>
                <div className="space-y-1">
                  {testResult.samplePhones.map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm p-2 bg-black/20 rounded">
                      <span className="text-white/70">{p.name}</span>
                      <span className="text-white/50">{p.phone}</span>
                      <span className={p.hasTelegram ? 'text-green-400' : 'text-white/30'}>
                        {p.hasTelegram ? '✅ TG' : '❓'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Результат реальной проверки */}
        {checkResult && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6">
            <h3 className="text-green-400 font-bold mb-4">✅ Проверка завершена!</h3>
            
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-black/20 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-white">{checkResult.checked}</div>
                <div className="text-white/50 text-xs">Проверено</div>
              </div>
              <div className="bg-black/20 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-green-400">{checkResult.withTelegram}</div>
                <div className="text-white/50 text-xs">Есть TG</div>
              </div>
              <div className="bg-black/20 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-white/50">{checkResult.withoutTelegram}</div>
                <div className="text-white/50 text-xs">Нет TG</div>
              </div>
              <div className="bg-black/20 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-red-400">{checkResult.errors}</div>
                <div className="text-white/50 text-xs">Ошибок</div>
              </div>
            </div>
            
            {checkResult.details.filter(d => d.hasTelegram).length > 0 && (
              <div>
                <div className="text-white/50 text-sm mb-2">Найденные Telegram аккаунты:</div>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {checkResult.details.filter(d => d.hasTelegram).map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-sm p-2 bg-black/20 rounded">
                      <span className="text-white/70">{d.phone}</span>
                      <span className="text-sky-400">
                        {d.username ? `@${d.username}` : `ID: ${d.telegramId}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon, value, label, color }: { 
  icon: string; 
  value: number; 
  label: string; 
  color?: string;
}) {
  const colors = {
    blue: 'text-blue-400',
    sky: 'text-sky-400',
    purple: 'text-purple-400',
    green: 'text-green-400',
  };
  
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`text-2xl font-bold ${color ? colors[color as keyof typeof colors] : 'text-white'}`}>
        {value}
      </div>
      <div className="text-white/40 text-sm">{label}</div>
    </div>
  );
}

