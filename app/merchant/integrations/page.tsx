'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface IntegrationProvider {
  type: string;
  provider: string;
  name: string;
  description: string;
  logo?: string;
  docsUrl?: string;
  supportedEvents: string[];
  configSchema: any[];
}

interface IntegrationConnection {
  id: string;
  integrationId: string;
  restaurantId: string;
  status: string;
  lastSyncAt?: string;
  integration: {
    type: string;
    provider: string;
    name: string;
    logo?: string;
  };
}

export default function IntegrationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const restaurantId = searchParams.get('restaurantId');

  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [groups, setGroups] = useState<Record<string, { name: string; description: string }>>({});
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<IntegrationProvider | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/merchant/integrations');
    }
  }, [status, router]);

  useEffect(() => {
    fetchProviders();
    if (restaurantId) {
      fetchConnections();
    }
  }, [restaurantId]);

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/integrations');
      const data = await res.json();
      setProviders(data.providers || []);
      setGroups(data.groups || {});
    } catch (error) {
      console.error('Error fetching providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConnections = async () => {
    try {
      const res = await fetch(`/api/integrations?restaurantId=${restaurantId}`);
      const data = await res.json();
      setConnections(data.connections || []);
    } catch (error) {
      console.error('Error fetching connections:', error);
    }
  };

  const connectIntegration = async () => {
    if (!selectedProvider || !restaurantId) return;
    setSaving(true);

    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          type: selectedProvider.type,
          provider: selectedProvider.provider,
          credentials: formData,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(`✅ Интеграция подключена!\n\nWebhook URL:\n${data.webhookUrl}`);
        setSelectedProvider(null);
        setFormData({});
        fetchConnections();
      } else {
        alert(`❌ Ошибка: ${data.error}`);
      }
    } catch (error) {
      alert('❌ Ошибка подключения');
    } finally {
      setSaving(false);
    }
  };

  const disconnectIntegration = async (connectionId: string) => {
    if (!confirm('Отключить интеграцию?')) return;

    try {
      await fetch(`/api/integrations?connectionId=${connectionId}`, {
        method: 'DELETE',
      });
      fetchConnections();
    } catch (error) {
      alert('❌ Ошибка отключения');
    }
  };

  const activateIntegration = async (connectionId: string) => {
    try {
      await fetch('/api/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, status: 'active' }),
      });
      fetchConnections();
    } catch (error) {
      alert('❌ Ошибка активации');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">⏳ Загрузка...</div>
      </div>
    );
  }

  // Группировка провайдеров
  const groupedProviders = Object.entries(groups).map(([type, info]) => ({
    type,
    ...info,
    providers: providers.filter((p) => p.type === type),
  }));

  // Проверка, подключён ли провайдер
  const isConnected = (provider: string) =>
    connections.some((c) => c.integration.provider === provider);

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Шапка */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/merchant" className="text-white/60 hover:text-white">
              ← Назад
            </Link>
            <h1 className="text-xl font-bold text-white">🔌 Интеграции</h1>
          </div>
          {!restaurantId && (
            <div className="text-yellow-400 text-sm">
              ⚠️ Выберите ресторан в кабинете для настройки интеграций
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Подключённые интеграции */}
        {connections.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-white mb-4">✅ Подключённые интеграции</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className="bg-slate-800 rounded-xl p-4 border border-slate-700"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center text-xl">
                      {conn.integration.type === 'pos' && '🖥️'}
                      {conn.integration.type === 'payment' && '💳'}
                      {conn.integration.type === 'delivery' && '🚗'}
                      {conn.integration.type === 'fiscal' && '🧾'}
                      {conn.integration.type === 'marketing' && '📢'}
                    </div>
                    <div>
                      <h3 className="text-white font-medium">{conn.integration.name}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          conn.status === 'active'
                            ? 'bg-green-500/20 text-green-300'
                            : conn.status === 'error'
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-yellow-500/20 text-yellow-300'
                        }`}
                      >
                        {conn.status === 'active' ? 'Активно' : conn.status === 'error' ? 'Ошибка' : 'Ожидает'}
                      </span>
                    </div>
                  </div>

                  {conn.lastSyncAt && (
                    <p className="text-white/40 text-xs mb-3">
                      Последняя синхронизация: {new Date(conn.lastSyncAt).toLocaleString('ru-RU')}
                    </p>
                  )}

                  <div className="flex gap-2">
                    {conn.status === 'pending' && (
                      <button
                        onClick={() => activateIntegration(conn.id)}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg"
                      >
                        Активировать
                      </button>
                    )}
                    <button
                      onClick={() => disconnectIntegration(conn.id)}
                      className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm rounded-lg"
                    >
                      Отключить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Доступные интеграции */}
        <h2 className="text-lg font-bold text-white mb-4">🔌 Доступные интеграции</h2>

        {groupedProviders.map((group) => (
          <div key={group.type} className="mb-8">
            <h3 className="text-white font-medium mb-2">{group.name}</h3>
            <p className="text-white/40 text-sm mb-4">{group.description}</p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.providers.map((provider) => {
                const connected = isConnected(provider.provider);

                return (
                  <div
                    key={provider.provider}
                    className={`bg-slate-800 rounded-xl p-4 border transition ${
                      connected
                        ? 'border-green-500/50 opacity-60'
                        : 'border-slate-700 hover:border-purple-500/50 cursor-pointer'
                    }`}
                    onClick={() => !connected && restaurantId && setSelectedProvider(provider)}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center">
                        {provider.logo ? (
                          <img src={provider.logo} alt="" className="w-8 h-8" />
                        ) : (
                          <span className="text-2xl">
                            {provider.type === 'pos' && '🖥️'}
                            {provider.type === 'payment' && '💳'}
                            {provider.type === 'delivery' && '🚗'}
                            {provider.type === 'fiscal' && '🧾'}
                            {provider.type === 'marketing' && '📢'}
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="text-white font-medium">{provider.name}</h4>
                        {connected && (
                          <span className="text-green-400 text-xs">✓ Подключено</span>
                        )}
                      </div>
                    </div>
                    <p className="text-white/60 text-sm">{provider.description}</p>
                    {provider.docsUrl && (
                      <a
                        href={provider.docsUrl}
                        target="_blank"
                        className="text-purple-400 text-xs hover:underline mt-2 inline-block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        📄 Документация
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </main>

      {/* Модальное окно настройки */}
      {selectedProvider && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-xl font-bold text-white">
                Подключение {selectedProvider.name}
              </h2>
              <p className="text-white/60 text-sm mt-1">{selectedProvider.description}</p>
            </div>

            <div className="p-6 space-y-4">
              {selectedProvider.configSchema.map((field) => (
                <div key={field.key}>
                  <label className="block text-white/80 text-sm font-medium mb-2">
                    {field.label} {field.required && <span className="text-red-400">*</span>}
                  </label>
                  {field.type === 'boolean' ? (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData[field.key] === 'true'}
                        onChange={(e) =>
                          setFormData({ ...formData, [field.key]: e.target.checked.toString() })
                        }
                        className="w-5 h-5 rounded"
                      />
                      <span className="text-white/60 text-sm">{field.description}</span>
                    </label>
                  ) : (
                    <input
                      type={field.type === 'password' ? 'password' : 'text'}
                      value={formData[field.key] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-white/40"
                      required={field.required}
                    />
                  )}
                  {field.description && field.type !== 'boolean' && (
                    <p className="text-white/40 text-xs mt-1">{field.description}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setSelectedProvider(null);
                  setFormData({});
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={connectIntegration}
                disabled={saving}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50"
              >
                {saving ? 'Подключение...' : 'Подключить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

