'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

// Звук уведомления (base64 encoded short beep)
const NOTIFICATION_SOUND = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2AgH5/d3V2eHl9goWJjI6QkI+Oi4qJiYmKi42PkZOUlZWVlJORkI6MiomHhoWEg4KBgYCAf39/f39/gICAgoOEhYaHiImKi4yNjo+QkJGRkZGRkJCPjo2Mi4qJiIeGhYSDgoGAgH9/fn5+fn5+fn9/gIGCg4SFhoeIiYqLjI2Oj5CQkZGRkZGQkI+OjYyLiomIh4aFhIOCgYB/f35+fn5+fn5/f4CAgYKDhIWGh4iJiouMjY6PkJCRkZGRkZCQj46NjIuKiYiHhoWEg4KBgH9/fn5+fn5+fn9/gIGCg4SFhoeIiYqLjI2Oj5CQkZGRkZGQkI+OjYyLiomIh4aFhIOCgYB/f35+fn5+fn5/f4CBgoOEhYaHiImKi4yNjo+QkJGRkZGRkJCPjo2Mi4qJiIeGhYSDgoGAf39+fn5+fn5+f3+AgYKDhIWGh4iJiouMjY6PkJCRkZGRkZCQj46NjIuKiYiHhoWEg4KBgH9/fn5+fn5+fn9/gIGCg4SFhoeIiYqLjI2Oj5CQ';

interface ChatMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  contentType: string;
  mediaUrl?: string;
  status: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  channel: string;
  externalId: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  status: string;
  unreadCount: number;
  lastMessageAt: string;
  lastMessageText: string | null;
  lastMessageBy: string | null;
  tags: string[];
  leadId: string | null;
  lead?: {
    id: string;
    name: string;
    company: string;
    status: string;
  };
  messages: ChatMessage[];
}

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'all' | 'new' | 'active' | 'qualified'>('all');
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [prevUnreadTotal, setPrevUnreadTotal] = useState(0);
  const [isBlinking, setIsBlinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Инициализация аудио
  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND);
    audioRef.current.volume = 0.5;
  }, []);

  // Звуковое уведомление при новых сообщениях
  const playNotificationSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
    // Также мигаем title
    setIsBlinking(true);
    setTimeout(() => setIsBlinking(false), 3000);
  }, []);

  // Обновление title при новых сообщениях
  useEffect(() => {
    if (unreadTotal > 0) {
      document.title = isBlinking 
        ? `🔴 (${unreadTotal}) Новые сообщения!` 
        : `📥 (${unreadTotal}) Входящие - CRM`;
    } else {
      document.title = '📥 Входящие - CRM';
    }
  }, [unreadTotal, isBlinking]);

  // Мигание title
  useEffect(() => {
    if (!isBlinking || unreadTotal === 0) return;
    
    const interval = setInterval(() => {
      document.title = document.title.startsWith('🔴') 
        ? `📥 (${unreadTotal}) Входящие - CRM`
        : `🔴 (${unreadTotal}) Новые сообщения!`;
    }, 500);
    
    return () => clearInterval(interval);
  }, [isBlinking, unreadTotal]);

  useEffect(() => {
    fetchConversations();
    // Polling для новых сообщений каждые 5 секунд
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [filter]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('status', filter);
      
      const res = await fetch(`/api/crm/inbox?${params}`);
      const data = await res.json();
      const newUnread = data.unreadTotal || 0;
      
      // Если появились новые сообщения - играем звук
      if (newUnread > prevUnreadTotal && prevUnreadTotal >= 0) {
        playNotificationSound();
      }
      
      setConversations(data.conversations || []);
      setPrevUnreadTotal(unreadTotal);
      setUnreadTotal(newUnread);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectConversation = async (conv: Conversation) => {
    setSelectedConversation(conv);
    
    try {
      const res = await fetch(`/api/crm/inbox/${conv.id}`);
      const data = await res.json();
      setMessages(data.conversation?.messages || []);
      
      // Обновляем список (убираем unread)
      setConversations(prev => prev.map(c => 
        c.id === conv.id ? { ...c, unreadCount: 0 } : c
      ));
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;
    
    setSending(true);
    try {
      const res = await fetch(`/api/crm/inbox/${selectedConversation.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage }),
      });
      
      const data = await res.json();
      
      if (data.message) {
        setMessages(prev => [...prev, data.message]);
        setNewMessage('');
      }
      
      if (!data.sent) {
        alert(`Ошибка отправки: ${data.error}`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const convertToLead = async (formData: any) => {
    if (!selectedConversation) return;
    
    try {
      const res = await fetch(`/api/crm/inbox/${selectedConversation.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      const data = await res.json();
      
      if (data.success) {
        alert('✅ Диалог конвертирован в лида!');
        setShowConvertModal(false);
        fetchConversations();
        setSelectedConversation(prev => prev ? { ...prev, leadId: data.lead.id, status: 'qualified' } : null);
      } else {
        alert(`Ошибка: ${data.error}`);
      }
    } catch (error) {
      console.error('Error converting:', error);
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'instagram': return '📸';
      case 'telegram': return '✈️';
      case 'whatsapp': return '💬';
      case 'website_chat': return '🌐';
      default: return '💬';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-500';
      case 'active': return 'bg-green-500';
      case 'qualified': return 'bg-purple-500';
      case 'spam': return 'bg-red-500';
      case 'closed': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'сейчас';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин`;
    if (diff < 86400000) return date.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('ru', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/crm" className="text-white/50 hover:text-white">← CRM</Link>
            <h1 className="text-xl font-bold flex items-center gap-2">
              📥 Входящие
              {unreadTotal > 0 && (
                <span className={`px-2.5 py-1 bg-red-500 text-white text-sm font-bold rounded-full ${isBlinking ? 'animate-pulse' : ''}`}>
                  {unreadTotal}
                </span>
              )}
            </h1>
          </div>
          
          {/* Фильтры */}
          <div className="flex gap-2">
            {(['all', 'new', 'active', 'qualified'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                  filter === f 
                    ? 'bg-purple-500 text-white' 
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                {f === 'all' ? 'Все' : f === 'new' ? '🔵 Новые' : f === 'active' ? '🟢 Активные' : '🟣 Лиды'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Список диалогов */}
        <div className="w-80 border-r border-white/10 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-white/40">
                <div className="text-4xl mb-4">📭</div>
                <p>Нет диалогов</p>
              </div>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={`p-4 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-all ${
                    selectedConversation?.id === conv.id ? 'bg-purple-500/10 border-l-2 border-l-purple-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Аватар */}
                    <div className="relative">
                      {conv.avatarUrl ? (
                        <img src={conv.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl">
                          {getChannelIcon(conv.channel)}
                        </div>
                      )}
                      {conv.unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center animate-pulse shadow-lg shadow-red-500/50">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>

                    {/* Инфо */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">
                          {conv.name || conv.username || 'Неизвестный'}
                        </span>
                        <span className="text-xs text-white/40 whitespace-nowrap">
                          {formatTime(conv.lastMessageAt)}
                        </span>
                      </div>
                      
                      {conv.username && (
                        <div className="text-xs text-white/40">@{conv.username}</div>
                      )}
                      
                      <div className="text-sm text-white/60 truncate mt-1">
                        {conv.lastMessageBy === 'us' && '→ '}
                        {conv.lastMessageText || 'Нет сообщений'}
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <span className={`w-2 h-2 rounded-full ${getStatusColor(conv.status)}`} />
                        <span className="text-xs text-white/40">{conv.channel}</span>
                        {conv.leadId && (
                          <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                            Лид
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Чат */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Шапка чата */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selectedConversation.avatarUrl ? (
                    <img src={selectedConversation.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      {getChannelIcon(selectedConversation.channel)}
                    </div>
                  )}
                  <div>
                    <div className="font-medium">
                      {selectedConversation.name || selectedConversation.username || 'Неизвестный'}
                    </div>
                    <div className="text-sm text-white/50">
                      {selectedConversation.channel} • {selectedConversation.username && `@${selectedConversation.username}`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedConversation.leadId ? (
                    <Link
                      href={`/crm?lead=${selectedConversation.leadId}`}
                      className="px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-sm hover:bg-purple-500/30"
                    >
                      👤 Открыть лида
                    </Link>
                  ) : (
                    <button
                      onClick={() => setShowConvertModal(true)}
                      className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
                    >
                      ✨ Создать лида
                    </button>
                  )}
                </div>
              </div>

              {/* Сообщения */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                        msg.direction === 'outbound'
                          ? 'bg-purple-500 text-white rounded-br-md'
                          : 'bg-white/10 text-white rounded-bl-md'
                      }`}
                    >
                      {msg.mediaUrl && (
                        <img src={msg.mediaUrl} alt="" className="max-w-full rounded-lg mb-2" />
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <div className={`text-xs mt-1 ${msg.direction === 'outbound' ? 'text-white/60' : 'text-white/40'}`}>
                        {formatTime(msg.createdAt)}
                        {msg.direction === 'outbound' && (
                          <span className="ml-2">
                            {msg.status === 'sent' ? '✓' : msg.status === 'delivered' ? '✓✓' : msg.status === 'read' ? '✓✓' : '⏳'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Ввод сообщения */}
              <div className="p-4 border-t border-white/10">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="Написать сообщение..."
                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending}
                    className="px-6 py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? '⏳' : '📤'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-white/40">
              <div className="text-center">
                <div className="text-6xl mb-4">💬</div>
                <p>Выберите диалог</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Модал конвертации */}
      {showConvertModal && selectedConversation && (
        <ConvertModal
          conversation={selectedConversation}
          onClose={() => setShowConvertModal(false)}
          onConvert={convertToLead}
        />
      )}
    </div>
  );
}

// Модал конвертации в лида
function ConvertModal({ 
  conversation, 
  onClose, 
  onConvert 
}: { 
  conversation: Conversation;
  onClose: () => void;
  onConvert: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    name: conversation.name || '',
    company: '',
    phone: '',
    email: '',
    segment: 'warm',
    tags: [] as string[],
  });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10">
        <h2 className="text-xl font-bold mb-6">✨ Создать лида из диалога</h2>
        
        <div className="space-y-4">
          <div>
            <label className="text-white/60 text-sm mb-1 block">Имя</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
            />
          </div>
          
          <div>
            <label className="text-white/60 text-sm mb-1 block">Компания</label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-white/60 text-sm mb-1 block">Телефон</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="text-white/60 text-sm mb-1 block">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
              />
            </div>
          </div>
          
          <div>
            <label className="text-white/60 text-sm mb-1 block">Сегмент</label>
            <select
              value={formData.segment}
              onChange={(e) => setFormData({ ...formData, segment: e.target.value })}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
            >
              <option value="hot">🔥 Горячий</option>
              <option value="warm">🌡️ Тёплый</option>
              <option value="cold">❄️ Холодный</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
          >
            Отмена
          </button>
          <button
            onClick={() => onConvert(formData)}
            className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            ✨ Создать
          </button>
        </div>
      </div>
    </div>
  );
}

