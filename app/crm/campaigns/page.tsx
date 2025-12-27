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
  });
  
  // Форма нового шаблона
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    channel: 'telegram',
    type: 'outreach',
    subject: '',
    body: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [campaignsRes, templatesRes] = await Promise.all([
        fetch('/api/crm/campaigns'),
        fetch('/api/crm/templates'),
      ]);
      
      const campaignsData = await campaignsRes.json();
      const templatesData = await templatesRes.json();
      
      setCampaigns(campaignsData.campaigns || []);
      setTemplates(templatesData.templates || []);
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
        body: JSON.stringify(newCampaign),
      });
      
      if (res.ok) {
        setShowNewCampaign(false);
        setNewCampaign({ name: '', type: 'cold_outreach', channel: 'telegram', segment: 'all', templateId: '' });
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

  const startCampaign = async (campaignId: string) => {
    try {
      await fetch(`/api/crm/campaigns/${campaignId}/start`, {
        method: 'POST',
      });
      fetchData();
    } catch (error) {
      console.error('Error starting campaign:', error);
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
              campaigns.map((campaign) => (
                <div 
                  key={campaign.id}
                  className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
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
                      {campaign.stats && (
                        <div className="flex gap-6 text-sm">
                          <div>
                            <span className="text-white/50">Отправлено:</span>
                            <span className="ml-2 text-white font-medium">{campaign.stats.sent}</span>
                          </div>
                          <div>
                            <span className="text-white/50">Доставлено:</span>
                            <span className="ml-2 text-green-400 font-medium">{campaign.stats.delivered}</span>
                          </div>
                          <div>
                            <span className="text-white/50">Открыто:</span>
                            <span className="ml-2 text-blue-400 font-medium">{campaign.stats.opened}</span>
                          </div>
                          <div>
                            <span className="text-white/50">Ответили:</span>
                            <span className="ml-2 text-purple-400 font-medium">{campaign.stats.replied}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      {campaign.status === 'draft' && (
                        <button
                          onClick={() => startCampaign(campaign.id)}
                          className="px-4 py-2 bg-green-500/20 hover:bg-green-500/40 text-green-400 rounded-lg text-sm font-medium transition-all"
                        >
                          ▶️ Запустить
                        </button>
                      )}
                      {campaign.status === 'running' && (
                        <button className="px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm font-medium">
                          ⏸️ Пауза
                        </button>
                      )}
                      <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-all">
                        📊 Статистика
                      </button>
                    </div>
                  </div>
                </div>
              ))
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
          
          <div className="relative bg-slate-800 rounded-2xl border border-white/10 w-full max-w-lg p-6">
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
                    <option value="multi">🌐 Мульти</option>
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
              
              {templates.length > 0 && (
                <div>
                  <label className="block text-white/60 text-sm mb-2">Шаблон</label>
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
                </div>
              )}
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
                <label className="block text-white/60 text-sm mb-2">
                  Текст сообщения
                  <span className="ml-2 text-white/40">(переменные: {'{{name}}'}, {'{{company}}'})</span>
                </label>
                <textarea
                  value={newTemplate.body}
                  onChange={(e) => setNewTemplate({ ...newTemplate, body: e.target.value })}
                  rows={6}
                  placeholder="Привет, {{name}}! 👋&#10;&#10;Увидел {{company}} в каталоге..."
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-purple-500 resize-none"
                />
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

