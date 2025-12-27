'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (!email && !phone) {
      setError('Введите email или телефон');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Ошибка регистрации');
        return;
      }

      // Автоматический вход после регистрации
      const result = await signIn('credentials', {
        login: email || phone,
        password,
        redirect: false,
      });

      if (result?.error) {
        router.push('/auth/login');
      } else {
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      setError('Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Логотип */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-bold text-white">🍽️ FoodGuide</h1>
          </Link>
          <p className="text-white/60 mt-2">Создайте аккаунт</p>
        </div>

        {/* Форма */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Ваше имя *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Иван Иванов"
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500 transition"
                required
              />
            </div>

            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500 transition"
              />
            </div>

            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Телефон
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500 transition"
              />
            </div>

            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Пароль *
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500 transition"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Подтвердите пароль *
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повторите пароль"
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500 transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? '⏳ Регистрация...' : '🚀 Зарегистрироваться'}
            </button>
          </form>

          {/* Ссылка на вход */}
          <p className="text-center text-white/60 mt-6">
            Уже есть аккаунт?{' '}
            <Link href="/auth/login" className="text-purple-400 hover:text-purple-300">
              Войти
            </Link>
          </p>
        </div>

        {/* Ссылка на главную */}
        <p className="text-center mt-6">
          <Link href="/" className="text-white/40 hover:text-white/60 text-sm">
            ← Вернуться на главную
          </Link>
        </p>
      </div>
    </div>
  );
}

