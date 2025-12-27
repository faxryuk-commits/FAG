'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Lead {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  phone: string | null;
  phoneType: string | null;
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
  _count?: { touches: number; aiConversations: number };
}

interface PipelineStats {
  new: number;
  contacted: number;
  qualified: number;
  demo_scheduled: number;
  negotiation: number;
  won: number;
  lost: number;
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

interface TelegramStats {
  totalMobile: number;
  withTelegram: number;
  telegramCoverage: string;
}

const PIPELINE = [
  { id: 'new', label: 'Новые', icon: '🆕', color: 'from-blue-500 to-cyan-500', action: 'Написать первое сообщение' },
  { id: 'contacted', label: 'Контакт', icon: '💬', color: 'from-yellow-500 to-orange-500', action: 'Дождаться ответа' },
  { id: 'qualified', label: 'Квалиф.', icon: '✅', color: 'from-purple-500 to-pink-500', action: 'Назначить демо' },
  { id: 'demo_scheduled', label: 'Демо', icon: '📅', color: 'from-indigo-500 to-purple-500', action: 'Провести демо' },
  { id: 'negotiation', label: 'Переговоры', icon: '🤝', color: 'from-orange-500 to-red-500', action: 'Закрыть сделку' },
  { id: 'won', label: 'Закрыты', icon: '🏆', color: 'from-green-500 to-emerald-500', action: 'Онбординг' },
];

const SEGMENTS = {
  hot: { icon: '🔥', label: 'Hot', bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50' },
  warm: { icon: '☀️', label: 'Warm', bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50' },
  cold: { icon: '❄️', label: 'Cold', bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/50' },
  enterprise: { icon: '🏢', label: 'Enterprise', bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/50' },
};

export default function CRMDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [telegramStats, setTelegramStats] = useState<TelegramStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalLeads, setTotalLeads] = useState(0);
  const [aiModal, setAiModal] = useState<{ open: boolean; lead: Lead | null; loading: boolean; result: any }>({
    open: false, lead: null, loading: false, result: null
  });
  
  // Пагинация и вид
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    fetchData();
  }, [searchQuery, currentPage, statusFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;
      const [leadsRes, statsRes, tgRes] = await Promise.all([
        fetch(`/api/crm/leads?search=${searchQuery}&status=${statusFilter}&limit=${ITEMS_PER_PAGE}&offset=${offset}`),
        fetch('/api/crm/stats'),
        fetch('/api/crm/telegram/check-contacts'),
      ]);
      
      const leadsData = await leadsRes.json();
      const statsData = await statsRes.json();
      const tgData = await tgRes.json().catch(() => null);
      
      setLeads(leadsData.leads || []);
      setTotalLeads(leadsData.total || 0);
      setPipelineStats(statsData.pipeline || null);
      setDashboardStats(statsData.dashboard || null);
      setTelegramStats(tgData);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const totalPages = Math.ceil(totalLeads / ITEMS_PER_PAGE);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const startAI = async (lead: Lead) => {
    setAiModal({ open: true, lead, loading: true, result: null });
    try {
      const res = await fetch('/api/crm/ai/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, channel: lead.telegram ? 'telegram' : 'sms' }),
      });
      const data = await res.json();
      setAiModal(prev => ({ ...prev, loading: false, result: data }));
      if (data.success) fetchData();
    } catch {
      setAiModal(prev => ({ ...prev, loading: false, result: { error: 'Ошибка сети' } }));
    }
  };

  const updateStatus = async (leadId: string, status: string) => {
    await fetch(`/api/crm/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchData();
    setSelectedLead(null);
  };
  
  // Отправка сообщения из AI модалки
  const [sending, setSending] = useState(false);
  
  const sendAIMessage = async () => {
    if (!aiModal.lead || !aiModal.result?.message) return;
    
    setSending(true);
    try {
      const channel = aiModal.lead.telegram ? 'telegram' : 'sms';
      const res = await fetch('/api/crm/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: aiModal.lead.id,
          channel,
          message: aiModal.result.message,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        alert('✅ Сообщение отправлено!');
        setAiModal({ open: false, lead: null, loading: false, result: null });
        fetchData();
      } else {
        alert(`❌ Ошибка: ${data.error || 'Не удалось отправить'}`);
      }
    } catch (e) {
      alert('❌ Ошибка сети');
    } finally {
      setSending(false);
    }
  };

  // Группируем лиды по статусу
  const leadsByStatus = leads.reduce((acc, lead) => {
    const status = lead.status || 'new';
    if (!acc[status]) acc[status] = [];
    acc[status].push(lead);
    return acc;
  }, {} as Record<string, Lead[]>);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-purple-500/25 group-hover:shadow-purple-500/40 transition-all">
                  D
                </div>
                <div>
                  <div className="text-white font-bold text-lg">Delever CRM</div>
                  <div className="text-white/40 text-xs">AI Sales Platform</div>
                </div>
              </Link>
            </div>
            
            {/* Search */}
            <div className="flex-1 max-w-md mx-8">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Поиск по лидам..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2.5 pl-10 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30">🔍</span>
              </div>
            </div>
            
            {/* Nav */}
            <div className="flex items-center gap-2">
              <NavButton href="/crm/monitor" icon="📡" label="Монитор" pulse />
              <NavButton href="/crm/campaigns" icon="🚀" label="Рассылки" gradient />
              <NavButton href="/crm/telegram-finder" icon="✈️" label="TG Finder" />
              <NavButton href="/crm/import" icon="📥" label="Импорт" />
              <NavButton href="/crm/settings" icon="⚙️" label="Настройки" />
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-[1920px] mx-auto px-6 py-6">
        {/* Stats Row */}
        {dashboardStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
            <StatCard icon="📊" value={dashboardStats.totalLeads} label="Всего" />
            <StatCard icon="🎯" value={dashboardStats.activeLeads} label="Активных" color="green" />
            <StatCard icon="🔥" value={dashboardStats.hotLeads} label="Hot" color="red" />
            <StatCard icon="☀️" value={dashboardStats.warmLeads} label="Warm" color="orange" />
            <StatCard icon="❄️" value={dashboardStats.coldLeads} label="Cold" color="blue" />
            <StatCard 
              icon="✈️" 
              value={telegramStats?.withTelegram || 0} 
              label="Telegram" 
              color="sky"
              href="/crm/telegram-finder"
            />
            <StatCard icon="⭐" value={Math.round(dashboardStats.avgScore)} label="Ср.балл" />
            <StatCard icon="📈" value={`${dashboardStats.conversionRate.toFixed(1)}%`} label="Конверсия" color="purple" />
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            {/* Вид */}
            <div className="flex bg-white/5 rounded-lg p-1">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded text-sm transition-all ${viewMode === 'table' ? 'bg-purple-500 text-white' : 'text-white/50 hover:text-white'}`}
              >
                📋 Таблица
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 rounded text-sm transition-all ${viewMode === 'kanban' ? 'bg-purple-500 text-white' : 'text-white/50 hover:text-white'}`}
              >
                📊 Канбан
              </button>
            </div>
            
            {/* Фильтр по статусу */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
            >
              <option value="all">Все статусы</option>
              {PIPELINE.map(s => (
                <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
              ))}
            </select>
            
            <span className="text-white/50 text-sm">
              {totalLeads} лидов
            </span>
          </div>
          
          {/* Пагинация */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded text-white/70 text-sm disabled:opacity-30"
              >
                ←
              </button>
              
              {/* Номера страниц */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page;
                if (totalPages <= 5) {
                  page = i + 1;
                } else if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = currentPage - 2 + i;
                }
                return (
                  <button
                    key={page}
                    onClick={() => goToPage(page)}
                    className={`px-3 py-1.5 rounded text-sm transition-all ${
                      currentPage === page 
                        ? 'bg-purple-500 text-white' 
                        : 'bg-white/5 hover:bg-white/10 text-white/70'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded text-white/70 text-sm disabled:opacity-30"
              >
                →
              </button>
              
              <span className="text-white/40 text-xs ml-2">
                {currentPage} / {totalPages}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : viewMode === 'table' ? (
          /* Табличный вид */
          <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-4 py-3 text-left text-white/50 text-xs font-medium">Компания</th>
                  <th className="px-4 py-3 text-left text-white/50 text-xs font-medium">Контакт</th>
                  <th className="px-4 py-3 text-left text-white/50 text-xs font-medium">Телефон</th>
                  <th className="px-4 py-3 text-left text-white/50 text-xs font-medium">Telegram</th>
                  <th className="px-4 py-3 text-left text-white/50 text-xs font-medium">Сегмент</th>
                  <th className="px-4 py-3 text-left text-white/50 text-xs font-medium">Скор</th>
                  <th className="px-4 py-3 text-left text-white/50 text-xs font-medium">Статус</th>
                  <th className="px-4 py-3 text-left text-white/50 text-xs font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, idx) => {
                  const segment = lead.segment ? SEGMENTS[lead.segment as keyof typeof SEGMENTS] : null;
                  const stage = PIPELINE.find(p => p.id === lead.status);
                  return (
                    <tr 
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className={`border-b border-white/5 hover:bg-white/[0.03] cursor-pointer transition-colors ${idx % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
                    >
                      <td className="px-4 py-3">
                        <div className="text-white font-medium text-sm truncate max-w-[200px]">
                          {lead.company || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-white/70 text-sm truncate max-w-[150px]">
                          {lead.name || lead.firstName || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-sm">
                          <span className={lead.phoneType === 'mobile' ? 'text-green-400' : 'text-white/40'}>
                            {lead.phoneType === 'mobile' ? '📱' : '☎️'}
                          </span>
                          <span className="text-white/60">{lead.phone || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {lead.telegram ? (
                          <span className="text-sky-400 text-sm">{lead.telegram}</span>
                        ) : (
                          <span className="text-white/30 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {segment ? (
                          <span className={`px-2 py-0.5 rounded text-xs ${segment.bg} ${segment.text}`}>
                            {segment.icon}
                          </span>
                        ) : <span className="text-white/30">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <div className="w-8 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${lead.score >= 70 ? 'bg-green-500' : lead.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${lead.score}%` }}
                            />
                          </div>
                          <span className="text-white/50 text-xs">{lead.score}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {stage && (
                          <span className={`px-2 py-1 rounded text-xs bg-gradient-to-r ${stage.color} text-white`}>
                            {stage.icon}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); startAI(lead); }}
                          className="px-2 py-1 bg-purple-500/20 hover:bg-purple-500/40 text-purple-400 rounded text-xs transition-all"
                        >
                          🤖
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {leads.length === 0 && (
              <div className="text-center py-12 text-white/30">
                Нет лидов
              </div>
            )}
          </div>
        ) : (
          /* Канбан вид */
          <div className="grid grid-cols-6 gap-4">
            {PIPELINE.map((stage) => {
              const stageLeads = leadsByStatus[stage.id] || [];
              const count = pipelineStats?.[stage.id as keyof PipelineStats] || stageLeads.length;
              
              return (
                <div key={stage.id} className="flex flex-col">
                  <div className={`mb-3 p-3 rounded-xl bg-gradient-to-r ${stage.color} bg-opacity-20`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{stage.icon}</span>
                        <span className="text-white font-medium text-sm">{stage.label}</span>
                      </div>
                      <span className="px-2 py-0.5 bg-black/20 rounded-full text-white text-xs font-medium">
                        {count}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-2 min-h-[200px] max-h-[calc(100vh-380px)] overflow-y-auto pr-1">
                    {stageLeads.length === 0 ? (
                      <div className="h-24 border border-dashed border-white/10 rounded-xl flex items-center justify-center text-white/20 text-sm">
                        Пусто
                      </div>
                    ) : (
                      stageLeads.slice(0, 30).map((lead) => (
                        <LeadCard 
                          key={lead.id}
                          lead={lead}
                          onClick={() => setSelectedLead(lead)}
                          onAI={() => startAI(lead)}
                        />
                      ))
                    )}
                    {stageLeads.length > 30 && (
                      <div className="text-center text-white/30 text-xs py-2">
                        +{stageLeads.length - 30} ещё
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Lead Detail Drawer */}
      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStatusChange={updateStatus}
          onStartAI={startAI}
        />
      )}

      {/* AI Modal */}
      {aiModal.open && (
        <AIModal
          lead={aiModal.lead}
          loading={aiModal.loading}
          result={aiModal.result}
          onClose={() => setAiModal({ open: false, lead: null, loading: false, result: null })}
        />
      )}
    </div>
  );
}

// Navigation Button
function NavButton({ href, icon, label, pulse, gradient }: { 
  href: string; 
  icon: string; 
  label: string; 
  pulse?: boolean;
  gradient?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
        gradient 
          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/25'
          : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
      }`}
    >
      {pulse && <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />}
      <span>{icon}</span>
      <span className="hidden lg:inline">{label}</span>
    </Link>
  );
}

// Stat Card
function StatCard({ icon, value, label, color, href }: { 
  icon: string; 
  value: string | number; 
  label: string; 
  color?: string;
  href?: string;
}) {
  const colorClasses = {
    green: 'text-green-400',
    red: 'text-red-400',
    orange: 'text-orange-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    sky: 'text-sky-400',
  };
  
  const content = (
    <div className={`bg-white/[0.03] border border-white/5 rounded-xl p-3 hover:bg-white/[0.05] transition-all group ${href ? 'cursor-pointer' : ''}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg group-hover:scale-110 transition-transform">{icon}</span>
        <span className={`text-xl font-bold ${color ? colorClasses[color as keyof typeof colorClasses] : 'text-white'}`}>
          {value}
        </span>
      </div>
      <div className="text-white/40 text-xs">{label}</div>
    </div>
  );
  
  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

// Lead Card
function LeadCard({ lead, onClick, onAI }: { 
  lead: Lead; 
  onClick: () => void;
  onAI: () => void;
}) {
  const segment = lead.segment ? SEGMENTS[lead.segment as keyof typeof SEGMENTS] : null;
  
  return (
    <div 
      onClick={onClick}
      className="bg-white/[0.03] border border-white/5 rounded-xl p-3 cursor-pointer hover:bg-white/[0.06] hover:border-white/10 transition-all group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-white font-medium text-sm truncate">
            {lead.company || lead.name || 'Без названия'}
          </div>
          {lead.company && lead.name && (
            <div className="text-white/40 text-xs truncate">{lead.name}</div>
          )}
        </div>
        {segment && (
          <span className={`px-1.5 py-0.5 rounded text-[10px] ${segment.bg} ${segment.text} flex-shrink-0 ml-2`}>
            {segment.icon}
          </span>
        )}
      </div>
      
      {/* Score */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${
              lead.score >= 70 ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
              lead.score >= 40 ? 'bg-gradient-to-r from-yellow-500 to-orange-400' :
              'bg-gradient-to-r from-red-500 to-pink-400'
            }`}
            style={{ width: `${lead.score}%` }}
          />
        </div>
        <span className="text-white/40 text-xs">{lead.score}</span>
      </div>
      
      {/* Contacts */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {lead.phone && (
            <span className={`text-xs ${lead.phoneType === 'mobile' ? 'text-green-400/70' : 'text-white/30'}`}>
              {lead.phoneType === 'mobile' ? '📱' : '☎️'}
            </span>
          )}
          {lead.telegram && <span className="text-xs text-sky-400/70">✈️</span>}
          {lead.email && <span className="text-xs text-white/30">📧</span>}
        </div>
        
        <button
          onClick={(e) => { e.stopPropagation(); onAI(); }}
          className="opacity-0 group-hover:opacity-100 px-2 py-1 bg-purple-500/20 hover:bg-purple-500/40 text-purple-400 rounded text-xs transition-all"
        >
          🤖
        </button>
      </div>
    </div>
  );
}

// Lead Drawer
function LeadDrawer({ lead, onClose, onStatusChange, onStartAI }: {
  lead: Lead;
  onClose: () => void;
  onStatusChange: (leadId: string, status: string) => void;
  onStartAI: (lead: Lead) => void;
}) {
  const segment = lead.segment ? SEGMENTS[lead.segment as keyof typeof SEGMENTS] : null;
  
  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-[#12121a] border-l border-white/10 z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#12121a]/95 backdrop-blur border-b border-white/10 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">
                {lead.company || lead.name || 'Без названия'}
              </h2>
              {lead.company && lead.name && (
                <p className="text-white/50">{lead.name}</p>
              )}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-all">
              <span className="text-white/50 text-xl">✕</span>
            </button>
          </div>
          
          {/* Quick Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => onStartAI(lead)}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-purple-500/25 transition-all"
            >
              🤖 AI Робот
            </button>
            {lead.phone && (
              <a href={`tel:${lead.phone}`} className="px-4 py-2.5 bg-green-500/20 text-green-400 rounded-xl hover:bg-green-500/30 transition-all">
                📞
              </a>
            )}
            {lead.telegram && (
              <a href={`https://t.me/${lead.telegram.replace('@', '')}`} target="_blank" className="px-4 py-2.5 bg-sky-500/20 text-sky-400 rounded-xl hover:bg-sky-500/30 transition-all">
                ✈️
              </a>
            )}
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Segment & Score */}
          <div className="flex items-center gap-4">
            {segment && (
              <div className={`px-3 py-1.5 rounded-lg border ${segment.bg} ${segment.text} ${segment.border}`}>
                {segment.icon} {segment.label}
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${
                    lead.score >= 70 ? 'bg-green-500' : lead.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${lead.score}%` }}
                />
              </div>
              <span className="text-white/60 text-sm">{lead.score}/100</span>
            </div>
          </div>
          
          {/* Info */}
          <div className="grid grid-cols-2 gap-4">
            <InfoBlock label="Телефон" value={lead.phone} icon={lead.phoneType === 'mobile' ? '📱' : '☎️'} />
            <InfoBlock label="Email" value={lead.email} icon="📧" />
            <InfoBlock label="Telegram" value={lead.telegram} icon="✈️" />
            <InfoBlock label="Источник" value={lead.source} icon="📍" />
          </div>
          
          {/* Status */}
          <div>
            <label className="text-white/50 text-sm mb-3 block">Статус</label>
            <div className="grid grid-cols-3 gap-2">
              {PIPELINE.map((stage) => (
                <button
                  key={stage.id}
                  onClick={() => onStatusChange(lead.id, stage.id)}
                  className={`p-2 rounded-lg text-xs font-medium transition-all ${
                    lead.status === stage.id
                      ? `bg-gradient-to-r ${stage.color} text-white`
                      : 'bg-white/5 text-white/50 hover:bg-white/10'
                  }`}
                >
                  {stage.icon} {stage.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Tags */}
          {lead.tags.length > 0 && (
            <div>
              <label className="text-white/50 text-sm mb-2 block">Теги</label>
              <div className="flex flex-wrap gap-2">
                {lead.tags.map((tag, i) => (
                  <span key={i} className="px-2 py-1 bg-white/5 rounded text-sm text-white/60">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Dates */}
          <div className="pt-4 border-t border-white/10 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-white/40">Создан:</span>
              <span className="text-white/70 ml-2">{new Date(lead.createdAt).toLocaleDateString('ru')}</span>
            </div>
            {lead.lastContactAt && (
              <div>
                <span className="text-white/40">Контакт:</span>
                <span className="text-white/70 ml-2">{new Date(lead.lastContactAt).toLocaleDateString('ru')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function InfoBlock({ label, value, icon }: { label: string; value: string | null; icon: string }) {
  return (
    <div className="bg-white/[0.03] rounded-lg p-3">
      <div className="text-white/40 text-xs mb-1">{label}</div>
      <div className="text-white/80 text-sm flex items-center gap-2">
        <span>{icon}</span>
        <span className="truncate">{value || '—'}</span>
      </div>
    </div>
  );
}

// AI Modal
function AIModal({ lead, loading, result, onClose }: {
  lead: Lead | null;
  loading: boolean;
  result: any;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-[#12121a] border border-white/10 rounded-2xl z-50 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">🤖 AI Продавец</h2>
            <button onClick={onClose} className="text-white/50 hover:text-white">✕</button>
          </div>
          
          {loading && (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/60">Генерирую сообщение...</p>
              <p className="text-white/30 text-sm mt-1">Анализирую данные через AI</p>
            </div>
          )}
          
          {!loading && result && (
            <div className="space-y-4">
              {result.success ? (
                <>
                  <div className="flex items-center gap-2 text-green-400">
                    <span className="text-2xl">✅</span>
                    <span>Готово!</span>
                  </div>
                  
                  {result.metadata && (
                    <div className="flex gap-2">
                      {result.metadata.entryStrategyName && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                          🎯 {result.metadata.entryStrategyName}
                        </span>
                      )}
                      {result.metadata.communicationModelName && (
                        <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
                          🎭 {result.metadata.communicationModelName}
                        </span>
                      )}
                    </div>
                  )}
                  
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-white whitespace-pre-wrap">{result.message}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={sendAIMessage}
                      disabled={sending}
                      className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 text-white rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      {sending ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          Отправка...
                        </>
                      ) : (
                        <>
                          {aiModal.lead?.telegram ? '✈️ Telegram' : '📱 SMS'}
                          <span>Отправить</span>
                        </>
                      )}
                    </button>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(result.message);
                        alert('Скопировано!');
                      }}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
                      title="Скопировать"
                    >
                      📋
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <span className="text-4xl mb-4 block">❌</span>
                  <p className="text-white/80 mb-4">{result.error}</p>
                  {result.needsConfiguration && (
                    <Link href="/crm/settings" className="inline-block px-4 py-2 bg-purple-500 text-white rounded-xl">
                      ⚙️ Настроить
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
