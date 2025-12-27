'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Settings {
  openai: {
    apiKey: string;
    model: string;
    connected: boolean;
  };
  eskiz: {
    email: string;
    password: string;
    sender: string;
    balance: number;
    connected: boolean;
  };
  telegram: {
    botToken: string;  // Telegram Bot API (простой вариант)
    sessionString: string;
    apiId: string;
    apiHash: string;
    phone: string;
    connected: boolean;
    mode: 'bot' | 'user';  // Режим работы
  };
}

interface StatusCheck {
  service: string;
  status: 'checking' | 'connected' | 'error' | 'not_configured';
  message?: string;
}

export default function CRMSettings() {
  const [settings, setSettings] = useState<Settings>({
    openai: { apiKey: '', model: 'gpt-4o-mini', connected: false },
    eskiz: { email: '', password: '', sender: '4546', balance: 0, connected: false },
    telegram: { botToken: '', sessionString: '', apiId: '', apiHash: '', phone: '', connected: false, mode: 'bot' },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statuses, setStatuses] = useState<StatusCheck[]>([]);
  const [activeTab, setActiveTab] = useState<'openai' | 'eskiz' | 'telegram'>('openai');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/crm/settings');
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/crm/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      
      if (res.ok) {
        alert('✅ Настройки сохранены!');
        await checkConnections();
      } else {
        alert('❌ Ошибка сохранения');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('❌ Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const checkConnections = async () => {
    setStatuses([
      { service: 'OpenAI', status: 'checking' },
      { service: 'Eskiz SMS', status: 'checking' },
      { service: 'Telegram', status: 'checking' },
    ]);

    try {
      const res = await fetch('/api/crm/settings/check');
      const data = await res.json();
      setStatuses(data.statuses || []);
    } catch (error) {
      console.error('Error checking connections:', error);
    }
  };

  const testService = async (service: 'openai' | 'eskiz' | 'telegram') => {
    setStatuses(prev => prev.map(s => 
      s.service.toLowerCase().includes(service) 
        ? { ...s, status: 'checking' as const } 
        : s
    ));

    try {
      const res = await fetch(`/api/crm/settings/test/${service}`, { method: 'POST' });
      const data = await res.json();
      
      setStatuses(prev => prev.map(s => 
        s.service.toLowerCase().includes(service)
          ? { service: s.service, status: data.success ? 'connected' : 'error', message: data.message }
          : s
      ));
    } catch (error) {
      console.error(`Error testing ${service}:`, error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/crm" className="text-white/60 hover:text-white transition-colors">
                ← Назад в CRM
              </Link>
              <h1 className="text-xl font-bold text-white">⚙️ Настройки интеграций</h1>
            </div>
            
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : '💾 Сохранить всё'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Status Overview */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatusCard
            title="OpenAI"
            icon="🤖"
            status={statuses.find(s => s.service === 'OpenAI')?.status || 
              (settings.openai.apiKey ? 'connected' : 'not_configured')}
            description="AI генерация сообщений"
            onClick={() => setActiveTab('openai')}
            active={activeTab === 'openai'}
          />
          <StatusCard
            title="Eskiz SMS"
            icon="📱"
            status={statuses.find(s => s.service === 'Eskiz SMS')?.status || 
              (settings.eskiz.email ? 'connected' : 'not_configured')}
            description="SMS через API"
            onClick={() => setActiveTab('eskiz')}
            active={activeTab === 'eskiz'}
          />
          <Link href="/crm/settings/sms-devices">
            <StatusCard
              title="SMS Gateway"
              icon="📲"
              status="connected"
              description="SMS с телефона"
              onClick={() => {}}
              active={false}
            />
          </Link>
          <StatusCard
            title="Telegram"
            icon="✈️"
            status={statuses.find(s => s.service === 'Telegram')?.status || 
              (settings.telegram.sessionString ? 'connected' : 'not_configured')}
            description="Telegram рассылка"
            onClick={() => setActiveTab('telegram')}
            active={activeTab === 'telegram'}
          />
        </div>

        {/* Settings Forms */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          {activeTab === 'openai' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-2">🤖 OpenAI Configuration</h2>
                <p className="text-white/60 text-sm mb-6">
                  OpenAI API используется для генерации персонализированных сообщений, 
                  обработки возражений и автоматического ведения диалогов с лидами.
                </p>
              </div>
              
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
                <h3 className="text-blue-400 font-medium mb-2">💡 Как получить API ключ:</h3>
                <ol className="text-white/70 text-sm space-y-1 list-decimal list-inside">
                  <li>Зайдите на <a href="https://platform.openai.com" target="_blank" className="text-blue-400 underline">platform.openai.com</a></li>
                  <li>Перейдите в раздел API Keys</li>
                  <li>Нажмите "Create new secret key"</li>
                  <li>Скопируйте ключ (начинается с sk-...)</li>
                </ol>
                <p className="text-yellow-400 text-sm mt-3">⚠️ Стоимость: ~$0.002 за сообщение (GPT-4o-mini)</p>
              </div>

              <div>
                <label className="block text-white/60 text-sm mb-2">API Key</label>
                <input
                  type="password"
                  value={settings.openai.apiKey}
                  onChange={(e) => setSettings(s => ({ ...s, openai: { ...s.openai, apiKey: e.target.value } }))}
                  placeholder="sk-..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-white/60 text-sm mb-2">Модель</label>
                <select
                  value={settings.openai.model}
                  onChange={(e) => setSettings(s => ({ ...s, openai: { ...s.openai, model: e.target.value } }))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="gpt-4o-mini">GPT-4o Mini (дешевле, быстрее)</option>
                  <option value="gpt-4o">GPT-4o (умнее, дороже)</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                </select>
              </div>

              <button
                onClick={() => testService('openai')}
                className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all"
              >
                🔌 Проверить подключение
              </button>
            </div>
          )}

          {activeTab === 'eskiz' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-2">📱 Eskiz SMS Configuration</h2>
                <p className="text-white/60 text-sm mb-6">
                  Eskiz.uz - сервис для отправки SMS в Узбекистане. 
                  Используется для отправки сообщений клиентам напрямую на телефон.
                </p>
              </div>
              
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-6">
                <h3 className="text-green-400 font-medium mb-2">💡 Как настроить Eskiz:</h3>
                <ol className="text-white/70 text-sm space-y-1 list-decimal list-inside">
                  <li>Зарегистрируйтесь на <a href="https://eskiz.uz" target="_blank" className="text-green-400 underline">eskiz.uz</a></li>
                  <li>Пополните баланс (от 50,000 сум)</li>
                  <li>Введите email и пароль от личного кабинета</li>
                  <li>Укажите имя отправителя (по умолчанию: 4546)</li>
                </ol>
                <p className="text-yellow-400 text-sm mt-3">⚠️ Стоимость: ~100 сум за SMS</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/60 text-sm mb-2">Email</label>
                  <input
                    type="email"
                    value={settings.eskiz.email}
                    onChange={(e) => setSettings(s => ({ ...s, eskiz: { ...s.eskiz, email: e.target.value } }))}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-white/60 text-sm mb-2">Пароль</label>
                  <input
                    type="password"
                    value={settings.eskiz.password}
                    onChange={(e) => setSettings(s => ({ ...s, eskiz: { ...s.eskiz, password: e.target.value } }))}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white/60 text-sm mb-2">Имя отправителя (Sender ID)</label>
                <input
                  type="text"
                  value={settings.eskiz.sender}
                  onChange={(e) => setSettings(s => ({ ...s, eskiz: { ...s.eskiz, sender: e.target.value } }))}
                  placeholder="4546"
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
                />
                <p className="text-white/40 text-xs mt-1">Получите у Eskiz или используйте стандартный: 4546</p>
              </div>

              <button
                onClick={() => testService('eskiz')}
                className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all"
              >
                🔌 Проверить подключение и баланс
              </button>
            </div>
          )}

          {activeTab === 'telegram' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-2">✈️ Telegram Configuration</h2>
                <p className="text-white/60 text-sm mb-4">
                  Выберите способ отправки сообщений через Telegram
                </p>
              </div>
              
              {/* Mode Switcher */}
              <div className="flex bg-white/10 rounded-lg p-1 mb-6">
                <button
                  onClick={() => setSettings(s => ({ ...s, telegram: { ...s.telegram, mode: 'bot' } }))}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    settings.telegram.mode === 'bot' 
                      ? 'bg-sky-500 text-white' 
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  🤖 Bot API (проще)
                </button>
                <button
                  onClick={() => setSettings(s => ({ ...s, telegram: { ...s.telegram, mode: 'user' } }))}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    settings.telegram.mode === 'user' 
                      ? 'bg-sky-500 text-white' 
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  👤 User Account (мощнее)
                </button>
              </div>

              {/* Bot API Mode */}
              {settings.telegram.mode === 'bot' && (
                <>
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-6">
                    <h3 className="text-green-400 font-medium mb-2">💡 Telegram Bot API (рекомендуется):</h3>
                    <ol className="text-white/70 text-sm space-y-1 list-decimal list-inside">
                      <li>Откройте <a href="https://t.me/BotFather" target="_blank" className="text-green-400 underline">@BotFather</a> в Telegram</li>
                      <li>Отправьте команду /newbot</li>
                      <li>Придумайте имя и username для бота</li>
                      <li>Скопируйте токен (вида 123456:ABC-DEF...)</li>
                    </ol>
                    <p className="text-green-400 text-sm mt-3">✅ Работает сразу, без лимитов на отправку</p>
                    <p className="text-yellow-400 text-sm mt-1">⚠️ Бот может писать только тем, кто ему написал первым</p>
                  </div>

                  <div>
                    <label className="block text-white/60 text-sm mb-2">Bot Token от @BotFather</label>
                    <input
                      type="password"
                      value={settings.telegram.botToken}
                      onChange={(e) => setSettings(s => ({ ...s, telegram: { ...s.telegram, botToken: e.target.value } }))}
                      placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                      className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                </>
              )}

              {/* User Account Mode */}
              {settings.telegram.mode === 'user' && (
                <>
                  <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-4 mb-6">
                    <h3 className="text-sky-400 font-medium mb-2">💡 User Account (MTProto):</h3>
                    <ol className="text-white/70 text-sm space-y-1 list-decimal list-inside">
                      <li>Зайдите на <a href="https://my.telegram.org" target="_blank" className="text-sky-400 underline">my.telegram.org</a></li>
                      <li>Авторизуйтесь с вашим номером телефона</li>
                      <li>Перейдите в "API development tools"</li>
                      <li>Создайте приложение и получите API ID и API Hash</li>
                    </ol>
                    <p className="text-yellow-400 text-sm mt-3">⚠️ Лимит: ~50 сообщений в день новым контактам</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white/60 text-sm mb-2">API ID</label>
                      <input
                        type="text"
                        value={settings.telegram.apiId}
                        onChange={(e) => setSettings(s => ({ ...s, telegram: { ...s.telegram, apiId: e.target.value } }))}
                        placeholder="12345678"
                        className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-white/60 text-sm mb-2">API Hash</label>
                      <input
                        type="password"
                        value={settings.telegram.apiHash}
                        onChange={(e) => setSettings(s => ({ ...s, telegram: { ...s.telegram, apiHash: e.target.value } }))}
                        placeholder="abcdef1234567890..."
                        className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-white/60 text-sm mb-2">Номер телефона</label>
                    <input
                      type="tel"
                      value={settings.telegram.phone}
                      onChange={(e) => setSettings(s => ({ ...s, telegram: { ...s.telegram, phone: e.target.value } }))}
                      placeholder="+998901234567"
                      className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-white/60 text-sm mb-2">Session String</label>
                    <textarea
                      value={settings.telegram.sessionString}
                      onChange={(e) => setSettings(s => ({ ...s, telegram: { ...s.telegram, sessionString: e.target.value } }))}
                      placeholder="Будет сгенерирована после авторизации..."
                      rows={3}
                      className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-purple-500 font-mono text-xs"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => testService('telegram')}
                  className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all"
                >
                  🔌 Проверить подключение
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick Guide */}
        <div className="mt-8 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-4">🚀 Быстрый старт</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-2xl mb-2">1️⃣</div>
              <h4 className="text-white font-medium mb-1">Настройте OpenAI</h4>
              <p className="text-white/60">Добавьте API ключ для AI генерации сообщений</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-2xl mb-2">2️⃣</div>
              <h4 className="text-white font-medium mb-1">Выберите канал</h4>
              <p className="text-white/60">Telegram для мгновенных сообщений или SMS для надёжности</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-2xl mb-2">3️⃣</div>
              <h4 className="text-white font-medium mb-1">Запустите кампанию</h4>
              <p className="text-white/60">Выберите лидов и запустите AI рассылку</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusCard({ title, icon, status, description, onClick, active }: {
  title: string;
  icon: string;
  status: 'checking' | 'connected' | 'error' | 'not_configured';
  description: string;
  onClick: () => void;
  active: boolean;
}) {
  const statusStyles = {
    checking: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Проверка...' },
    connected: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Подключено' },
    error: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Ошибка' },
    not_configured: { bg: 'bg-white/10', text: 'text-white/40', label: 'Не настроено' },
  };

  const style = statusStyles[status];

  return (
    <button
      onClick={onClick}
      className={`text-left p-4 rounded-xl border transition-all ${
        active 
          ? 'bg-purple-500/20 border-purple-500/50' 
          : 'bg-white/5 border-white/10 hover:bg-white/10'
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-white font-medium">{title}</span>
      </div>
      <p className="text-white/50 text-sm mb-3">{description}</p>
      <div className={`inline-flex items-center gap-2 px-2 py-1 rounded ${style.bg}`}>
        {status === 'checking' && (
          <div className="w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        )}
        {status === 'connected' && <span className="text-green-400">✓</span>}
        {status === 'error' && <span className="text-red-400">✕</span>}
        {status === 'not_configured' && <span className="text-white/40">○</span>}
        <span className={`text-xs ${style.text}`}>{style.label}</span>
      </div>
    </button>
  );
}

