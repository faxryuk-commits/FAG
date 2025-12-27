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
    total?: number;
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
  name: string;
  description: string;
  icon: string;
  bestFor: string[];
}

interface TargetAudience {
  total: number;
  leads: Array<{
    id: string;
    name: string | null;
    company: string | null;
    phone: string | null;
    telegram: string | null;
    email: string | null;
    segment: string | null;
    score: number;
  }>;
  filters: {
    segment: string;
    channel: string;
    hasContact: boolean;
    notSentYet: boolean;
  };
}

const CHANNEL_CONFIG: Record<string, { icon: string; label: string; contactField: string; requirement: string }> = {
  telegram: { icon: '✈️', label: 'Telegram', contactField: 'telegram', requirement: 'Нужен @username или chat_id' },
  sms: { icon: '📱', label: 'SMS', contactField: 'phone', requirement: 'Нужен мобильный номер' },
  email: { icon: '📧', label: 'Email', contactField: 'email', requirement: 'Нужен email' },
};

const SEGMENT_CONFIG: Record<string, { icon: string; label: string; description: string }> = {
  all: { icon: '👥', label: 'Все лиды', description: 'Без фильтра по сегменту' },
  hot: { icon: '🔥', label: 'Hot', description: 'Горячие, готовы к покупке' },
  warm: { icon: '☀️', label: 'Warm', description: 'Тёплые, есть интерес' },
  cold: { icon: '❄️', label: 'Cold', description: 'Холодные, нужен прогрев' },
  enterprise: { icon: '🏢', label: 'Enterprise', description: 'Крупные сети' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  draft: { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/30' },
  scheduled: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  running: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
  paused: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  completed: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'templates'>('campaigns');
  
  // Выбранная кампания для детального просмотра
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [targetAudience, setTargetAudience] = useState<TargetAudience | null>(null);
  const [loadingAudience, setLoadingAudience] = useState(false);
  
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
  const [sendProgress, setSendProgress] = useState<{
    sent: number;
    failed: number;
    total: number;
    details: Array<{ lead: string; status: string; message?: string; error?: string }>;
  } | null>(null);

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

  // Загрузить целевую аудиторию для кампании
  const loadTargetAudience = async (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setLoadingAudience(true);
    setSendProgress(null);
    
    try {
      const segment = (campaign.segment as any)?.segment || 'all';
      const res = await fetch(`/api/crm/campaigns/${campaign.id}/audience`);
      const data = await res.json();
      
      setTargetAudience({
        total: data.total || 0,
        leads: data.leads || [],
        filters: {
          segment,
          channel: campaign.channel,
          hasContact: true,
          notSentYet: true,
        },
      });
    } catch (error) {
      console.error('Error loading audience:', error);
      setTargetAudience(null);
    } finally {
      setLoadingAudience(false);
    }
  };

  const createCampaign = async () => {
    try {
      const res = await fetch('/api/crm/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newCampaign,
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
          name: prev.name || `AI шаблон ${new Date().toLocaleDateString('ru-RU')}`,
        }));
      } else {
        alert(data.error || 'Ошибка генерации');
      }
    } catch (error) {
      console.error('Error generating template:', error);
    } finally {
      setGenerating(false);
    }
  };

  const startCampaign = async (campaignId: string, dryRun = false, limit = 10) => {
    setSendingCampaign(campaignId);
    setSendProgress({ sent: 0, failed: 0, total: limit, details: [] });
    
    try {
      const res = await fetch(`/api/crm/campaigns/${campaignId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun, limit }),
      });
      
      const data = await res.json();
      
      setSendProgress({
        sent: data.sent || 0,
        failed: data.failed || 0,
        total: data.processed || 0,
        details: data.details || [],
      });
      
      // Обновляем аудиторию
      if (selectedCampaign && !dryRun) {
        loadTargetAudience(selectedCampaign);
      }
      
      fetchData();
    } catch (error) {
      console.error('Error starting campaign:', error);
    } finally {
      setSendingCampaign(null);
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
                ← CRM
              </Link>
              <h1 className="text-2xl font-bold text-white">
                🚀 Рассылки
              </h1>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowNewTemplate(true)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-medium transition-all"
              >
                📝 Шаблон
              </button>
              <button
                onClick={() => setShowNewCampaign(true)}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg text-white text-sm font-medium transition-all"
              >
                + Кампания
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Список кампаний */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white mb-4">Мои кампании</h2>
              
              {campaigns.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                  <div className="text-4xl mb-3">🚀</div>
                  <p className="text-white/60 mb-4">Создайте первую кампанию</p>
                  <button
                    onClick={() => setShowNewCampaign(true)}
                    className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm"
                  >
                    Создать
                  </button>
                </div>
              ) : (
                campaigns.map((campaign) => (
                  <div 
                    key={campaign.id}
                    onClick={() => loadTargetAudience(campaign)}
                    className={`bg-white/5 border rounded-xl p-4 cursor-pointer transition-all hover:bg-white/10 ${
                      selectedCampaign?.id === campaign.id 
                        ? 'border-purple-500 bg-purple-500/10' 
                        : 'border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{CHANNEL_CONFIG[campaign.channel]?.icon}</span>
                        <h3 className="font-bold text-white">{campaign.name}</h3>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[campaign.status]?.bg} ${STATUS_COLORS[campaign.status]?.text}`}>
                        {campaign.status === 'draft' ? '📝 Черновик' : 
                         campaign.status === 'running' ? '▶️ Активна' : 
                         campaign.status === 'completed' ? '✅ Завершена' : campaign.status}
                      </span>
                    </div>
                    
                    <div className="flex gap-4 text-sm text-white/60">
                      <span>{SEGMENT_CONFIG[(campaign.segment as any)?.segment || 'all']?.icon} {SEGMENT_CONFIG[(campaign.segment as any)?.segment || 'all']?.label}</span>
                      <span>📤 {campaign.stats?.sent || 0} отправлено</span>
                      {(campaign.stats?.replied || 0) > 0 && (
                        <span className="text-green-400">💬 {campaign.stats?.replied} ответов</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Детали кампании */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              {selectedCampaign ? (
                <>
                  {/* Заголовок */}
                  <div className="p-4 border-b border-white/10 bg-white/5">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      {CHANNEL_CONFIG[selectedCampaign.channel]?.icon}
                      {selectedCampaign.name}
                    </h2>
                    <p className="text-white/60 text-sm mt-1">
                      {CHANNEL_CONFIG[selectedCampaign.channel]?.label} • 
                      {SEGMENT_CONFIG[(selectedCampaign.segment as any)?.segment || 'all']?.label}
                    </p>
                  </div>
                  
                  {/* Целевая аудитория */}
                  <div className="p-4 border-b border-white/10">
                    <h3 className="text-sm font-bold text-white/80 mb-3">🎯 Кому отправим:</h3>
                    
                    {loadingAudience ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
                      </div>
                    ) : targetAudience ? (
                      <div className="space-y-3">
                        {/* Фильтры */}
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                            {SEGMENT_CONFIG[targetAudience.filters.segment]?.icon} {SEGMENT_CONFIG[targetAudience.filters.segment]?.label}
                          </span>
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                            ✅ Есть {CHANNEL_CONFIG[selectedCampaign.channel]?.contactField}
                          </span>
                          <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
                            🆕 Ещё не отправляли
                          </span>
                        </div>
                        
                        {/* Счётчик */}
                        <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg p-4 text-center">
                          <div className="text-3xl font-bold text-white">{targetAudience.total}</div>
                          <div className="text-white/60 text-sm">лидов готовы к рассылке</div>
                        </div>
                        
                        {/* Превью получателей */}
                        {targetAudience.leads.length > 0 && (
                          <div>
                            <div className="text-xs text-white/50 mb-2">Первые получатели:</div>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {targetAudience.leads.slice(0, 10).map((lead, i) => (
                                <div key={lead.id} className="flex items-center gap-2 text-sm p-2 bg-white/5 rounded">
                                  <span className="text-white/40 w-5">{i + 1}.</span>
                                  <span className="text-white flex-1 truncate">
                                    {lead.company || lead.name || 'Без имени'}
                                  </span>
                                  <span className="text-white/40 text-xs">
                                    {selectedCampaign.channel === 'telegram' && lead.telegram}
                                    {selectedCampaign.channel === 'sms' && lead.phone}
                                    {selectedCampaign.channel === 'email' && lead.email}
                                  </span>
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                                    lead.score >= 70 ? 'bg-red-500/20 text-red-400' :
                                    lead.score >= 40 ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-blue-500/20 text-blue-400'
                                  }`}>
                                    {lead.score}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {targetAudience.total > 10 && (
                              <div className="text-xs text-white/40 mt-2 text-center">
                                и ещё {targetAudience.total - 10} лидов...
                              </div>
                            )}
                          </div>
                        )}
                        
                        {targetAudience.total === 0 && (
                          <div className="text-center py-4 text-white/50">
                            <div className="text-2xl mb-2">😔</div>
                            <p>Нет лидов под эти критерии</p>
                            <p className="text-xs mt-1">{CHANNEL_CONFIG[selectedCampaign.channel]?.requirement}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-white/50 text-center py-4">
                        Не удалось загрузить аудиторию
                      </div>
                    )}
                  </div>
                  
                  {/* Кнопки действий */}
                  {targetAudience && targetAudience.total > 0 && (
                    <div className="p-4 border-b border-white/10">
                      <h3 className="text-sm font-bold text-white/80 mb-3">⚡ Действия:</h3>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => startCampaign(selectedCampaign.id, true, 3)}
                          disabled={sendingCampaign === selectedCampaign.id}
                          className="px-3 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex flex-col items-center gap-1"
                        >
                          <span className="text-lg">👁️</span>
                          <span>Превью</span>
                          <span className="text-xs text-blue-400/60">3 лида</span>
                        </button>
                        <button
                          onClick={() => startCampaign(selectedCampaign.id, false, 10)}
                          disabled={sendingCampaign === selectedCampaign.id}
                          className="px-3 py-3 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex flex-col items-center gap-1"
                        >
                          <span className="text-lg">{sendingCampaign === selectedCampaign.id ? '⏳' : '▶️'}</span>
                          <span>Старт</span>
                          <span className="text-xs text-green-400/60">10 лидов</span>
                        </button>
                        <button
                          onClick={() => startCampaign(selectedCampaign.id, false, 50)}
                          disabled={sendingCampaign === selectedCampaign.id}
                          className="px-3 py-3 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex flex-col items-center gap-1"
                        >
                          <span className="text-lg">🚀</span>
                          <span>Массово</span>
                          <span className="text-xs text-orange-400/60">50 лидов</span>
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Результаты отправки */}
                  {sendProgress && (
                    <div className="p-4 bg-slate-800/50">
                      <h3 className="text-sm font-bold text-white/80 mb-3">📊 Результат:</h3>
                      
                      {/* Прогресс бар */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-white/60 mb-1">
                          <span>Обработано: {sendProgress.sent + sendProgress.failed} / {sendProgress.total}</span>
                          <span className="text-green-400">✅ {sendProgress.sent}</span>
                          {sendProgress.failed > 0 && <span className="text-red-400">❌ {sendProgress.failed}</span>}
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all"
                            style={{ width: `${sendProgress.total > 0 ? (sendProgress.sent / sendProgress.total) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                      
                      {/* Детали */}
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {sendProgress.details.map((d, i) => (
                          <div 
                            key={i}
                            className={`p-3 rounded-lg ${
                              d.status === 'sent' ? 'bg-green-500/10 border border-green-500/20' :
                              d.status === 'preview' ? 'bg-blue-500/10 border border-blue-500/20' :
                              'bg-red-500/10 border border-red-500/20'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span>
                                {d.status === 'sent' ? '✅' : d.status === 'preview' ? '👁️' : '❌'}
                              </span>
                              <span className="text-white font-medium text-sm">{d.lead}</span>
                              {d.status === 'failed' && d.error && (
                                <span className="text-red-400 text-xs">{d.error}</span>
                              )}
                            </div>
                            {d.message && (
                              <div className="text-white/60 text-xs p-2 bg-black/20 rounded mt-1 whitespace-pre-wrap">
                                {d.message}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-64 text-white/40">
                  <div className="text-center">
                    <div className="text-4xl mb-3">👈</div>
                    <p>Выберите кампанию слева</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Templates */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.length === 0 ? (
              <div className="col-span-full bg-white/5 border border-white/10 rounded-xl p-12 text-center">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-xl font-bold text-white mb-2">Нет шаблонов</h3>
                <p className="text-white/60 mb-6">Создайте шаблоны сообщений</p>
                <button
                  onClick={() => setShowNewTemplate(true)}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg"
                >
                  Создать шаблон
                </button>
              </div>
            ) : (
              templates.map((template) => (
                <div 
                  key={template.id}
                  className="bg-white/5 border border-white/10 rounded-xl p-5"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">{CHANNEL_CONFIG[template.channel]?.icon}</span>
                    <h3 className="font-bold text-white truncate">{template.name}</h3>
                  </div>
                  <p className="text-sm text-white/40 line-clamp-3 mb-4">{template.body}</p>
                  <span className="text-xs text-white/40 bg-white/10 px-2 py-1 rounded">{template.type}</span>
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
              {/* Название */}
              <div>
                <label className="block text-white/60 text-sm mb-2">Название кампании</label>
                <input
                  type="text"
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  placeholder="Первый контакт Q1 2025"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
                />
              </div>
              
              {/* Канал */}
              <div>
                <label className="block text-white/60 text-sm mb-2">Канал отправки</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(CHANNEL_CONFIG).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => setNewCampaign({ ...newCampaign, channel: key })}
                      className={`p-3 rounded-lg border transition-all ${
                        newCampaign.channel === key
                          ? 'border-purple-500 bg-purple-500/20'
                          : 'border-white/20 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-2xl mb-1">{config.icon}</div>
                      <div className="text-white text-sm">{config.label}</div>
                    </button>
                  ))}
                </div>
                <p className="text-white/40 text-xs mt-2">
                  {CHANNEL_CONFIG[newCampaign.channel]?.requirement}
                </p>
              </div>
              
              {/* Сегмент */}
              <div>
                <label className="block text-white/60 text-sm mb-2">Кому отправлять?</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(SEGMENT_CONFIG).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => setNewCampaign({ ...newCampaign, segment: key })}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        newCampaign.segment === key
                          ? 'border-purple-500 bg-purple-500/20'
                          : 'border-white/20 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span>{config.icon}</span>
                        <span className="text-white text-sm font-medium">{config.label}</span>
                      </div>
                      <div className="text-white/40 text-xs">{config.description}</div>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* AI vs Шаблон */}
              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={() => setNewCampaign({ ...newCampaign, useAI: true })}
                    className={`flex-1 p-3 rounded-lg border transition-all ${
                      newCampaign.useAI
                        ? 'border-purple-500 bg-purple-500/20'
                        : 'border-white/20 bg-white/5'
                    }`}
                  >
                    <div className="text-xl mb-1">🤖</div>
                    <div className="text-white text-sm font-medium">AI генерация</div>
                    <div className="text-white/40 text-xs">Уникально для каждого</div>
                  </button>
                  <button
                    onClick={() => setNewCampaign({ ...newCampaign, useAI: false })}
                    className={`flex-1 p-3 rounded-lg border transition-all ${
                      !newCampaign.useAI
                        ? 'border-purple-500 bg-purple-500/20'
                        : 'border-white/20 bg-white/5'
                    }`}
                  >
                    <div className="text-xl mb-1">📝</div>
                    <div className="text-white text-sm font-medium">Шаблон</div>
                    <div className="text-white/40 text-xs">Одинаковое всем</div>
                  </button>
                </div>
                
                {newCampaign.useAI ? (
                  <div className="text-sm text-white/60 space-y-1">
                    <p>✅ Умные стратегии входа (не продажа в лоб)</p>
                    <p>✅ Узбекская культура (Салом!, Ассалому алайкум!)</p>
                    <p>✅ Персонализация по компании и сегменту</p>
                  </div>
                ) : templates.length > 0 ? (
                  <select
                    value={newCampaign.templateId}
                    onChange={(e) => setNewCampaign({ ...newCampaign, templateId: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white"
                  >
                    <option value="">Выберите шаблон...</option>
                    {templates.filter(t => t.channel === newCampaign.channel).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-white/50 text-sm">
                    Нет шаблонов. <button onClick={() => { setShowNewCampaign(false); setShowNewTemplate(true); }} className="text-purple-400">Создать</button>
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNewCampaign(false)}
                className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium"
              >
                Отмена
              </button>
              <button
                onClick={createCampaign}
                disabled={!newCampaign.name}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium disabled:opacity-50"
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
              <input
                type="text"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                placeholder="Название шаблона"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40"
              />
              
              <div className="grid grid-cols-2 gap-4">
                <select
                  value={newTemplate.channel}
                  onChange={(e) => setNewTemplate({ ...newTemplate, channel: e.target.value })}
                  className="px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white"
                >
                  <option value="telegram">✈️ Telegram</option>
                  <option value="sms">📱 SMS</option>
                  <option value="email">📧 Email</option>
                </select>
                
                <select
                  value={newTemplate.type}
                  onChange={(e) => setNewTemplate({ ...newTemplate, type: e.target.value })}
                  className="px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white"
                >
                  <option value="outreach">🧊 Первое касание</option>
                  <option value="follow_up">🔄 Follow-up</option>
                </select>
              </div>
              
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-white/60 text-sm">Текст (переменные: {'{{name}}'}, {'{{company}}'})</span>
                  <button
                    onClick={generateAITemplate}
                    disabled={generating}
                    className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded text-sm"
                  >
                    {generating ? '⏳...' : '✨ AI'}
                  </button>
                </div>
                <textarea
                  value={newTemplate.body}
                  onChange={(e) => setNewTemplate({ ...newTemplate, body: e.target.value })}
                  rows={5}
                  placeholder="Салом, {{name}}! 👋"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 resize-none"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNewTemplate(false)}
                className="flex-1 px-4 py-3 bg-white/10 text-white rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={createTemplate}
                disabled={!newTemplate.name || !newTemplate.body}
                className="flex-1 px-4 py-3 bg-purple-500 text-white rounded-lg disabled:opacity-50"
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
