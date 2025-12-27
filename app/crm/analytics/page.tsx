'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SalesMetrics {
  pipeline: {
    new: number;
    contacted: number;
    qualified: number;
    demo_scheduled: number;
    demo_done: number;
    negotiation: number;
    won: number;
    lost: number;
  };
  conversions: {
    contactRate: number;
    qualificationRate: number;
    demoRate: number;
    closeRate: number;
  };
  channels: {
    email: { sent: number; opened: number; replied: number };
    sms: { sent: number; delivered: number; replied: number };
    telegram: { sent: number; delivered: number; replied: number };
  };
  ai: {
    conversationsStarted: number;
    escalated: number;
    autoConverted: number;
  };
  topPerformers: {
    name: string;
    deals: number;
    revenue: number;
  }[];
}

export default function CRMAnalyticsPage() {
  const [metrics, setMetrics] = useState<SalesMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7d');

  useEffect(() => {
    fetchMetrics();
  }, [period]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/crm/analytics?period=${period}`);
      const data = await res.json();
      setMetrics(data);
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/crm" className="text-white/60 hover:text-white transition-colors">
                ← Назад в CRM
              </Link>
              <h1 className="text-2xl font-bold text-white">📈 Аналитика продаж</h1>
            </div>
            
            <div className="flex bg-white/10 rounded-lg p-1">
              {['7d', '30d', '90d'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    period === p ? 'bg-white text-slate-900' : 'text-white/60 hover:text-white'
                  }`}
                >
                  {p === '7d' ? '7 дней' : p === '30d' ? '30 дней' : '90 дней'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
          </div>
        ) : metrics ? (
          <div className="space-y-6">
            {/* Conversion Funnel */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-6">📊 Воронка конверсий</h2>
              
              <div className="flex items-end justify-between gap-4">
                <FunnelStep 
                  label="Новые" 
                  value={metrics.pipeline.new} 
                  maxValue={Math.max(...Object.values(metrics.pipeline))}
                  color="bg-blue-500"
                />
                <FunnelArrow rate={metrics.conversions.contactRate} />
                <FunnelStep 
                  label="Контакт" 
                  value={metrics.pipeline.contacted} 
                  maxValue={Math.max(...Object.values(metrics.pipeline))}
                  color="bg-yellow-500"
                />
                <FunnelArrow rate={metrics.conversions.qualificationRate} />
                <FunnelStep 
                  label="Квалиф." 
                  value={metrics.pipeline.qualified} 
                  maxValue={Math.max(...Object.values(metrics.pipeline))}
                  color="bg-purple-500"
                />
                <FunnelArrow rate={metrics.conversions.demoRate} />
                <FunnelStep 
                  label="Демо" 
                  value={metrics.pipeline.demo_done} 
                  maxValue={Math.max(...Object.values(metrics.pipeline))}
                  color="bg-cyan-500"
                />
                <FunnelArrow rate={metrics.conversions.closeRate} />
                <FunnelStep 
                  label="Закрыто" 
                  value={metrics.pipeline.won} 
                  maxValue={Math.max(...Object.values(metrics.pipeline))}
                  color="bg-green-500"
                />
              </div>
            </div>

            {/* Channel Performance */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ChannelCard
                icon="📧"
                name="Email"
                stats={metrics.channels.email}
              />
              <ChannelCard
                icon="📱"
                name="SMS"
                stats={metrics.channels.sms}
              />
              <ChannelCard
                icon="✈️"
                name="Telegram"
                stats={metrics.channels.telegram}
              />
            </div>

            {/* AI Robot Stats */}
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">🤖 AI-робот</h2>
              
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <div className="text-3xl font-bold text-white">{metrics.ai.conversationsStarted}</div>
                  <div className="text-sm text-white/60">Диалогов запущено</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-yellow-400">{metrics.ai.escalated}</div>
                  <div className="text-sm text-white/60">Эскалировано менеджерам</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-green-400">{metrics.ai.autoConverted}</div>
                  <div className="text-sm text-white/60">Авто-конверсий</div>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">Эффективность AI:</span>
                  <span className="text-purple-400 font-medium">
                    {metrics.ai.conversationsStarted > 0 
                      ? ((metrics.ai.autoConverted / metrics.ai.conversationsStarted) * 100).toFixed(1)
                      : 0}% авто-конверсия
                  </span>
                </div>
              </div>
            </div>

            {/* Win/Lost */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">🏆</span>
                  <div>
                    <div className="text-3xl font-bold text-green-400">{metrics.pipeline.won}</div>
                    <div className="text-sm text-white/60">Выигранных сделок</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">❌</span>
                  <div>
                    <div className="text-3xl font-bold text-red-400">{metrics.pipeline.lost}</div>
                    <div className="text-sm text-white/60">Потерянных сделок</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-white/60 py-12">
            Нет данных для отображения
          </div>
        )}
      </main>
    </div>
  );
}

function FunnelStep({ label, value, maxValue, color }: { 
  label: string; 
  value: number; 
  maxValue: number;
  color: string;
}) {
  const height = maxValue > 0 ? Math.max((value / maxValue) * 200, 40) : 40;
  
  return (
    <div className="flex-1 flex flex-col items-center">
      <div 
        className={`w-full ${color} rounded-t-lg transition-all`}
        style={{ height: `${height}px` }}
      />
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-white/60">{label}</div>
    </div>
  );
}

function FunnelArrow({ rate }: { rate: number }) {
  return (
    <div className="flex flex-col items-center px-2">
      <div className="text-2xl text-white/30">→</div>
      <div className="text-xs text-white/50">{rate.toFixed(0)}%</div>
    </div>
  );
}

function ChannelCard({ icon, name, stats }: { 
  icon: string; 
  name: string;
  stats: { sent: number; opened?: number; delivered?: number; replied: number };
}) {
  const deliveryRate = stats.sent > 0 
    ? ((stats.opened || stats.delivered || 0) / stats.sent * 100).toFixed(0)
    : 0;
  const replyRate = stats.sent > 0 
    ? (stats.replied / stats.sent * 100).toFixed(1)
    : 0;
  
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{icon}</span>
        <span className="text-lg font-bold text-white">{name}</span>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-white/60">Отправлено:</span>
          <span className="text-white font-medium">{stats.sent}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">{stats.opened !== undefined ? 'Открыто' : 'Доставлено'}:</span>
          <span className="text-blue-400 font-medium">
            {stats.opened || stats.delivered || 0} ({deliveryRate}%)
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Ответили:</span>
          <span className="text-green-400 font-medium">{stats.replied} ({replyRate}%)</span>
        </div>
      </div>
    </div>
  );
}

