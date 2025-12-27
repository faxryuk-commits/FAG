'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ImportPage() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [source, setSource] = useState('amocrm');

  const handleImport = async () => {
    setImporting(true);
    setResult(null);
    
    try {
      const res = await fetch('/api/crm/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });
      
      const data = await res.json();
      setResult(data);
    } catch (error) {
      setResult({ error: 'Import failed' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/crm" className="text-white/60 hover:text-white transition-colors">
              ← Назад в CRM
            </Link>
            <h1 className="text-2xl font-bold text-white">📥 Импорт лидов</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white/5 border border-white/10 rounded-xl p-8">
          <h2 className="text-xl font-bold text-white mb-6">Источники данных</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <button
              onClick={() => setSource('amocrm')}
              className={`p-6 rounded-xl border-2 transition-all ${
                source === 'amocrm' 
                  ? 'border-purple-500 bg-purple-500/20' 
                  : 'border-white/10 hover:border-white/30'
              }`}
            >
              <div className="text-4xl mb-3">📊</div>
              <div className="text-lg font-bold text-white">AmoCRM</div>
              <div className="text-sm text-white/60">Excel экспорт</div>
            </button>
            
            <button
              onClick={() => setSource('google_maps')}
              className={`p-6 rounded-xl border-2 transition-all ${
                source === 'google_maps' 
                  ? 'border-purple-500 bg-purple-500/20' 
                  : 'border-white/10 hover:border-white/30'
              }`}
            >
              <div className="text-4xl mb-3">🗺️</div>
              <div className="text-lg font-bold text-white">Google Maps</div>
              <div className="text-sm text-white/60">База ресторанов</div>
            </button>
            
            <button
              onClick={() => setSource('manual')}
              className={`p-6 rounded-xl border-2 transition-all ${
                source === 'manual' 
                  ? 'border-purple-500 bg-purple-500/20' 
                  : 'border-white/10 hover:border-white/30'
              }`}
            >
              <div className="text-4xl mb-3">✏️</div>
              <div className="text-lg font-bold text-white">Вручную</div>
              <div className="text-sm text-white/60">Добавить лида</div>
            </button>
          </div>

          {source === 'amocrm' && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <div className="font-medium text-yellow-400">Файл AmoCRM готов к импорту</div>
                  <div className="text-sm text-white/60 mt-1">
                    Найден файл: <code className="bg-white/10 px-2 py-0.5 rounded">amocrm_export_contacts_2025-12-27.xlsx</code>
                  </div>
                  <div className="text-sm text-white/60">~887 контактов будут импортированы</div>
                </div>
              </div>
            </div>
          )}

          {source === 'google_maps' && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🏪</span>
                <div>
                  <div className="font-medium text-blue-400">Конвертация ресторанов в лиды</div>
                  <div className="text-sm text-white/60 mt-1">
                    2945 ресторанов из базы будут преобразованы в лиды CRM
                  </div>
                  <div className="text-sm text-white/60">Только активные, не архивированные</div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={importing}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-medium text-lg disabled:opacity-50 transition-all"
          >
            {importing ? (
              <span className="flex items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                Импортируем...
              </span>
            ) : (
              '🚀 Запустить импорт'
            )}
          </button>

          {result && (
            <div className={`mt-6 p-6 rounded-xl border ${
              result.error 
                ? 'bg-red-500/10 border-red-500/30' 
                : 'bg-green-500/10 border-green-500/30'
            }`}>
              {result.error ? (
                <div className="text-red-400">
                  <div className="text-lg font-bold mb-2">❌ Ошибка импорта</div>
                  <div>{result.error}</div>
                </div>
              ) : (
                <div className="text-green-400">
                  <div className="text-lg font-bold mb-4">✅ Импорт завершён!</div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-white/60">Импортировано:</span>
                      <span className="ml-2 font-bold">{result.imported}</span>
                    </div>
                    <div>
                      <span className="text-white/60">Пропущено:</span>
                      <span className="ml-2 font-bold">{result.skipped}</span>
                    </div>
                    <div>
                      <span className="text-white/60">Ошибок:</span>
                      <span className="ml-2 font-bold">{result.errors}</span>
                    </div>
                    <div>
                      <span className="text-white/60">Время:</span>
                      <span className="ml-2 font-bold">{result.duration}с</span>
                    </div>
                  </div>
                  
                  <Link 
                    href="/crm"
                    className="mt-4 inline-block px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-medium text-white transition-all"
                  >
                    Перейти к лидам →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Manual Lead Form */}
        {source === 'manual' && (
          <ManualLeadForm />
        )}
      </main>
    </div>
  );
}

function ManualLeadForm() {
  const [lead, setLead] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    telegram: '',
    segment: 'warm',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const res = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
      });
      
      if (res.ok) {
        setSaved(true);
        setLead({ name: '', company: '', phone: '', email: '', telegram: '', segment: 'warm' });
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error('Error saving lead:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-8 bg-white/5 border border-white/10 rounded-xl p-8">
      <h2 className="text-xl font-bold text-white mb-6">✏️ Добавить лида вручную</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-white/60 text-sm mb-2">Имя *</label>
            <input
              type="text"
              value={lead.name}
              onChange={(e) => setLead({ ...lead, name: e.target.value })}
              required
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
              placeholder="Имя контакта"
            />
          </div>
          <div>
            <label className="block text-white/60 text-sm mb-2">Компания</label>
            <input
              type="text"
              value={lead.company}
              onChange={(e) => setLead({ ...lead, company: e.target.value })}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
              placeholder="Название ресторана"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-white/60 text-sm mb-2">Телефон</label>
            <input
              type="tel"
              value={lead.phone}
              onChange={(e) => setLead({ ...lead, phone: e.target.value })}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
              placeholder="+998 90 123 45 67"
            />
          </div>
          <div>
            <label className="block text-white/60 text-sm mb-2">Email</label>
            <input
              type="email"
              value={lead.email}
              onChange={(e) => setLead({ ...lead, email: e.target.value })}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="block text-white/60 text-sm mb-2">Telegram</label>
            <input
              type="text"
              value={lead.telegram}
              onChange={(e) => setLead({ ...lead, telegram: e.target.value })}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
              placeholder="@username"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-white/60 text-sm mb-2">Сегмент</label>
          <select
            value={lead.segment}
            onChange={(e) => setLead({ ...lead, segment: e.target.value })}
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
          >
            <option value="hot">🔥 Hot</option>
            <option value="warm">☀️ Warm</option>
            <option value="cold">❄️ Cold</option>
            <option value="enterprise">🏢 Enterprise</option>
          </select>
        </div>
        
        <button
          type="submit"
          disabled={saving || !lead.name}
          className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg font-medium disabled:opacity-50 transition-all"
        >
          {saving ? 'Сохраняем...' : saved ? '✅ Сохранено!' : 'Добавить лида'}
        </button>
      </form>
    </div>
  );
}

