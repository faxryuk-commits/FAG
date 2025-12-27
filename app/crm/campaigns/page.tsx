'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  type: string;
  channel: string;
  status: string;
  scheduledAt: string | null;
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replied: number;
  } | null;
  segment?: any;
  createdAt: string;
}

interface Template {
  id: string;
  name: string;
  channel: string;
  subject: string | null;
  body: string;
  type: string;
}

interface Strategy {
  id: string;
  nameRu: string;
  description: string;
  icon: string;
  bestFor: string[];
}

const CHANNEL_ICONS: Record<string, string> = {
  email: '📧',
  sms: '📱',
  telegram: '✈️',
  whatsapp: '💬',
  multi: '🌐',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
  scheduled: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  running: { bg: 'bg-green-500/20', text: 'text-green-400' },
  paused: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  completed: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
};

const STATUS_LABELS: Record<string, string> = {
  draft: '📝 Черновик',
  scheduled: '📅 Запланирована',
  running: '▶️ Активна',
  paused: '⏸️ Пауза',
  completed: '✅ Завершена',
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'templates'>('campaigns');
  
  // Форма новой кампании
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    type: 'cold_outreach',
    channel: 'telegram',
    segment: 'all',
    templateId: '',
    strategyId: '',
    useAI: true,
  });
  
  // Форма нового шаблона
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    channel: 'telegram',
    type: 'outreach',
    subject: '',
    body: '',
  });
  
  // AI генерация
  const [generating, setGenerating] = useState(false);
  
  // Запуск кампании
  const [sendingCampaign, setSendingCampaign] = useState<string | null>(null);
  const [sendResults, setSendResults] = useState<Record<string, {
    success: boolean;
    sent: number;
    failed: number;
    details: Array<{ lead: string; status: string; message?: string; error?: string }>;
    hasMore: boolean;
  }>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [campaignsRes, templatesRes, strategiesRes] = await Promise.all([
        fetch('/api/crm/campaigns'),
        fetch('/api/crm/templates'),
        fetch('/api/crm/strategies'),
      ]);
      
      const campaignsData = await campaignsRes.json();
      const templatesData = await templatesRes.json();
      const strategiesData = await strategiesRes.json();
      
      setCampaigns(campaignsData.campaigns || []);
      setTemplates(templatesData.templates || []);
      setStrategies(strategiesData.strategies || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createCampaign = async () => {
    try {
      const res = await fetch('/api/crm/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newCampaign,
          // Если useAI и нет шаблона — не передаём templateId
          templateId: newCampaign.useAI ? null : newCampaign.templateId,
        }),
      });
      
      if (res.ok) {
        setShowNewCampaign(false);
        setNewCampaign({ name: '', type: 'cold_outreach', channel: 'telegram', segment: 'all', templateId: '', strategyId: '', useAI: true });
        fetchData();
      }
    } catch (error) {
      console.error('Error creating campaign:', error);
    }
  };

  const createTemplate = async () => {
    try {
      const res = await fetch('/api/crm/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate),
      });
      
      if (res.ok) {
        setShowNewTemplate(false);
        setNewTemplate({ name: '', channel: 'telegram', type: 'outreach', subject: '', body: '' });
        fetchData();
      }
    } catch (error) {
      console.error('Error creating template:', error);
    }
  };

  // Генерация шаблона через AI
  const generateAITemplate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/crm/templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newTemplate.type === 'outreach' ? 'cold_outreach' : newTemplate.type,
          channel: newTemplate.channel,
          targetAudience: 'рестораны и кафе',
        }),
      });
      
      const data = await res.json();
      
      if (data.success && data.template) {
        setNewTemplate(prev => ({
          ...prev,
          body: data.template,
          name: prev.name || `AI шаблон ${newTemplate.type} ${new Date().toLocaleDateString('ru-RU')}`,
        }));
      } else {
        alert(data.error || 'Ошибка генерации. Проверьте настройки OpenAI.');
      }
    } catch (error) {
      console.error('Error generating template:', error);
      alert('Ошибка генерации шаблона');
    } finally {
      setGenerating(false);
    }
  };

  const startCampaign = async (campaignId: string, dryRun = false, limit = 10) => {
    try {
      setSendingCampaign(campaignId);
      
      const res = await fetch(`/api/crm/campaigns/${campaignId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun, limit }),
      });
      
      const data = await res.json();
      
      setSendResults(prev => ({
        ...prev,
        [campaignId]: {
          success: data.success,
          sent: data.sent || 0,
          failed: data.failed || 0,
          details: data.details || [],
          hasMore: data.hasMore || false,
        },
      }));
      
      fetchData();
    } catch (error) {
      console.error('Error starting campaign:', error);
      setSendResults(prev => ({
        ...prev,
        [campaignId]: {
          success: false,
          sent: 0,
          failed: 0,
          details: [{ lead: 'Error', status: 'error', error: String(error) }],
          hasMore: false,
        },
      }));
    } finally {
      setSendingCampaign(null);
    }
  };

  const clearResult = (campaignId: string) => {
    setSendResults(prev => {
      const newResults = { ...prev };
      delete newResults[campaignId];
      return newResults;
    });
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
              <h1 className="text-2xl font-bold text-white">
                🤖 AI Рассылки
              </h1>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowNewTemplate(true)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-medium transition-all"
              >
                📝 Новый шаблон
              </button>
              <button
                onClick={() => setShowNewCampaign(true)}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg text-white text-sm font-medium transition-all"
              >
                🚀 Новая кампания
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'campaigns' 
                ? 'bg-white text-slate-900' 
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            📊 Кампании ({campaigns.length})
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'templates' 
                ? 'bg-white text-slate-900' 
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            📝 Шаблоны ({templates.length})
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
          </div>
        ) : activeTab === 'campaigns' ? (
          /* Campaigns */
          <div className="space-y-4">
            {campaigns.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
                <div className="text-6xl mb-4">🚀</div>
                <h3 className="text-xl font-bold text-white mb-2">Нет кампаний</h3>
                <p className="text-white/60 mb-6">Создайте первую AI-рассылку для привлечения клиентов</p>
                <button
                  onClick={() => setShowNewCampaign(true)}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium"
                >
                  Создать кампанию
                </button>
              </div>
            ) : (
              campaigns.map((campaign) => {
                const result = sendResults[campaign.id];
                
                return (
                  <div 
                    key={campaign.id}
                    className="bg-white/5 border border-white/10 rounded-xl overflow-hidden"
                  >
                    {/* Campaign Header */}
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">{CHANNEL_ICONS[campaign.channel]}</span>
                        <h3 className="text-lg font-bold text-white">{campaign.name}</h3>
                        <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[campaign.status]?.bg} ${STATUS_COLORS[campaign.status]?.text}`}>
                          {STATUS_LABELS[campaign.status]}
                        </span>
                      </div>
                      
                      {campaign.description && (
                        <p className="text-white/60 mb-4">{campaign.description}</p>
                      )}
                      
                      {/* Stats */}
                      <div className="flex flex-wrap gap-4 text-sm mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-white/50">📤</span>
                          <span className="text-white font-medium">{campaign.stats?.sent || 0}</span>
                          <span className="text-white/40">отправлено</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white/50">✅</span>
                          <span className="text-green-400 font-medium">{campaign.stats?.delivered || 0}</span>
                          <span className="text-white/40">доставлено</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white/50">💬</span>
                          <span className="text-purple-400 font-medium">{campaign.stats?.replied || 0}</span>
                          <span className="text-white/40">ответов</span>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => startCampaign(campaign.id, true, 3)}
                          disabled={sendingCampaign === campaign.id}
                          className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                          👁️ Предпросмотр (3)
                        </button>
                        <button
                          onClick={() => startCampaign(campaign.id, false, 5)}
                          disabled={sendingCampaign === campaign.id}
                          className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                          {sendingCampaign === campaign.id ? (
                            <>
                              <span className="animate-spin">⏳</span>
                              Отправка...
                            </>
                          ) : (
                            <>▶️ Отправить 5</>
                          )}
                        </button>
                        <button
                          onClick={() => startCampaign(campaign.id, false, 20)}
                          disabled={sendingCampaign === campaign.id}
                          className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                        >
                          🚀 Отправить 20
                        </button>
                      </div>
                    </div>
                    
                    {/* Results Panel */}
                    {result && (
                      <div className={`border-t ${result.success ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <span className={`text-lg ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                                {result.success ? '✅' : '❌'}
                              </span>
                              <span className="text-white font-medium">
                                {result.sent > 0 ? `Отправлено: ${result.sent}` : 'Предпросмотр'}
                              </span>
                              {result.failed > 0 && (
                                <span className="text-red-400 text-sm">
                                  Ошибок: {result.failed}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => clearResult(campaign.id)}
                              className="text-white/40 hover:text-white text-sm"
                            >
                              ✕ Скрыть
                            </button>
                          </div>
                          
                          {/* Details */}
                          {result.details.length > 0 && (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {result.details.map((d, i) => (
                                <div 
                                  key={i} 
                                  className={`p-3 rounded-lg ${
                                    d.status === 'sent' ? 'bg-green-500/10' :
                                    d.status === 'preview' ? 'bg-blue-500/10' :
                                    'bg-red-500/10'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    <span>
                                      {d.status === 'sent' ? '✅' : d.status === 'preview' ? '👁️' : '❌'}
                                    </span>
                                    <span className="text-white font-medium">{d.lead}</span>
                                    {d.error && d.status !== 'preview' && (
                                      <span className="text-red-400 text-xs">{d.error}</span>
                                    )}
                                  </div>
                                  {/* Показываем превью сообщения */}
                                  {(d.message || (d.status === 'preview' && d.error)) && (
                                    <div className="text-white/60 text-sm mt-1 p-2 bg-black/20 rounded">
                                      {d.message || d.error}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {result.hasMore && (
                            <button
                              onClick={() => startCampaign(campaign.id, false, 20)}
                              className="mt-3 w-full py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm font-medium transition-all"
                            >
                              Продолжить отправку (ещё 20) →
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Templates */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.length === 0 ? (
              <div className="col-span-full bg-white/5 border border-white/10 rounded-xl p-12 text-center">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-xl font-bold text-white mb-2">Нет шаблонов</h3>
                <p className="text-white/60 mb-6">Создайте шаблоны сообщений для рассылок</p>
                <button
                  onClick={() => setShowNewTemplate(true)}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium"
                >
                  Создать шаблон
                </button>
              </div>
            ) : (
              templates.map((template) => (
                <div 
                  key={template.id}
                  className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">{CHANNEL_ICONS[template.channel]}</span>
                    <h3 className="font-bold text-white flex-1 truncate">{template.name}</h3>
                  </div>
                  
                  {template.subject && (
                    <p className="text-sm text-white/60 mb-2 truncate">
                      Тема: {template.subject}
                    </p>
                  )}
                  
                  <p className="text-sm text-white/40 line-clamp-3 mb-4">
                    {template.body}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/40 bg-white/10 px-2 py-1 rounded">
                      {template.type}
                    </span>
                    <button className="text-purple-400 text-sm hover:text-purple-300">
                      Редактировать
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* New Campaign Modal */}
      {showNewCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNewCampaign(false)} />
          
          <div className="relative bg-slate-800 rounded-2xl border border-white/10 w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-6">🚀 Новая кампания</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-white/60 text-sm mb-2">Название</label>
                <input
                  type="text"
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  placeholder="Холодная рассылка Q1 2025"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/60 text-sm mb-2">Тип</label>
                  <select
                    value={newCampaign.type}
                    onChange={(e) => setNewCampaign({ ...newCampaign, type: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="cold_outreach">🧊 Холодная</option>
                    <option value="nurturing">🌱 Прогрев</option>
                    <option value="reactivation">♻️ Реактивация</option>
                    <option value="announcement">📢 Анонс</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-white/60 text-sm mb-2">Канал</label>
                  <select
                    value={newCampaign.channel}
                    onChange={(e) => setNewCampaign({ ...newCampaign, channel: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="telegram">✈️ Telegram</option>
                    <option value="email">📧 Email</option>
                    <option value="sms">📱 SMS</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-white/60 text-sm mb-2">Сегмент</label>
                <select
                  value={newCampaign.segment}
                  onChange={(e) => setNewCampaign({ ...newCampaign, segment: e.target.value })}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="all">Все лиды</option>
                  <option value="hot">🔥 Hot</option>
                  <option value="warm">☀️ Warm</option>
                  <option value="cold">❄️ Cold</option>
                  <option value="enterprise">🏢 Enterprise</option>
                </select>
              </div>
              
              {/* AI vs Template toggle */}
              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-white font-medium">Генерация сообщений</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setNewCampaign({ ...newCampaign, useAI: true })}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                        newCampaign.useAI 
                          ? 'bg-purple-500 text-white' 
                          : 'bg-white/10 text-white/60'
                      }`}
                    >
                      🤖 AI персонализация
                    </button>
                    <button
                      onClick={() => setNewCampaign({ ...newCampaign, useAI: false })}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                        !newCampaign.useAI 
                          ? 'bg-purple-500 text-white' 
                          : 'bg-white/10 text-white/60'
                      }`}
                    >
                      📝 Шаблон
                    </button>
                  </div>
                </div>
                
                {newCampaign.useAI ? (
                  <div className="space-y-3">
                    <p className="text-white/50 text-sm">
                      AI сгенерирует уникальное сообщение для каждого лида с учётом:
                    </p>
                    <ul className="text-sm text-white/60 space-y-1">
                      <li>✅ Умные стратегии входа (не продажа в лоб)</li>
                      <li>✅ Узбекская культура и ментальность</li>
                      <li>✅ Уровень заведения</li>
                      <li>✅ Персонализация по имени и компании</li>
                    </ul>
                    
                    {strategies.length > 0 && (
                      <div>
                        <label className="block text-white/60 text-sm mb-2 mt-3">
                          Стратегия входа (опционально)
                        </label>
                        <select
                          value={newCampaign.strategyId}
                          onChange={(e) => setNewCampaign({ ...newCampaign, strategyId: e.target.value })}
                          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
                        >
                          <option value="">🎲 Авто (подберёт по лиду)</option>
                          {strategies.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.icon} {s.nameRu}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {templates.length > 0 ? (
                      <select
                        value={newCampaign.templateId}
                        onChange={(e) => setNewCampaign({ ...newCampaign, templateId: e.target.value })}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="">Выберите шаблон...</option>
                        {templates.filter(t => t.channel === newCampaign.channel).map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-white/50 text-sm">
                        Нет шаблонов. <button onClick={() => { setShowNewCampaign(false); setShowNewTemplate(true); }} className="text-purple-400 hover:underline">Создать шаблон</button>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNewCampaign(false)}
                className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-all"
              >
                Отмена
              </button>
              <button
                onClick={createCampaign}
                disabled={!newCampaign.name}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium disabled:opacity-50 transition-all"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Template Modal */}
      {showNewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNewTemplate(false)} />
          
          <div className="relative bg-slate-800 rounded-2xl border border-white/10 w-full max-w-lg p-6">
            <h2 className="text-xl font-bold text-white mb-6">📝 Новый шаблон</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-white/60 text-sm mb-2">Название</label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  placeholder="Первое касание Telegram"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/60 text-sm mb-2">Канал</label>
                  <select
                    value={newTemplate.channel}
                    onChange={(e) => setNewTemplate({ ...newTemplate, channel: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="telegram">✈️ Telegram</option>
                    <option value="email">📧 Email</option>
                    <option value="sms">📱 SMS</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-white/60 text-sm mb-2">Тип</label>
                  <select
                    value={newTemplate.type}
                    onChange={(e) => setNewTemplate({ ...newTemplate, type: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="outreach">🧊 Первое касание</option>
                    <option value="follow_up">🔄 Follow-up</option>
                    <option value="demo_invite">📅 Приглашение на демо</option>
                    <option value="objection_response">💬 Ответ на возражение</option>
                  </select>
                </div>
              </div>
              
              {newTemplate.channel === 'email' && (
                <div>
                  <label className="block text-white/60 text-sm mb-2">Тема письма</label>
                  <input
                    type="text"
                    value={newTemplate.subject}
                    onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
                    placeholder="Автоматизация доставки для {{company}}"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-white/60 text-sm">
                    Текст сообщения
                    <span className="ml-2 text-white/40">(переменные: {'{{name}}'}, {'{{company}}'})</span>
                  </label>
                  <button
                    onClick={generateAITemplate}
                    disabled={generating}
                    className="px-3 py-1 bg-purple-500/20 hover:bg-purple-500/40 text-purple-400 rounded text-sm transition-all disabled:opacity-50"
                  >
                    {generating ? '⏳ Генерация...' : '✨ AI генерация'}
                  </button>
                </div>
                <textarea
                  value={newTemplate.body}
                  onChange={(e) => setNewTemplate({ ...newTemplate, body: e.target.value })}
                  rows={6}
                  placeholder="Привет, {{name}}! 👋&#10;&#10;Увидел {{company}} в каталоге..."
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-purple-500 resize-none"
                />
                <p className="text-white/40 text-xs mt-1">
                  💡 Нажмите "AI генерация" чтобы создать персонализированный шаблон
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNewTemplate(false)}
                className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-all"
              >
                Отмена
              </button>
              <button
                onClick={createTemplate}
                disabled={!newTemplate.name || !newTemplate.body}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium disabled:opacity-50 transition-all"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
