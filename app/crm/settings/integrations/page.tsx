'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface IntegrationStatus {
  instagram: 'connected' | 'not_configured' | 'error';
  website: 'active';
  analytics: 'connected' | 'not_configured';
}

export default function IntegrationsPage() {
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statuses, setStatuses] = useState<IntegrationStatus>({
    instagram: 'not_configured',
    website: 'active',
    analytics: 'not_configured',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/crm/settings');
      const data = await res.json();
      setSettings(data.settings || {});
      
      // Определяем статусы
      setStatuses({
        instagram: data.settings?.instagramAccessToken ? 'connected' : 'not_configured',
        website: 'active',
        analytics: data.settings?.gaPropertyId || data.settings?.ymCounterId ? 'connected' : 'not_configured',
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await fetch('/api/crm/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      alert('✅ Настройки сохранены');
      fetchSettings();
    } catch (error) {
      alert('❌ Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const webhookUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/crm/webhook/site`
    : '/api/crm/webhook/site';

  const instagramWebhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/crm/webhook/instagram`
    : '/api/crm/webhook/instagram';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/crm" className="text-white/50 hover:text-white">← CRM</Link>
            <h1 className="text-xl font-bold">🔌 Интеграции</h1>
          </div>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? '⏳' : '💾'} Сохранить
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Status Overview */}
        <div className="grid grid-cols-3 gap-4">
          <StatusCard
            icon="📸"
            title="Instagram"
            status={statuses.instagram}
            description={statuses.instagram === 'connected' ? 'Direct, комментарии, Lead Ads' : 'Не подключен'}
          />
          <StatusCard
            icon="🌐"
            title="Сайт delever.io"
            status={statuses.website}
            description="Webhook активен"
          />
          <StatusCard
            icon="📊"
            title="Аналитика"
            status={statuses.analytics}
            description={statuses.analytics === 'connected' ? 'GA4 / Яндекс.Метрика' : 'Не подключена'}
          />
        </div>

        {/* Website Integration */}
        <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="text-2xl">🌐</span>
            Интеграция с сайтом
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-white/50 text-sm mb-2 block">Webhook URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={webhookUrl}
                  readOnly
                  className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white/70 font-mono text-sm"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    alert('Скопировано!');
                  }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg"
                >
                  📋
                </button>
              </div>
            </div>

            <div className="bg-black/20 rounded-xl p-4">
              <h3 className="text-sm font-medium text-white/70 mb-3">📝 Код для формы на сайте:</h3>
              <pre className="text-xs text-green-400 overflow-x-auto whitespace-pre-wrap">
{`// Вставьте в обработчик формы на delever.io
const submitForm = async (formData) => {
  const response = await fetch('${webhookUrl}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: formData.name,
      company: formData.company,
      phone: formData.phone,
      email: formData.email,
      message: formData.message,
      source: 'delever.io',
      page: window.location.pathname,
      utm: {
        source: new URLSearchParams(window.location.search).get('utm_source'),
        medium: new URLSearchParams(window.location.search).get('utm_medium'),
        campaign: new URLSearchParams(window.location.search).get('utm_campaign'),
      },
    }),
  });
  return response.json();
};`}
              </pre>
            </div>

            <div className="flex items-center gap-2 text-green-400 text-sm">
              <span>✅</span>
              <span>Webhook готов к приёму заявок</span>
            </div>
          </div>
        </section>

        {/* Instagram Integration */}
        <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="text-2xl">📸</span>
            Instagram / Meta
          </h2>

          <div className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm">
              <h3 className="font-medium text-blue-400 mb-2">📋 Как подключить:</h3>
              <ol className="text-white/70 space-y-1 list-decimal list-inside">
                <li>Перейдите в <a href="https://developers.facebook.com" target="_blank" className="text-blue-400 underline">Meta for Developers</a></li>
                <li>Создайте приложение → Business → Instagram</li>
                <li>Добавьте продукт "Webhooks" и "Instagram Basic Display"</li>
                <li>Настройте webhook URL: <code className="bg-black/30 px-1 rounded">{instagramWebhookUrl}</code></li>
                <li>Скопируйте Page Access Token и вставьте ниже</li>
              </ol>
            </div>

            <div>
              <label className="text-white/50 text-sm mb-2 block">Page Access Token</label>
              <input
                type="password"
                value={settings.instagramAccessToken || ''}
                onChange={(e) => setSettings({ ...settings, instagramAccessToken: e.target.value })}
                placeholder="EAAxxxxxxx..."
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/50 text-sm mb-2 block">Facebook Page ID</label>
                <input
                  type="text"
                  value={settings.instagramPageId || ''}
                  onChange={(e) => setSettings({ ...settings, instagramPageId: e.target.value })}
                  placeholder="123456789"
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="text-white/50 text-sm mb-2 block">Instagram Account ID</label>
                <input
                  type="text"
                  value={settings.instagramAccountId || ''}
                  onChange={(e) => setSettings({ ...settings, instagramAccountId: e.target.value })}
                  placeholder="17841400000000"
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-white/50 text-sm mb-2 block">Webhook Verify Token</label>
              <input
                type="text"
                value={settings.instagramVerifyToken || ''}
                onChange={(e) => setSettings({ ...settings, instagramVerifyToken: e.target.value })}
                placeholder="your_verify_token_here"
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
              />
              <p className="text-white/30 text-xs mt-1">Придумайте любую строку, она нужна для верификации webhook</p>
            </div>

            <div>
              <label className="text-white/50 text-sm mb-2 block">Webhook URL для Meta</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={instagramWebhookUrl}
                  readOnly
                  className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white/70 font-mono text-sm"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(instagramWebhookUrl);
                    alert('Скопировано!');
                  }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg"
                >
                  📋
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Analytics */}
        <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="text-2xl">📊</span>
            Аналитика
          </h2>

          <div className="grid grid-cols-2 gap-6">
            {/* Google Analytics */}
            <div className="space-y-4">
              <h3 className="font-medium text-white/80">Google Analytics 4</h3>
              <div>
                <label className="text-white/50 text-sm mb-2 block">Property ID</label>
                <input
                  type="text"
                  value={settings.gaPropertyId || ''}
                  onChange={(e) => setSettings({ ...settings, gaPropertyId: e.target.value })}
                  placeholder="123456789"
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="text-white/50 text-sm mb-2 block">Service Account JSON</label>
                <textarea
                  value={settings.gaCredentials || ''}
                  onChange={(e) => setSettings({ ...settings, gaCredentials: e.target.value })}
                  placeholder='{"type": "service_account", ...}'
                  rows={3}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-mono text-xs"
                />
              </div>
            </div>

            {/* Yandex Metrika */}
            <div className="space-y-4">
              <h3 className="font-medium text-white/80">Яндекс.Метрика</h3>
              <div>
                <label className="text-white/50 text-sm mb-2 block">ID счётчика</label>
                <input
                  type="text"
                  value={settings.ymCounterId || ''}
                  onChange={(e) => setSettings({ ...settings, ymCounterId: e.target.value })}
                  placeholder="12345678"
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="text-white/50 text-sm mb-2 block">OAuth Token</label>
                <input
                  type="password"
                  value={settings.ymOAuthToken || ''}
                  onChange={(e) => setSettings({ ...settings, ymOAuthToken: e.target.value })}
                  placeholder="y0_xxxxxxxx..."
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Back link */}
        <div className="text-center">
          <Link href="/crm/settings" className="text-white/50 hover:text-white">
            ← Назад к настройкам
          </Link>
        </div>
      </main>
    </div>
  );
}

function StatusCard({ icon, title, status, description }: {
  icon: string;
  title: string;
  status: 'connected' | 'active' | 'not_configured' | 'error';
  description: string;
}) {
  const statusColors = {
    connected: 'border-green-500/50 bg-green-500/10',
    active: 'border-green-500/50 bg-green-500/10',
    not_configured: 'border-yellow-500/50 bg-yellow-500/10',
    error: 'border-red-500/50 bg-red-500/10',
  };

  const statusIcons = {
    connected: '✅',
    active: '✅',
    not_configured: '⚠️',
    error: '❌',
  };

  return (
    <div className={`p-4 rounded-xl border ${statusColors[status]}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="font-medium">{title}</span>
        <span className="ml-auto">{statusIcons[status]}</span>
      </div>
      <p className="text-white/50 text-sm">{description}</p>
    </div>
  );
}

