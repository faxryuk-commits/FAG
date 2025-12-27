'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

export default function ImportPage() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [source, setSource] = useState('amocrm');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setResult(null);
    
    try {
      if (source === 'amocrm') {
        if (!file) {
          setResult({ error: 'Выберите файл Excel для импорта' });
          setImporting(false);
          return;
        }
        
        // Загружаем файл через FormData
        const formData = new FormData();
        formData.append('file', file);
        formData.append('source', 'amocrm');
        
        const res = await fetch('/api/crm/import/upload', {
          method: 'POST',
          body: formData,
        });
        
        const data = await res.json();
        setResult(data);
      } else {
        // Для других источников - обычный JSON запрос
        const res = await fetch('/api/crm/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source }),
        });
        
        const data = await res.json();
        setResult(data);
      }
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
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-6 mb-6">
              <div className="flex items-start gap-4">
                <span className="text-3xl">📊</span>
                <div className="flex-1">
                  <div className="font-medium text-purple-400 mb-3">Загрузите Excel файл из AmoCRM</div>
                  
                  {/* File Upload */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                  />
                  
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                      file 
                        ? 'border-green-500/50 bg-green-500/10' 
                        : 'border-white/20 hover:border-purple-500/50 hover:bg-white/5'
                    }`}
                  >
                    {file ? (
                      <div>
                        <div className="text-4xl mb-2">✅</div>
                        <div className="text-white font-medium">{file.name}</div>
                        <div className="text-white/50 text-sm mt-1">
                          {(file.size / 1024).toFixed(1)} KB • Нажмите чтобы выбрать другой
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-4xl mb-2">📁</div>
                        <div className="text-white">Нажмите или перетащите файл</div>
                        <div className="text-white/50 text-sm mt-1">
                          Поддерживаемые форматы: .xlsx, .xls, .csv
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4 text-sm text-white/50">
                    💡 <strong>Как получить файл:</strong> AmoCRM → Контакты → Экспорт → Excel
                  </div>
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
                  {result.details && (
                    <div className="mt-2 text-sm text-white/50 bg-white/5 p-3 rounded font-mono">
                      {result.details}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-green-400">
                  <div className="text-lg font-bold mb-4">✅ Импорт завершён!</div>
                  
                  {/* Основная статистика */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                    <div className="bg-white/5 rounded-lg p-3">
                      <div className="text-white/50 text-xs">Новых</div>
                      <div className="text-2xl font-bold text-green-400">{result.imported}</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <div className="text-white/50 text-xs">Обновлено</div>
                      <div className="text-2xl font-bold text-blue-400">{result.updated || 0}</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <div className="text-white/50 text-xs">Пропущено</div>
                      <div className="text-2xl font-bold text-yellow-400">{result.skipped}</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <div className="text-white/50 text-xs">Ошибок</div>
                      <div className="text-2xl font-bold text-red-400">{result.errors}</div>
                    </div>
                  </div>
                  
                  {/* Статистика по телефонам */}
                  {(result.mobilePhones !== undefined || result.landlinePhones !== undefined) && (
                    <div className="bg-white/5 rounded-lg p-4 mb-4">
                      <div className="text-white/60 text-sm mb-2">📱 Статистика телефонов:</div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span>📱</span>
                          <span className="text-white">Мобильных: <strong>{result.mobilePhones || 0}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>☎️</span>
                          <span className="text-yellow-400">Стационарных: <strong>{result.landlinePhones || 0}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>❌</span>
                          <span className="text-white/50">Без телефона: <strong>{result.noPhone || 0}</strong></span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="text-white/50 text-sm mb-4">
                    Время: {result.duration}с • Всего строк: {result.total}
                  </div>
                  
                  <Link 
                    href="/crm"
                    className="inline-block px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg font-medium text-white transition-all"
                  >
                    🎯 Перейти к лидам →
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

