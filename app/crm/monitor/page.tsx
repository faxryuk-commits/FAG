'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface Touch {
  id: string;
  leadId: string;
  channel: string;
  direction: string;
  content: string | null;
  status: string;
  response: string | null;
  responseAt: string | null;
  outcome: string | null;
  performedBy: string | null;
  createdAt: string;
  lead: {
    id: string;
    name: string | null;
    firstName: string | null;
    company: string | null;
    phone: string | null;
    telegram: string | null;
  };
}

interface AIConversation {
  id: string;
  leadId: string;
  channel: string;
  status: string;
  stage: string;
  createdAt: string;
  updatedAt: string;
  lead: {
    id: string;
    name: string | null;
    firstName: string | null;
    company: string | null;
  };
  messages: AIMessage[];
}

interface AIMessage {
  id: string;
  role: string;
  content: string;
  intent: string | null;
  technique: string | null;
  createdAt: string;
}

interface Stats {
  totalTouches: number;
  todayTouches: number;
  pendingResponses: number;
  activeConversations: number;
  messagesSent: number;
  repliesReceived: number;
}

const CHANNEL_ICONS: Record<string, string> = {
  telegram: '✈️',
  sms: '📱',
  email: '📧',
  call: '📞',
  whatsapp: '💬',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  sent: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  delivered: { bg: 'bg-green-500/20', text: 'text-green-400' },
  opened: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  replied: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  failed: { bg: 'bg-red-500/20', text: 'text-red-400' },
};

const DIRECTION_ICONS: Record<string, string> = {
  outbound: '📤',
  inbound: '📥',
};

export default function MonitorPage() {
  const [touches, setTouches] = useState<Touch[]>([]);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'feed' | 'conversations' | 'pending'>('feed');
  const [selectedConversation, setSelectedConversation] = useState<AIConversation | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchData();
    
    // Автообновление каждые 10 секунд
    if (autoRefresh) {
      refreshInterval.current = setInterval(fetchData, 10000);
    }
    
    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, [autoRefresh]);

  const fetchData = async () => {
    try {
      const [touchesRes, conversationsRes, statsRes] = await Promise.all([
        fetch('/api/crm/monitor/touches'),
        fetch('/api/crm/monitor/conversations'),
        fetch('/api/crm/monitor/stats'),
      ]);
      
      const touchesData = await touchesRes.json();
      const conversationsData = await conversationsRes.json();
      const statsData = await statsRes.json();
      
      setTouches(touchesData.touches || []);
      setConversations(conversationsData.conversations || []);
      setStats(statsData.stats || null);
    } catch (error) {
      console.error('Error fetching monitor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const pendingTouches = touches.filter(t => t.status === 'pending' || t.status === 'sent');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-white/10">
        <div className="max-w-[1800px] mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/crm" className="text-white/60 hover:text-white transition-colors">
                ← CRM
              </Link>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                📡 Диспетчерский центр
                {autoRefresh && (
                  <span className="flex items-center gap-1 text-xs text-green-400 font-normal">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    Live
                  </span>
                )}
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Auto Refresh Toggle */}
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  autoRefresh 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-white/10 text-white/60'
                }`}
              >
                {autoRefresh ? '🔄 Авто-обновление ВКЛ' : '⏸️ Авто-обновление ВЫКЛ'}
              </button>
              
              <button
                onClick={fetchData}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-medium transition-all"
              >
                🔄 Обновить
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <StatCard label="Всего касаний" value={stats.totalTouches} icon="📊" />
            <StatCard label="Сегодня" value={stats.todayTouches} icon="📅" color="text-blue-400" />
            <StatCard label="Ожидают ответа" value={stats.pendingResponses} icon="⏳" color="text-yellow-400" />
            <StatCard label="Активных диалогов" value={stats.activeConversations} icon="💬" color="text-green-400" />
            <StatCard label="Отправлено" value={stats.messagesSent} icon="📤" color="text-purple-400" />
            <StatCard label="Получено ответов" value={stats.repliesReceived} icon="📥" color="text-emerald-400" />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('feed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'feed' 
                ? 'bg-white text-slate-900' 
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            📰 Лента событий ({touches.length})
          </button>
          <button
            onClick={() => setActiveTab('conversations')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'conversations' 
                ? 'bg-white text-slate-900' 
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            🤖 AI Диалоги ({conversations.filter(c => c.status === 'active').length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'pending' 
                ? 'bg-yellow-500 text-slate-900' 
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            ⏳ Ожидают ответа ({pendingTouches.length})
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2">
              {activeTab === 'feed' && (
                <ActivityFeed touches={touches} />
              )}
              
              {activeTab === 'conversations' && (
                <ConversationsList 
                  conversations={conversations} 
                  onSelect={setSelectedConversation}
                  selectedId={selectedConversation?.id}
                />
              )}
              
              {activeTab === 'pending' && (
                <PendingList touches={pendingTouches} />
              )}
            </div>

            {/* Sidebar - Conversation Detail */}
            <div className="lg:col-span-1">
              {selectedConversation ? (
                <ConversationDetail 
                  conversation={selectedConversation} 
                  onClose={() => setSelectedConversation(null)}
                />
              ) : (
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                  <div className="text-4xl mb-4">💬</div>
                  <p className="text-white/60">Выберите диалог для просмотра деталей</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Компоненты

function StatCard({ label, value, icon, color = 'text-white' }: { 
  label: string; 
  value: number; 
  icon: string;
  color?: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-white/50 text-sm">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function ActivityFeed({ touches }: { touches: Touch[] }) {
  if (touches.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
        <div className="text-6xl mb-4">📭</div>
        <h3 className="text-xl font-bold text-white mb-2">Нет активности</h3>
        <p className="text-white/60">Запустите AI рассылку чтобы увидеть события</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {touches.map((touch) => (
        <div 
          key={touch.id}
          className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all"
        >
          <div className="flex items-start gap-4">
            {/* Channel Icon */}
            <div className="text-2xl">
              {CHANNEL_ICONS[touch.channel] || '📨'}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">
                  {DIRECTION_ICONS[touch.direction]}
                </span>
                <span className="font-medium text-white">
                  {touch.lead.firstName || touch.lead.name || 'Без имени'}
                </span>
                {touch.lead.company && (
                  <span className="text-white/50 text-sm">
                    • {touch.lead.company}
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[touch.status]?.bg} ${STATUS_COLORS[touch.status]?.text}`}>
                  {touch.status}
                </span>
                <span className="text-white/40 text-xs ml-auto">
                  {new Date(touch.createdAt).toLocaleString('ru-RU')}
                </span>
              </div>
              
              {/* Message Content */}
              {touch.content && (
                <div className={`text-sm p-3 rounded-lg ${
                  touch.direction === 'outbound' 
                    ? 'bg-purple-500/10 border-l-2 border-purple-500' 
                    : 'bg-green-500/10 border-l-2 border-green-500'
                }`}>
                  <p className="text-white/80 whitespace-pre-wrap line-clamp-3">
                    {touch.content}
                  </p>
                </div>
              )}
              
              {/* Response */}
              {touch.response && (
                <div className="mt-2 p-3 bg-green-500/10 border-l-2 border-green-500 rounded-lg">
                  <p className="text-xs text-green-400 mb-1">📥 Ответ клиента:</p>
                  <p className="text-white/80 text-sm whitespace-pre-wrap">
                    {touch.response}
                  </p>
                </div>
              )}
              
              {/* Footer */}
              <div className="flex items-center gap-4 mt-2 text-xs text-white/40">
                {touch.performedBy && (
                  <span>{touch.performedBy === 'ai_robot' ? '🤖 AI Робот' : '👤 Вручную'}</span>
                )}
                {touch.outcome && (
                  <span className={
                    touch.outcome === 'positive' ? 'text-green-400' :
                    touch.outcome === 'negative' ? 'text-red-400' : ''
                  }>
                    {touch.outcome === 'positive' ? '✅ Позитивный' :
                     touch.outcome === 'negative' ? '❌ Негативный' :
                     touch.outcome === 'neutral' ? '😐 Нейтральный' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ConversationsList({ 
  conversations, 
  onSelect,
  selectedId,
}: { 
  conversations: AIConversation[];
  onSelect: (c: AIConversation) => void;
  selectedId?: string;
}) {
  if (conversations.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
        <div className="text-6xl mb-4">🤖</div>
        <h3 className="text-xl font-bold text-white mb-2">Нет AI диалогов</h3>
        <p className="text-white/60">Запустите AI робота на лиде чтобы начать диалог</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {conversations.map((conv) => (
        <div 
          key={conv.id}
          onClick={() => onSelect(conv)}
          className={`bg-white/5 border rounded-xl p-4 cursor-pointer transition-all ${
            selectedId === conv.id 
              ? 'border-purple-500 bg-purple-500/10' 
              : 'border-white/10 hover:bg-white/10'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{CHANNEL_ICONS[conv.channel]}</span>
              <span className="font-medium text-white">
                {conv.lead.firstName || conv.lead.name || 'Без имени'}
              </span>
              {conv.lead.company && (
                <span className="text-white/50 text-sm">• {conv.lead.company}</span>
              )}
            </div>
            <span className={`px-2 py-0.5 rounded text-xs ${
              conv.status === 'active' ? 'bg-green-500/20 text-green-400' :
              conv.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
              conv.status === 'escalated' ? 'bg-orange-500/20 text-orange-400' :
              'bg-white/20 text-white/60'
            }`}>
              {conv.status === 'active' ? '🟢 Активен' :
               conv.status === 'completed' ? '✅ Завершён' :
               conv.status === 'escalated' ? '🚨 Эскалация' :
               conv.status}
            </span>
          </div>
          
          <div className="text-sm text-white/60 mb-2">
            Этап: {conv.stage} • Сообщений: {conv.messages.length}
          </div>
          
          {conv.messages.length > 0 && (
            <p className="text-sm text-white/40 line-clamp-2">
              {conv.messages[conv.messages.length - 1].content}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function PendingList({ touches }: { touches: Touch[] }) {
  if (touches.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h3 className="text-xl font-bold text-white mb-2">Всё обработано!</h3>
        <p className="text-white/60">Нет сообщений ожидающих ответа</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {touches.map((touch) => (
        <div 
          key={touch.id}
          className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{CHANNEL_ICONS[touch.channel]}</span>
              <span className="font-medium text-white">
                {touch.lead.firstName || touch.lead.name || 'Без имени'}
              </span>
            </div>
            <span className="text-yellow-400 text-sm">
              ⏳ Ожидает {Math.round((Date.now() - new Date(touch.createdAt).getTime()) / 1000 / 60 / 60)}ч
            </span>
          </div>
          
          {touch.content && (
            <p className="text-sm text-white/80 line-clamp-2 mb-2">
              {touch.content}
            </p>
          )}
          
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-green-500/20 text-green-400 rounded text-sm hover:bg-green-500/30 transition-all">
              📥 Проверить ответ
            </button>
            <button className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded text-sm hover:bg-purple-500/30 transition-all">
              🔄 Follow-up
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ConversationDetail({ 
  conversation, 
  onClose 
}: { 
  conversation: AIConversation;
  onClose: () => void;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-white/5 border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white">
              {conversation.lead.firstName || conversation.lead.name || 'Диалог'}
            </h3>
            <p className="text-white/50 text-sm">
              {conversation.lead.company || 'Без компании'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-white/60 hover:text-white"
          >
            ✕
          </button>
        </div>
        
        <div className="flex items-center gap-2 mt-3 text-xs">
          <span className="px-2 py-1 bg-white/10 rounded">
            {CHANNEL_ICONS[conversation.channel]} {conversation.channel}
          </span>
          <span className="px-2 py-1 bg-white/10 rounded">
            📍 {conversation.stage}
          </span>
          <span className={`px-2 py-1 rounded ${
            conversation.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-white/10'
          }`}>
            {conversation.status}
          </span>
        </div>
      </div>
      
      {/* Messages */}
      <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
        {conversation.messages.map((msg) => (
          <div 
            key={msg.id}
            className={`p-3 rounded-lg ${
              msg.role === 'assistant' 
                ? 'bg-purple-500/10 border-l-2 border-purple-500 ml-0 mr-8' 
                : 'bg-green-500/10 border-l-2 border-green-500 ml-8 mr-0'
            }`}
          >
            <div className="flex items-center gap-2 mb-1 text-xs">
              <span className={msg.role === 'assistant' ? 'text-purple-400' : 'text-green-400'}>
                {msg.role === 'assistant' ? '🤖 AI' : '👤 Клиент'}
              </span>
              {msg.technique && (
                <span className="text-white/40">• {msg.technique}</span>
              )}
              {msg.intent && (
                <span className="text-white/40">• {msg.intent}</span>
              )}
              <span className="text-white/30 ml-auto">
                {new Date(msg.createdAt).toLocaleTimeString('ru-RU')}
              </span>
            </div>
            <p className="text-white/80 text-sm whitespace-pre-wrap">
              {msg.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

