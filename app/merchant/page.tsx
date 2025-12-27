'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface MerchantRestaurant {
  id: string;
  restaurantId: string;
  restaurant: {
    id: string;
    name: string;
    slug: string;
    address: string;
    rating: number;
    images: string[];
    isActive: boolean;
  };
  role: string;
}

interface OrderStats {
  pending: number;
  confirmed: number;
  preparing: number;
  ready: number;
  total: number;
  todayRevenue: number;
}

export default function MerchantDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<MerchantRestaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(null);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'menu' | 'analytics' | 'settings'>('dashboard');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/merchant');
    } else if (session?.user && (session.user as any).role !== 'merchant' && (session.user as any).role !== 'admin') {
      router.push('/account');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (session?.user) {
      fetchRestaurants();
    }
  }, [session]);

  useEffect(() => {
    if (selectedRestaurant) {
      fetchStats();
      fetchOrders();
    }
  }, [selectedRestaurant]);

  const fetchRestaurants = async () => {
    try {
      const res = await fetch('/api/merchant/restaurants');
      const data = await res.json();
      setRestaurants(data.restaurants || []);
      if (data.restaurants?.length > 0 && !selectedRestaurant) {
        setSelectedRestaurant(data.restaurants[0].restaurantId);
      }
    } catch (error) {
      console.error('Error fetching restaurants:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!selectedRestaurant) return;
    try {
      const res = await fetch(`/api/merchant/stats?restaurantId=${selectedRestaurant}`);
      const data = await res.json();
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchOrders = async () => {
    if (!selectedRestaurant) return;
    try {
      const res = await fetch(`/api/merchant/orders?restaurantId=${selectedRestaurant}`);
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await fetch('/api/merchant/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: newStatus }),
      });
      fetchOrders();
      fetchStats();
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">⏳ Загрузка...</div>
      </div>
    );
  }

  if (!session || restaurants.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">🏪 Кабинет ресторатора</h1>
          <p className="text-white/60 mb-6">У вас нет привязанных ресторанов</p>
          <Link
            href="/account"
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
          >
            Вернуться в личный кабинет
          </Link>
        </div>
      </div>
    );
  }

  const currentRestaurant = restaurants.find((r) => r.restaurantId === selectedRestaurant);

  const statusOptions = [
    { value: 'confirmed', label: '✅ Подтвердить', color: 'bg-blue-600' },
    { value: 'preparing', label: '👨‍🍳 Готовится', color: 'bg-orange-600' },
    { value: 'ready', label: '📦 Готов', color: 'bg-green-600' },
    { value: 'delivered', label: '🚗 Доставлен', color: 'bg-emerald-600' },
    { value: 'cancelled', label: '❌ Отменить', color: 'bg-red-600' },
  ];

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Шапка */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold text-white">
              🍽️ FoodGuide
            </Link>
            <span className="text-white/40">|</span>
            <span className="text-purple-400 font-medium">Кабинет ресторатора</span>
          </div>
          
          {/* Выбор ресторана */}
          <div className="flex items-center gap-4">
            <select
              value={selectedRestaurant || ''}
              onChange={(e) => setSelectedRestaurant(e.target.value)}
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
            >
              {restaurants.map((r) => (
                <option key={r.restaurantId} value={r.restaurantId}>
                  {r.restaurant.name}
                </option>
              ))}
            </select>
            
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Сайдбар */}
        <aside className="w-64 bg-slate-800 min-h-[calc(100vh-57px)] p-4 border-r border-slate-700">
          <nav className="space-y-2">
            {[
              { id: 'dashboard', label: '📊 Дашборд', icon: '📊' },
              { id: 'orders', label: '📦 Заказы', count: stats?.pending },
              { id: 'menu', label: '🍽️ Меню' },
              { id: 'analytics', label: '📈 Аналитика' },
              { id: 'settings', label: '⚙️ Настройки' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full px-4 py-3 rounded-lg text-left flex items-center justify-between transition ${
                  activeTab === item.id
                    ? 'bg-purple-600 text-white'
                    : 'text-white/60 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <span>{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Информация о ресторане */}
          {currentRestaurant && (
            <div className="mt-6 p-4 bg-slate-700/50 rounded-xl">
              {currentRestaurant.restaurant.images?.[0] && (
                <img
                  src={currentRestaurant.restaurant.images[0]}
                  alt=""
                  className="w-full h-24 object-cover rounded-lg mb-3"
                />
              )}
              <h3 className="text-white font-medium text-sm">{currentRestaurant.restaurant.name}</h3>
              <p className="text-white/40 text-xs mt-1">{currentRestaurant.restaurant.address}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-yellow-400 text-sm">⭐ {currentRestaurant.restaurant.rating?.toFixed(1)}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${currentRestaurant.restaurant.isActive ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                  {currentRestaurant.restaurant.isActive ? 'Открыто' : 'Закрыто'}
                </span>
              </div>
            </div>
          )}
        </aside>

        {/* Основной контент */}
        <main className="flex-1 p-6">
          {/* ДАШБОРД */}
          {activeTab === 'dashboard' && (
            <div>
              <h1 className="text-2xl font-bold text-white mb-6">📊 Дашборд</h1>
              
              {/* Статистика */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-yellow-500/20 rounded-xl p-4 border border-yellow-500/30">
                  <div className="text-yellow-400 text-3xl font-bold">{stats?.pending || 0}</div>
                  <div className="text-yellow-300/60 text-sm">Ожидают</div>
                </div>
                <div className="bg-orange-500/20 rounded-xl p-4 border border-orange-500/30">
                  <div className="text-orange-400 text-3xl font-bold">{stats?.preparing || 0}</div>
                  <div className="text-orange-300/60 text-sm">Готовятся</div>
                </div>
                <div className="bg-green-500/20 rounded-xl p-4 border border-green-500/30">
                  <div className="text-green-400 text-3xl font-bold">{stats?.ready || 0}</div>
                  <div className="text-green-300/60 text-sm">Готовы</div>
                </div>
                <div className="bg-purple-500/20 rounded-xl p-4 border border-purple-500/30">
                  <div className="text-purple-400 text-3xl font-bold">
                    {(stats?.todayRevenue || 0).toLocaleString()}
                  </div>
                  <div className="text-purple-300/60 text-sm">Выручка сегодня</div>
                </div>
              </div>

              {/* Последние заказы */}
              <div className="bg-slate-800 rounded-xl border border-slate-700">
                <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                  <h2 className="text-white font-medium">Последние заказы</h2>
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="text-purple-400 text-sm hover:underline"
                  >
                    Все заказы →
                  </button>
                </div>
                <div className="divide-y divide-slate-700">
                  {orders.slice(0, 5).map((order) => (
                    <div key={order.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="text-white font-medium">#{order.orderNumber}</div>
                        <div className="text-white/40 text-sm">{order.customerName} • {order.customerPhone}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-white">{order.total.toLocaleString()} сум</div>
                        <div className="text-white/40 text-xs">
                          {new Date(order.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                  {orders.length === 0 && (
                    <div className="px-4 py-8 text-center text-white/40">
                      Заказов пока нет
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ЗАКАЗЫ */}
          {activeTab === 'orders' && (
            <div>
              <h1 className="text-2xl font-bold text-white mb-6">📦 Заказы</h1>
              
              <div className="space-y-4">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden"
                  >
                    <div className="px-4 py-3 bg-slate-700/50 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-white font-bold">#{order.orderNumber}</span>
                        <span className="text-white/40">
                          {order.orderType === 'delivery' ? '🚗 Доставка' : order.orderType === 'pickup' ? '🏃 Самовывоз' : '📅 Бронь'}
                        </span>
                        <span className="text-white/40 text-sm">
                          {new Date(order.createdAt).toLocaleString('ru-RU')}
                        </span>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                        order.status === 'confirmed' ? 'bg-blue-500/20 text-blue-300' :
                        order.status === 'preparing' ? 'bg-orange-500/20 text-orange-300' :
                        order.status === 'ready' ? 'bg-green-500/20 text-green-300' :
                        order.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-300' :
                        'bg-red-500/20 text-red-300'
                      }`}>
                        {order.status === 'pending' ? '⏳ Ожидает' :
                         order.status === 'confirmed' ? '✅ Подтверждён' :
                         order.status === 'preparing' ? '👨‍🍳 Готовится' :
                         order.status === 'ready' ? '📦 Готов' :
                         order.status === 'delivered' ? '🚗 Доставлен' : '❌ Отменён'}
                      </span>
                    </div>
                    
                    <div className="p-4">
                      <div className="grid md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <div className="text-white/60 text-sm mb-1">Клиент</div>
                          <div className="text-white">{order.customerName}</div>
                          <div className="text-white/60">{order.customerPhone}</div>
                          {order.deliveryAddress && (
                            <div className="text-white/40 text-sm mt-1">📍 {order.deliveryAddress}</div>
                          )}
                        </div>
                        <div>
                          <div className="text-white/60 text-sm mb-1">Заказ</div>
                          <div className="space-y-1">
                            {order.items?.map((item: any, idx: number) => (
                              <div key={idx} className="text-white text-sm">
                                {item.quantity}× {item.name} — {item.price.toLocaleString()} сум
                              </div>
                            ))}
                          </div>
                          <div className="text-white font-bold mt-2">
                            Итого: {order.total.toLocaleString()} сум
                          </div>
                        </div>
                      </div>

                      {/* Кнопки управления */}
                      {order.status !== 'delivered' && order.status !== 'cancelled' && (
                        <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-700">
                          {statusOptions
                            .filter((opt) => {
                              if (order.status === 'pending') return ['confirmed', 'cancelled'].includes(opt.value);
                              if (order.status === 'confirmed') return ['preparing', 'cancelled'].includes(opt.value);
                              if (order.status === 'preparing') return ['ready', 'cancelled'].includes(opt.value);
                              if (order.status === 'ready') return ['delivered', 'cancelled'].includes(opt.value);
                              return false;
                            })
                            .map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => updateOrderStatus(order.id, opt.value)}
                                className={`px-4 py-2 ${opt.color} hover:opacity-80 text-white rounded-lg text-sm`}
                              >
                                {opt.label}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {orders.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-4">📦</div>
                    <p className="text-white/60">Заказов пока нет</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* МЕНЮ */}
          {activeTab === 'menu' && selectedRestaurant && (
            <div>
              <h1 className="text-2xl font-bold text-white mb-6">🍽️ Управление меню</h1>
              <MerchantMenuEditor restaurantId={selectedRestaurant} />
            </div>
          )}

          {/* АНАЛИТИКА */}
          {activeTab === 'analytics' && selectedRestaurant && (
            <div>
              <h1 className="text-2xl font-bold text-white mb-6">📈 Аналитика</h1>
              <MerchantAnalytics restaurantId={selectedRestaurant} />
            </div>
          )}

          {/* НАСТРОЙКИ */}
          {activeTab === 'settings' && selectedRestaurant && (
            <div>
              <h1 className="text-2xl font-bold text-white mb-6">⚙️ Настройки</h1>
              <MerchantSettings restaurantId={selectedRestaurant} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// Компонент редактора меню
function MerchantMenuEditor({ restaurantId }: { restaurantId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState({ name: '', price: '', category: '', description: '' });

  useEffect(() => {
    fetch(`/api/restaurants/${restaurantId}/menu`)
      .then((res) => res.json())
      .then((data) => setItems(data.items || []))
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const addItem = async () => {
    if (!newItem.name) return;
    
    const res = await fetch(`/api/restaurants/${restaurantId}/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem),
    });
    
    if (res.ok) {
      const data = await res.json();
      setItems([...items, data.item]);
      setNewItem({ name: '', price: '', category: '', description: '' });
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!confirm('Удалить позицию?')) return;
    
    await fetch(`/api/restaurants/${restaurantId}/menu?itemId=${itemId}`, {
      method: 'DELETE',
    });
    
    setItems(items.filter((i) => i.id !== itemId));
  };

  if (loading) return <div className="text-white/60">Загрузка...</div>;

  // Группировка по категориям
  const grouped = items.reduce((acc: Record<string, any[]>, item) => {
    const cat = item.category || 'Другое';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div>
      {/* Форма добавления */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-6">
        <h3 className="text-white font-medium mb-4">+ Добавить позицию</h3>
        <div className="grid md:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Название *"
            value={newItem.name}
            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-white/40"
          />
          <input
            type="number"
            placeholder="Цена"
            value={newItem.price}
            onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-white/40"
          />
          <input
            type="text"
            placeholder="Категория"
            value={newItem.category}
            onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-white/40"
          />
          <button
            onClick={addItem}
            disabled={!newItem.name}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50"
          >
            Добавить
          </button>
        </div>
      </div>

      {/* Список позиций */}
      {Object.entries(grouped).map(([category, categoryItems]) => (
        <div key={category} className="mb-6">
          <h3 className="text-white/60 text-sm font-medium mb-3">{category} ({categoryItems.length})</h3>
          <div className="bg-slate-800 rounded-xl border border-slate-700 divide-y divide-slate-700">
            {categoryItems.map((item) => (
              <div key={item.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-white">{item.name}</div>
                  {item.description && (
                    <div className="text-white/40 text-sm">{item.description}</div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-white font-medium">
                    {item.price ? `${item.price.toLocaleString()} сум` : '—'}
                  </span>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {items.length === 0 && (
        <div className="text-center py-12 text-white/40">
          Меню пусто. Добавьте первую позицию выше.
        </div>
      )}
    </div>
  );
}

// Компонент аналитики
function MerchantAnalytics({ restaurantId }: { restaurantId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/analytics/restaurant/${restaurantId}`)
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [restaurantId]);

  if (loading) return <div className="text-white/60">Загрузка аналитики...</div>;

  return (
    <div className="space-y-6">
      {/* Основные метрики */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-2xl font-bold text-white">{data?.stats?.views || 0}</div>
          <div className="text-white/60 text-sm">Просмотры (30 дней)</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-2xl font-bold text-white">{data?.stats?.cardViews || 0}</div>
          <div className="text-white/60 text-sm">Открытий карточки</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-2xl font-bold text-white">{data?.stats?.calls || 0}</div>
          <div className="text-white/60 text-sm">Звонков</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-2xl font-bold text-white">{data?.stats?.orders || 0}</div>
          <div className="text-white/60 text-sm">Заказов</div>
        </div>
      </div>

      {/* Рекомендации */}
      {data?.recommendations?.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <h3 className="text-white font-medium mb-4">💡 Рекомендации</h3>
          <div className="space-y-3">
            {data.recommendations.map((rec: any, idx: number) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-slate-700/50 rounded-lg">
                <span className="text-xl">{rec.icon || '💡'}</span>
                <div>
                  <div className="text-white">{rec.title}</div>
                  <div className="text-white/60 text-sm">{rec.description}</div>
                  {rec.impact && (
                    <div className="text-green-400 text-sm mt-1">{rec.impact}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Компонент настроек
function MerchantSettings({ restaurantId }: { restaurantId: string }) {
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/merchant/settings?restaurantId=${restaurantId}`)
      .then((res) => res.json())
      .then((data) => setSettings(data.settings || {}))
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await fetch('/api/merchant/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, settings }),
      });
      alert('✅ Настройки сохранены');
    } catch {
      alert('❌ Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-white/60">Загрузка настроек...</div>;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Доставка */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <h3 className="text-white font-medium mb-4">🚗 Доставка</h3>
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.deliveryEnabled ?? true}
              onChange={(e) => setSettings({ ...settings, deliveryEnabled: e.target.checked })}
              className="w-5 h-5 rounded"
            />
            <span className="text-white">Доставка включена</span>
          </label>
          
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="text-white/60 text-sm block mb-1">Минимальный заказ</label>
              <input
                type="number"
                value={settings.deliveryMinOrder || ''}
                onChange={(e) => setSettings({ ...settings, deliveryMinOrder: e.target.value })}
                placeholder="50000"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="text-white/60 text-sm block mb-1">Стоимость доставки</label>
              <input
                type="number"
                value={settings.deliveryFee || ''}
                onChange={(e) => setSettings({ ...settings, deliveryFee: e.target.value })}
                placeholder="15000"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="text-white/60 text-sm block mb-1">Время доставки</label>
              <input
                type="text"
                value={settings.deliveryTime || ''}
                onChange={(e) => setSettings({ ...settings, deliveryTime: e.target.value })}
                placeholder="30-45 мин"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Уведомления */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <h3 className="text-white font-medium mb-4">🔔 Уведомления о заказах</h3>
        <div className="space-y-3">
          <div>
            <label className="text-white/60 text-sm block mb-1">Телефон для SMS</label>
            <input
              type="tel"
              value={settings.orderNotifyPhone || ''}
              onChange={(e) => setSettings({ ...settings, orderNotifyPhone: e.target.value })}
              placeholder="+998 90 123 45 67"
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="text-white/60 text-sm block mb-1">Email</label>
            <input
              type="email"
              value={settings.orderNotifyEmail || ''}
              onChange={(e) => setSettings({ ...settings, orderNotifyEmail: e.target.value })}
              placeholder="orders@restaurant.uz"
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="text-white/60 text-sm block mb-1">Telegram (chat_id)</label>
            <input
              type="text"
              value={settings.orderNotifyTelegram || ''}
              onChange={(e) => setSettings({ ...settings, orderNotifyTelegram: e.target.value })}
              placeholder="123456789"
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
            />
          </div>
        </div>
      </div>

      <button
        onClick={saveSettings}
        disabled={saving}
        className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl disabled:opacity-50"
      >
        {saving ? 'Сохранение...' : '💾 Сохранить настройки'}
      </button>
    </div>
  );
}

