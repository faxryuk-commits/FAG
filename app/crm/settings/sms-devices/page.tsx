'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SMSDevice {
  id: string;
  name: string;
  phone: string;
  operator: string;
  gatewayType: 'mac_sms' | 'sms_gateway_app' | 'http_api' | 'tasker';
  apiUrl: string;
  apiKey?: string;
  isActive: boolean;
  dailyLimit: number;
  sentToday: number;
}

const OPERATORS = [
  { id: 'beeline', name: 'Beeline', color: '#FFB900', prefixes: '90, 91' },
  { id: 'ucell', name: 'Ucell', color: '#7B2D8E', prefixes: '93, 94' },
  { id: 'mobiuz', name: 'Mobiuz', color: '#00A651', prefixes: '88, 97, 98, 99' },
  { id: 'uztelecom', name: 'Uztelecom', color: '#0066B3', prefixes: '95, 71, 75' },
  { id: 'humans', name: 'Humans', color: '#FF6B00', prefixes: '33' },
];

const GATEWAY_TYPES = [
  { 
    id: 'mac_sms', 
    name: 'Mac + iPhone', 
    description: 'Через Messages.app (рекомендуется)',
    icon: '🍎',
  },
  { 
    id: 'sms_gateway_app', 
    name: 'SMS Gateway App', 
    description: 'Android приложение',
    icon: '🤖',
  },
  { 
    id: 'http_api', 
    name: 'HTTP API', 
    description: 'Кастомный сервер',
    icon: '🌐',
  },
  { 
    id: 'tasker', 
    name: 'Tasker', 
    description: 'Android автоматизация',
    icon: '⚙️',
  },
];

export default function SMSDevicesPage() {
  const [devices, setDevices] = useState<SMSDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<SMSDevice | null>(null);
  const [testingDevice, setTestingDevice] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const res = await fetch('/api/crm/settings/sms-devices');
      const data = await res.json();
      setDevices(data.devices || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveDevices = async (newDevices: SMSDevice[]) => {
    setSaving(true);
    try {
      await fetch('/api/crm/settings/sms-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devices: newDevices }),
      });
      setDevices(newDevices);
    } catch (error) {
      console.error('Error saving devices:', error);
    } finally {
      setSaving(false);
    }
  };

  const addDevice = (device: SMSDevice) => {
    const newDevices = [...devices, device];
    saveDevices(newDevices);
    setShowAddModal(false);
  };

  const updateDevice = (device: SMSDevice) => {
    const newDevices = devices.map(d => d.id === device.id ? device : d);
    saveDevices(newDevices);
    setEditingDevice(null);
  };

  const deleteDevice = (id: string) => {
    if (confirm('Удалить устройство?')) {
      const newDevices = devices.filter(d => d.id !== id);
      saveDevices(newDevices);
    }
  };

  const toggleDevice = (id: string) => {
    const newDevices = devices.map(d => 
      d.id === id ? { ...d, isActive: !d.isActive } : d
    );
    saveDevices(newDevices);
  };

  const testDevice = async (device: SMSDevice) => {
    setTestingDevice(device.id);
    setTestResult(null);
    
    try {
      const res = await fetch('/api/crm/settings/sms-devices/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device }),
      });
      const data = await res.json();
      setTestResult({
        id: device.id,
        success: data.success,
        message: data.success ? `Подключено! Задержка: ${data.latency}ms` : data.error,
      });
    } catch (error) {
      setTestResult({
        id: device.id,
        success: false,
        message: 'Ошибка соединения',
      });
    } finally {
      setTestingDevice(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/crm/settings" className="text-white/60 hover:text-white">
                ← Настройки
              </Link>
              <h1 className="text-xl font-bold text-white">📱 SMS Устройства</h1>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-all"
            >
              + Добавить устройство
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Инструкция */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-bold text-blue-400 mb-3">📖 Как это работает?</h2>
          <div className="grid md:grid-cols-3 gap-4 text-white/80 text-sm">
            <div>
              <div className="text-2xl mb-2">1️⃣</div>
              <p>Установите <strong>SMS Gateway</strong> на Android телефон</p>
              <a 
                href="https://play.google.com/store/apps/details?id=eu.apksoft.android.smsgateway" 
                target="_blank"
                className="text-blue-400 hover:underline"
              >
                Скачать из Play Store →
              </a>
            </div>
            <div>
              <div className="text-2xl mb-2">2️⃣</div>
              <p>Включите сервер в приложении и запишите IP адрес (например: 192.168.1.100:8080)</p>
            </div>
            <div>
              <div className="text-2xl mb-2">3️⃣</div>
              <p>Добавьте устройство здесь — CRM будет отправлять SMS через ваш телефон!</p>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-yellow-400 text-sm">
              💡 <strong>Совет:</strong> Используйте несколько SIM-карт разных операторов — 
              SMS внутри сети бесплатные! Система автоматически выберет нужную карту.
            </p>
          </div>
        </div>

        {/* Список устройств */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
          </div>
        ) : devices.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">📱</div>
            <h3 className="text-xl font-bold text-white mb-2">Нет устройств</h3>
            <p className="text-white/60 mb-6">Добавьте телефон для отправки SMS напрямую</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-all"
            >
              + Добавить первое устройство
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device) => {
              const operator = OPERATORS.find(o => o.id === device.operator);
              const gateway = GATEWAY_TYPES.find(g => g.id === device.gatewayType);
              
              return (
                <div 
                  key={device.id}
                  className={`bg-white/5 border rounded-xl p-5 transition-all ${
                    device.isActive ? 'border-green-500/50' : 'border-white/10 opacity-60'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-white">{device.name}</h3>
                      <p className="text-white/50 text-sm">{device.phone}</p>
                    </div>
                    <button
                      onClick={() => toggleDevice(device.id)}
                      className={`w-12 h-6 rounded-full transition-all ${
                        device.isActive ? 'bg-green-500' : 'bg-white/20'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full transition-all ${
                        device.isActive ? 'translate-x-6' : 'translate-x-0.5'
                      }`}></div>
                    </button>
                  </div>
                  
                  {/* Info */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: operator?.color || '#888' }}
                      ></span>
                      <span className="text-white/70 text-sm">{operator?.name || device.operator}</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/50 text-sm">
                      <span>{gateway?.icon}</span>
                      <span>{gateway?.name}</span>
                    </div>
                    <div className="text-white/40 text-xs">
                      Лимит: {device.sentToday}/{device.dailyLimit} SMS/день
                    </div>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="h-1.5 bg-white/10 rounded-full mb-4 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-500 to-yellow-500 transition-all"
                      style={{ width: `${(device.sentToday / device.dailyLimit) * 100}%` }}
                    ></div>
                  </div>
                  
                  {/* Test result */}
                  {testResult?.id === device.id && (
                    <div className={`mb-4 p-2 rounded text-sm ${
                      testResult.success 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {testResult.message}
                    </div>
                  )}
                  
                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => testDevice(device)}
                      disabled={testingDevice === device.id}
                      className="flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm transition-all disabled:opacity-50"
                    >
                      {testingDevice === device.id ? '⏳' : '🔌'} Тест
                    </button>
                    <button
                      onClick={() => setEditingDevice(device)}
                      className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-all"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => deleteDevice(device.id)}
                      className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-all"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      {(showAddModal || editingDevice) && (
        <DeviceModal
          device={editingDevice}
          onSave={editingDevice ? updateDevice : addDevice}
          onClose={() => {
            setShowAddModal(false);
            setEditingDevice(null);
          }}
        />
      )}
    </div>
  );
}

// Модальное окно добавления/редактирования
function DeviceModal({
  device,
  onSave,
  onClose,
}: {
  device: SMSDevice | null;
  onSave: (device: SMSDevice) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<SMSDevice>(device || {
    id: `device_${Date.now()}`,
    name: '',
    phone: '+998',
    operator: 'beeline',
    gatewayType: 'mac_sms',
    apiUrl: 'http://192.168.1.',
    apiKey: '',
    isActive: true,
    dailyLimit: 100,
    sentToday: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">
            {device ? '✏️ Редактировать устройство' : '📱 Новое устройство'}
          </h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Название */}
          <div>
            <label className="block text-white/70 text-sm mb-2">Название</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Корпоративный Beeline"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-purple-500 focus:outline-none"
              required
            />
          </div>
          
          {/* Номер телефона */}
          <div>
            <label className="block text-white/70 text-sm mb-2">Номер телефона</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+998901234567"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-purple-500 focus:outline-none"
              required
            />
          </div>
          
          {/* Оператор */}
          <div>
            <label className="block text-white/70 text-sm mb-2">Оператор</label>
            <div className="grid grid-cols-5 gap-2">
              {OPERATORS.map((op) => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => setForm({ ...form, operator: op.id })}
                  className={`p-2 rounded-lg border transition-all ${
                    form.operator === op.id 
                      ? 'border-white bg-white/10' 
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <div 
                    className="w-4 h-4 rounded-full mx-auto mb-1"
                    style={{ backgroundColor: op.color }}
                  ></div>
                  <div className="text-white text-xs">{op.name}</div>
                </button>
              ))}
            </div>
          </div>
          
          {/* Тип Gateway */}
          <div>
            <label className="block text-white/70 text-sm mb-2">Тип подключения</label>
            <div className="space-y-2">
              {GATEWAY_TYPES.map((gw) => (
                <label
                  key={gw.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    form.gatewayType === gw.id 
                      ? 'border-purple-500 bg-purple-500/10' 
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="gatewayType"
                    value={gw.id}
                    checked={form.gatewayType === gw.id}
                    onChange={() => setForm({ ...form, gatewayType: gw.id as any })}
                    className="hidden"
                  />
                  <span className="text-2xl">{gw.icon}</span>
                  <div>
                    <div className="text-white font-medium">{gw.name}</div>
                    <div className="text-white/50 text-sm">{gw.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          
          {/* API URL */}
          <div>
            <label className="block text-white/70 text-sm mb-2">API URL</label>
            <input
              type="text"
              value={form.apiUrl}
              onChange={(e) => setForm({ ...form, apiUrl: e.target.value })}
              placeholder="http://192.168.1.100:8080"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-purple-500 focus:outline-none font-mono text-sm"
              required
            />
            <p className="text-white/40 text-xs mt-1">
              IP адрес телефона и порт из приложения SMS Gateway
            </p>
          </div>
          
          {/* API Key (опционально) */}
          <div>
            <label className="block text-white/70 text-sm mb-2">API Key (опционально)</label>
            <input
              type="text"
              value={form.apiKey || ''}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder="Если требуется"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-purple-500 focus:outline-none"
            />
          </div>
          
          {/* Лимит */}
          <div>
            <label className="block text-white/70 text-sm mb-2">
              Лимит SMS в день: {form.dailyLimit}
            </label>
            <input
              type="range"
              min="10"
              max="500"
              step="10"
              value={form.dailyLimit}
              onChange={(e) => setForm({ ...form, dailyLimit: parseInt(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-white/40 text-xs">
              <span>10</span>
              <span>500</span>
            </div>
          </div>
          
          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-all"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-all"
            >
              {device ? 'Сохранить' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

