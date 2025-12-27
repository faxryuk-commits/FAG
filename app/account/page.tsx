'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface OrderSummary {
  id: string;
  orderNumber: string;
  restaurantName: string;
  status: string;
  total: number;
  orderType: string;
  createdAt: string;
}

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'favorites' | 'addresses' | 'settings'>('orders');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/account');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetchOrders();
    }
  }, [session]);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/account/orders');
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">⏳ Загрузка...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const user = session.user as any;

  const statusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: '⏳ Ожидает', color: 'bg-yellow-500' },
    confirmed: { label: '✅ Подтверждён', color: 'bg-blue-500' },
    preparing: { label: '👨‍🍳 Готовится', color: 'bg-orange-500' },
    ready: { label: '📦 Готов', color: 'bg-green-500' },
    delivered: { label: '🚗 Доставлен', color: 'bg-emerald-500' },
    cancelled: { label: '❌ Отменён', color: 'bg-red-500' },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Шапка */}
      <header className="border-b border-white/10 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-white">
            🍽️ FoodGuide
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-white/60">{user.name || user.email}</span>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Приветствие */}
        <div className="bg-white/5 rounded-2xl p-6 mb-8 border border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-2xl">
              {user.name?.[0]?.toUpperCase() || '👤'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{user.name || 'Пользователь'}</h1>
              <p className="text-white/60">{user.email || user.phone}</p>
              {user.role === 'merchant' && (
                <Link href="/merchant" className="text-purple-400 text-sm hover:underline">
                  → Кабинет ресторатора
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Табы */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'orders', label: '📦 Заказы', count: orders.length },
            { id: 'favorites', label: '❤️ Избранное' },
            { id: 'addresses', label: '📍 Адреса' },
            { id: 'settings', label: '⚙️ Настройки' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {tab.label} {tab.count !== undefined && `(${tab.count})`}
            </button>
          ))}
        </div>

        {/* Контент табов */}
        <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
          {/* ЗАКАЗЫ */}
          {activeTab === 'orders' && (
            <div className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">История заказов</h2>
              
              {loading ? (
                <div className="text-white/60 text-center py-8">Загрузка...</div>
              ) : orders.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">🛒</div>
                  <p className="text-white/60 mb-4">У вас пока нет заказов</p>
                  <Link
                    href="/"
                    className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
                  >
                    Выбрать ресторан
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-white/20 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-medium">{order.restaurantName}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs text-white ${
                                statusLabels[order.status]?.color || 'bg-gray-500'
                              }`}
                            >
                              {statusLabels[order.status]?.label || order.status}
                            </span>
                          </div>
                          <p className="text-white/60 text-sm">
                            Заказ #{order.orderNumber} • {order.orderType === 'delivery' ? '🚗 Доставка' : order.orderType === 'pickup' ? '🏃 Самовывоз' : '📅 Бронь'}
                          </p>
                          <p className="text-white/40 text-xs mt-1">
                            {new Date(order.createdAt).toLocaleString('ru-RU')}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-white font-bold">
                            {order.total.toLocaleString()} сум
                          </div>
                          <Link
                            href={`/account/orders/${order.id}`}
                            className="text-purple-400 text-sm hover:underline"
                          >
                            Подробнее →
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ИЗБРАННОЕ */}
          {activeTab === 'favorites' && (
            <div className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">Избранные рестораны</h2>
              <FavoritesTab userId={user.id} />
            </div>
          )}

          {/* АДРЕСА */}
          {activeTab === 'addresses' && (
            <div className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">Адреса доставки</h2>
              <AddressesTab userId={user.id} />
            </div>
          )}

          {/* НАСТРОЙКИ */}
          {activeTab === 'settings' && (
            <div className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">Настройки профиля</h2>
              <SettingsTab user={user} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Компонент избранного
function FavoritesTab({ userId }: { userId: string }) {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/account/favorites')
      .then((res) => res.json())
      .then((data) => setFavorites(data.favorites || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-white/60">Загрузка...</div>;

  if (favorites.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">❤️</div>
        <p className="text-white/60 mb-4">У вас пока нет избранных ресторанов</p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
        >
          Найти рестораны
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {favorites.map((fav: any) => (
        <Link
          key={fav.id}
          href={`/restaurants/${fav.restaurant?.slug}`}
          className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-purple-500/50 transition"
        >
          <div className="flex gap-4">
            {fav.restaurant?.images?.[0] && (
              <img
                src={fav.restaurant.images[0]}
                alt=""
                className="w-20 h-20 object-cover rounded-lg"
              />
            )}
            <div>
              <h3 className="text-white font-medium">{fav.restaurant?.name}</h3>
              <p className="text-white/60 text-sm">{fav.restaurant?.address}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-yellow-400">⭐ {fav.restaurant?.rating?.toFixed(1)}</span>
                <span className="text-white/40 text-sm">{fav.restaurant?.cuisine?.join(', ')}</span>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// Компонент адресов
function AddressesTab({ userId }: { userId: string }) {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newAddress, setNewAddress] = useState({
    title: '',
    address: '',
    entrance: '',
    floor: '',
    apartment: '',
    comment: '',
  });

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = () => {
    fetch('/api/account/addresses')
      .then((res) => res.json())
      .then((data) => setAddresses(data.addresses || []))
      .finally(() => setLoading(false));
  };

  const saveAddress = async () => {
    if (!newAddress.title || !newAddress.address) return;
    
    await fetch('/api/account/addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAddress),
    });
    
    setShowForm(false);
    setNewAddress({ title: '', address: '', entrance: '', floor: '', apartment: '', comment: '' });
    fetchAddresses();
  };

  const deleteAddress = async (id: string) => {
    if (!confirm('Удалить адрес?')) return;
    await fetch(`/api/account/addresses?id=${id}`, { method: 'DELETE' });
    fetchAddresses();
  };

  if (loading) return <div className="text-white/60">Загрузка...</div>;

  return (
    <div>
      {/* Список адресов */}
      {addresses.length > 0 && (
        <div className="space-y-3 mb-4">
          {addresses.map((addr: any) => (
            <div
              key={addr.id}
              className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-start justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{addr.title}</span>
                  {addr.isDefault && (
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded-full">
                      По умолчанию
                    </span>
                  )}
                </div>
                <p className="text-white/60 text-sm mt-1">{addr.address}</p>
                {(addr.entrance || addr.floor || addr.apartment) && (
                  <p className="text-white/40 text-xs mt-1">
                    {[
                      addr.entrance && `Подъезд ${addr.entrance}`,
                      addr.floor && `Этаж ${addr.floor}`,
                      addr.apartment && `Кв. ${addr.apartment}`,
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </p>
                )}
              </div>
              <button
                onClick={() => deleteAddress(addr.id)}
                className="text-red-400 hover:text-red-300 p-2"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Форма добавления */}
      {showForm ? (
        <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-3">
          <input
            type="text"
            placeholder="Название (Дом, Работа...)"
            value={newAddress.title}
            onChange={(e) => setNewAddress({ ...newAddress, title: e.target.value })}
            className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40"
          />
          <input
            type="text"
            placeholder="Адрес"
            value={newAddress.address}
            onChange={(e) => setNewAddress({ ...newAddress, address: e.target.value })}
            className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="Подъезд"
              value={newAddress.entrance}
              onChange={(e) => setNewAddress({ ...newAddress, entrance: e.target.value })}
              className="px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40"
            />
            <input
              type="text"
              placeholder="Этаж"
              value={newAddress.floor}
              onChange={(e) => setNewAddress({ ...newAddress, floor: e.target.value })}
              className="px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40"
            />
            <input
              type="text"
              placeholder="Квартира"
              value={newAddress.apartment}
              onChange={(e) => setNewAddress({ ...newAddress, apartment: e.target.value })}
              className="px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40"
            />
          </div>
          <textarea
            placeholder="Комментарий курьеру"
            value={newAddress.comment}
            onChange={(e) => setNewAddress({ ...newAddress, comment: e.target.value })}
            className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={saveAddress}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
            >
              Сохранить
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 border-2 border-dashed border-white/20 hover:border-purple-500/50 rounded-xl text-white/60 hover:text-white transition"
        >
          + Добавить адрес
        </button>
      )}
    </div>
  );
}

// Компонент настроек
function SettingsTab({ user }: { user: any }) {
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const saveSettings = async () => {
    setSaving(true);
    setMessage('');
    
    try {
      const res = await fetch('/api/account/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      });
      
      if (res.ok) {
        setMessage('✅ Сохранено');
      } else {
        setMessage('❌ Ошибка сохранения');
      }
    } catch {
      setMessage('❌ Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md space-y-4">
      <div>
        <label className="block text-white/60 text-sm mb-2">Имя</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40"
        />
      </div>
      
      <div>
        <label className="block text-white/60 text-sm mb-2">Email</label>
        <input
          type="email"
          value={user.email || ''}
          disabled
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white/40"
        />
      </div>
      
      <div>
        <label className="block text-white/60 text-sm mb-2">Телефон</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40"
        />
      </div>

      {message && (
        <div className="text-sm">{message}</div>
      )}

      <button
        onClick={saveSettings}
        disabled={saving}
        className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition disabled:opacity-50"
      >
        {saving ? 'Сохранение...' : 'Сохранить'}
      </button>
    </div>
  );
}

