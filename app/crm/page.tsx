'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Типы
interface Lead {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  telegram: string | null;
  source: string;
  score: number;
  segment: string | null;
  status: string;
  tags: string[];
  lastContactAt: string | null;
  nextActionAt: string | null;
  nextAction: string | null;
  createdAt: string;
  _count?: {
    touches: number;
    aiConversations: number;
  };
}

interface PipelineStats {
  new: number;
  contacted: number;
  qualified: number;
  demo_scheduled: number;
  demo_done: number;
  negotiation: number;
  won: number;
  lost: number;
  nurturing: number;
}

interface DashboardStats {
  totalLeads: number;
  activeLeads: number;
  todayTouches: number;
  conversionRate: number;
  avgScore: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
}

// Цвета статусов
const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  new: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/50' },
  contacted: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50' },
  qualified: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/50' },
  demo_scheduled: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/50' },
  demo_done: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/50' },
  negotiation: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50' },
  won: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50' },
  lost: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50' },
  nurturing: { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/50' },
};

const STATUS_LABELS: Record<string, string> = {
  new: '🆕 Новые',
  contacted: '📞 Контакт',
  qualified: '✅ Квалиф.',
  demo_scheduled: '📅 Демо запл.',
  demo_done: '🎯 Демо сделано',
  negotiation: '💬 Переговоры',
  won: '🏆 Выиграны',
  lost: '❌ Потеряны',
  nurturing: '🌱 Прогрев',
};

const SEGMENT_BADGES: Record<string, { color: string; label: string }> = {
  hot: { color: 'bg-red-500', label: '🔥 Hot' },
  warm: { color: 'bg-orange-500', label: '☀️ Warm' },
  cold: { color: 'bg-blue-500', label: '❄️ Cold' },
  enterprise: { color: 'bg-purple-500', label: '🏢 Enterprise' },
};

export default function CRMDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedSegment, setSelectedSegment] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline');

  // Загрузка данных
  useEffect(() => {
    fetchData();
  }, [selectedStatus, selectedSegment, searchQuery]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Загружаем лиды и статистику параллельно
      const [leadsRes, statsRes] = await Promise.all([
        fetch(`/api/crm/leads?status=${selectedStatus}&segment=${selectedSegment}&search=${searchQuery}`),
        fetch('/api/crm/stats'),
      ]);
      
      const leadsData = await leadsRes.json();
      const statsData = await statsRes.json();
      
      setLeads(leadsData.leads || []);
      setPipelineStats(statsData.pipeline || null);
      setDashboardStats(statsData.dashboard || null);
    } catch (error) {
      console.error('Error fetching CRM data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Обновить статус лида
  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    try {
      await fetch(`/api/crm/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      
      fetchData();
    } catch (error) {
      console.error('Error updating lead:', error);
    }
  };

  // Запустить AI-робота на лида
  const startAIRobot = async (leadId: string) => {
    try {
      await fetch('/api/crm/ai/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });
      
      alert('🤖 AI-робот запущен!');
      fetchData();
    } catch (error) {
      console.error('Error starting AI robot:', error);
    }
  };

  // Группировка лидов по статусу для Kanban
  const leadsByStatus = leads.reduce((acc, lead) => {
    const status = lead.status || 'new';
    if (!acc[status]) acc[status] = [];
    acc[status].push(lead);
    return acc;
  }, {} as Record<string, Lead[]>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-white/10">
        <div className="max-w-[1800px] mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-2xl font-bold text-white">
                🚀 Delever.io CRM
              </Link>
              <span className="px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-xs text-white font-medium">
                AI Sales Machine
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Поиск */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Поиск лидов..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-purple-500"
                />
              </div>
              
              {/* Переключатель вида */}
              <div className="flex bg-white/10 rounded-lg p-1">
                <button
                  onClick={() => setView('pipeline')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    view === 'pipeline' 
                      ? 'bg-purple-500 text-white' 
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  📊 Воронка
                </button>
                <button
                  onClick={() => setView('list')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    view === 'list' 
                      ? 'bg-purple-500 text-white' 
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  📋 Список
                </button>
              </div>
              
              {/* Кнопка импорта */}
              <Link 
                href="/crm/import"
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-medium transition-all"
              >
                📥 Импорт
              </Link>
              
              {/* Кнопка AI Рассылки */}
              <Link 
                href="/crm/campaigns"
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg text-white text-sm font-medium transition-all"
              >
                🤖 AI Рассылка
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        {/* Статистика */}
        {dashboardStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
            <StatCard label="Всего лидов" value={dashboardStats.totalLeads} icon="📊" />
            <StatCard label="Активных" value={dashboardStats.activeLeads} icon="🎯" color="text-green-400" />
            <StatCard label="🔥 Hot" value={dashboardStats.hotLeads} icon="" color="text-red-400" />
            <StatCard label="☀️ Warm" value={dashboardStats.warmLeads} icon="" color="text-orange-400" />
            <StatCard label="❄️ Cold" value={dashboardStats.coldLeads} icon="" color="text-blue-400" />
            <StatCard label="Касаний сегодня" value={dashboardStats.todayTouches} icon="📞" />
            <StatCard label="Ср. скоринг" value={Math.round(dashboardStats.avgScore)} icon="⭐" />
            <StatCard label="Конверсия" value={`${dashboardStats.conversionRate.toFixed(1)}%`} icon="📈" color="text-purple-400" />
          </div>
        )}

        {/* Фильтры */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedStatus('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              selectedStatus === 'all' 
                ? 'bg-white text-slate-900' 
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            Все статусы
          </button>
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                selectedStatus === status 
                  ? STATUS_COLORS[status].bg + ' ' + STATUS_COLORS[status].text
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {label} {pipelineStats && pipelineStats[status as keyof PipelineStats] > 0 && (
                <span className="ml-1 text-xs">({pipelineStats[status as keyof PipelineStats]})</span>
              )}
            </button>
          ))}
        </div>

        {/* Контент */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
          </div>
        ) : view === 'pipeline' ? (
          /* Kanban View */
          <div className="flex gap-4 overflow-x-auto pb-4">
            {Object.entries(STATUS_LABELS).slice(0, 7).map(([status, label]) => (
              <div key={status} className="flex-shrink-0 w-80">
                <div className={`mb-3 px-4 py-2 rounded-lg ${STATUS_COLORS[status].bg} border ${STATUS_COLORS[status].border}`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${STATUS_COLORS[status].text}`}>{label}</span>
                    <span className={`text-sm ${STATUS_COLORS[status].text}`}>
                      {leadsByStatus[status]?.length || 0}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto">
                  {(leadsByStatus[status] || []).map((lead) => (
                    <LeadCard 
                      key={lead.id} 
                      lead={lead} 
                      onSelect={() => setSelectedLead(lead)}
                      onStartAI={() => startAIRobot(lead.id)}
                    />
                  ))}
                  
                  {(!leadsByStatus[status] || leadsByStatus[status].length === 0) && (
                    <div className="p-4 text-center text-white/30 border border-dashed border-white/10 rounded-lg">
                      Нет лидов
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-white/60 text-sm font-medium">Лид</th>
                  <th className="px-4 py-3 text-left text-white/60 text-sm font-medium">Компания</th>
                  <th className="px-4 py-3 text-left text-white/60 text-sm font-medium">Контакты</th>
                  <th className="px-4 py-3 text-left text-white/60 text-sm font-medium">Сегмент</th>
                  <th className="px-4 py-3 text-left text-white/60 text-sm font-medium">Скоринг</th>
                  <th className="px-4 py-3 text-left text-white/60 text-sm font-medium">Статус</th>
                  <th className="px-4 py-3 text-left text-white/60 text-sm font-medium">Касания</th>
                  <th className="px-4 py-3 text-left text-white/60 text-sm font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr 
                    key={lead.id} 
                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-all"
                    onClick={() => setSelectedLead(lead)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">
                        {lead.name || lead.firstName || 'Без имени'}
                      </div>
                      <div className="text-sm text-white/50">
                        {lead.source}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/80">
                      {lead.company || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-white/80">{lead.phone || '-'}</div>
                      <div className="text-sm text-white/50">{lead.email || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      {lead.segment && SEGMENT_BADGES[lead.segment] && (
                        <span className={`px-2 py-1 rounded text-xs text-white ${SEGMENT_BADGES[lead.segment].color}`}>
                          {SEGMENT_BADGES[lead.segment].label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              lead.score >= 70 ? 'bg-green-500' :
                              lead.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${lead.score}%` }}
                          />
                        </div>
                        <span className="text-sm text-white/60">{lead.score}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[lead.status]?.bg} ${STATUS_COLORS[lead.status]?.text}`}>
                        {STATUS_LABELS[lead.status] || lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/60 text-sm">
                      {lead._count?.touches || 0}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startAIRobot(lead.id);
                        }}
                        className="px-3 py-1 bg-purple-500/20 hover:bg-purple-500/40 text-purple-400 rounded text-sm transition-all"
                      >
                        🤖 AI
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <LeadDetailModal 
          lead={selectedLead} 
          onClose={() => setSelectedLead(null)}
          onUpdateStatus={updateLeadStatus}
          onStartAI={startAIRobot}
        />
      )}
    </div>
  );
}

// Компонент статистики
function StatCard({ label, value, icon, color = 'text-white' }: { 
  label: string; 
  value: string | number; 
  icon: string;
  color?: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-sm text-white/50">{label}</div>
    </div>
  );
}

// Карточка лида для Kanban
function LeadCard({ lead, onSelect, onStartAI }: { 
  lead: Lead; 
  onSelect: () => void;
  onStartAI: () => void;
}) {
  return (
    <div 
      onClick={onSelect}
      className="bg-white/5 border border-white/10 rounded-lg p-4 cursor-pointer hover:bg-white/10 transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="font-medium text-white truncate">
          {lead.name || lead.firstName || 'Без имени'}
        </div>
        {lead.segment && SEGMENT_BADGES[lead.segment] && (
          <span className={`px-2 py-0.5 rounded text-xs text-white ${SEGMENT_BADGES[lead.segment].color} flex-shrink-0`}>
            {SEGMENT_BADGES[lead.segment].label}
          </span>
        )}
      </div>
      
      {lead.company && (
        <div className="text-sm text-white/60 mb-2 truncate">
          🏢 {lead.company}
        </div>
      )}
      
      <div className="flex items-center gap-2 mb-3">
        {lead.phone && <span className="text-xs text-white/50">📱</span>}
        {lead.email && <span className="text-xs text-white/50">📧</span>}
        {lead.telegram && <span className="text-xs text-white/50">✈️</span>}
        
        <div className="flex-1" />
        
        <div className="flex items-center gap-1">
          <div className="w-12 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full ${
                lead.score >= 70 ? 'bg-green-500' :
                lead.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${lead.score}%` }}
            />
          </div>
          <span className="text-xs text-white/50">{lead.score}</span>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {lead.tags.slice(0, 2).map((tag, i) => (
            <span key={i} className="px-2 py-0.5 bg-white/10 rounded text-xs text-white/60">
              {tag}
            </span>
          ))}
        </div>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStartAI();
          }}
          className="opacity-0 group-hover:opacity-100 px-2 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded text-xs transition-all"
        >
          🤖 AI
        </button>
      </div>
    </div>
  );
}

// Модальное окно детали лида
function LeadDetailModal({ lead, onClose, onUpdateStatus, onStartAI }: {
  lead: Lead;
  onClose: () => void;
  onUpdateStatus: (leadId: string, status: string) => void;
  onStartAI: (leadId: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-slate-800 rounded-2xl border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-white/10 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {lead.name || lead.firstName || 'Без имени'}
              </h2>
              {lead.company && (
                <p className="text-white/60 mt-1">🏢 {lead.company}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-all"
            >
              <span className="text-white/60 text-xl">✕</span>
            </button>
          </div>
          
          {/* Quick Actions */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => onStartAI(lead.id)}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all"
            >
              🤖 Запустить AI-робота
            </button>
            {lead.phone && (
              <a 
                href={`tel:${lead.phone}`}
                className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg font-medium hover:bg-green-500/30 transition-all"
              >
                📞 Позвонить
              </a>
            )}
            {lead.email && (
              <a 
                href={`mailto:${lead.email}`}
                className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg font-medium hover:bg-blue-500/30 transition-all"
              >
                📧 Email
              </a>
            )}
            {lead.telegram && (
              <a 
                href={`https://t.me/${lead.telegram.replace('@', '')}`}
                target="_blank"
                className="px-4 py-2 bg-sky-500/20 text-sky-400 rounded-lg font-medium hover:bg-sky-500/30 transition-all"
              >
                ✈️ Telegram
              </a>
            )}
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <InfoItem label="Телефон" value={lead.phone} />
            <InfoItem label="Email" value={lead.email} />
            <InfoItem label="Telegram" value={lead.telegram} />
            <InfoItem label="Источник" value={lead.source} />
            <InfoItem label="Сегмент" value={lead.segment} />
            <InfoItem label="Скоринг" value={`${lead.score}/100`} />
          </div>
          
          {/* Status Change */}
          <div>
            <label className="block text-white/60 text-sm mb-2">Статус</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_LABELS).map(([status, label]) => (
                <button
                  key={status}
                  onClick={() => onUpdateStatus(lead.id, status)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    lead.status === status 
                      ? STATUS_COLORS[status].bg + ' ' + STATUS_COLORS[status].text + ' ' + 'border ' + STATUS_COLORS[status].border
                      : 'bg-white/5 text-white/60 hover:bg-white/10 border border-transparent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Tags */}
          {lead.tags.length > 0 && (
            <div>
              <label className="block text-white/60 text-sm mb-2">Теги</label>
              <div className="flex flex-wrap gap-2">
                {lead.tags.map((tag, i) => (
                  <span key={i} className="px-3 py-1 bg-white/10 rounded-lg text-sm text-white/80">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
            <InfoItem 
              label="Создан" 
              value={new Date(lead.createdAt).toLocaleDateString('ru-RU')} 
            />
            <InfoItem 
              label="Последний контакт" 
              value={lead.lastContactAt ? new Date(lead.lastContactAt).toLocaleDateString('ru-RU') : 'Нет'} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-white/50 text-sm">{label}</div>
      <div className="text-white font-medium">{value || '-'}</div>
    </div>
  );
}

