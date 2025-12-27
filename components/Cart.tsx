'use client';

import { useState } from 'react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

interface CartProps {
  restaurantId: string;
  restaurantName: string;
  items: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  theme: 'dark' | 'light';
}

type OrderType = 'delivery' | 'pickup' | 'reservation';

// Получение куки
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

export default function Cart({
  restaurantId,
  restaurantName,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  theme,
}: CartProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>('delivery');
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{ orderNumber: string; message: string } | null>(null);
  
  // Форма
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    deliveryAddress: '',
    deliveryNotes: '',
    reservationDate: '',
    reservationTime: '',
    guestsCount: 2,
    pickupTime: '',
    paymentMethod: 'cash',
  });

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = orderType === 'delivery' ? 15000 : 0;
  const total = subtotal + deliveryFee;
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleSubmitOrder = async () => {
    // Валидация
    if (!form.customerName || !form.customerPhone) {
      alert('Укажите имя и телефон');
      return;
    }
    
    if (orderType === 'delivery' && !form.deliveryAddress) {
      alert('Укажите адрес доставки');
      return;
    }
    
    if (orderType === 'reservation' && (!form.reservationDate || !form.reservationTime)) {
      alert('Укажите дату и время бронирования');
      return;
    }

    setSubmitting(true);
    
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          orderType,
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          customerEmail: form.customerEmail,
          deliveryAddress: form.deliveryAddress,
          deliveryNotes: form.deliveryNotes,
          reservationDate: form.reservationDate,
          reservationTime: form.reservationTime,
          guestsCount: form.guestsCount,
          pickupTime: form.pickupTime,
          paymentMethod: form.paymentMethod,
          items: items.map(item => ({
            menuItemId: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            notes: item.notes,
          })),
          visitorId: getCookie('_fag_vid'),
          sessionId: getCookie('_fag_sid'),
        }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setOrderSuccess({
          orderNumber: data.order.orderNumber,
          message: data.message,
        });
        onClearCart();
      } else {
        alert(data.error || 'Ошибка при оформлении заказа');
      }
    } catch (error) {
      alert('Не удалось оформить заказ. Попробуйте позже.');
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0 && !orderSuccess) return null;

  const bgColor = theme === 'dark' ? 'bg-[#1a1a2e]' : 'bg-white';
  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const mutedColor = theme === 'dark' ? 'text-white/60' : 'text-gray-500';
  const borderColor = theme === 'dark' ? 'border-white/10' : 'border-gray-200';

  // Успешный заказ
  if (orderSuccess) {
    return (
      <div className={`fixed bottom-0 left-0 right-0 z-50 ${bgColor} border-t ${borderColor} p-4 shadow-2xl`}>
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-4xl mb-2">✅</div>
          <h3 className={`text-xl font-bold mb-1 ${textColor}`}>{orderSuccess.message}</h3>
          <p className={`${mutedColor} mb-4`}>Номер заказа: <span className="font-mono font-bold">{orderSuccess.orderNumber}</span></p>
          <button
            onClick={() => setOrderSuccess(null)}
            className="px-6 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600"
          >
            Хорошо
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Floating Cart Button (collapsed) */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-green-500 text-white rounded-2xl shadow-lg hover:bg-green-600 transition-all"
        >
          <span className="text-xl">🛒</span>
          <span className="font-bold">{totalItems}</span>
          <span className="font-medium">{total.toLocaleString()} сум</span>
        </button>
      )}

      {/* Expanded Cart */}
      {isExpanded && (
        <div className={`fixed bottom-0 left-0 right-0 z-50 ${bgColor} border-t ${borderColor} shadow-2xl max-h-[70vh] overflow-hidden flex flex-col`}>
          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-3 border-b ${borderColor}`}>
            <div className="flex items-center gap-2">
              <span className="text-xl">🛒</span>
              <span className={`font-bold ${textColor}`}>Корзина</span>
              <span className={mutedColor}>({totalItems})</span>
            </div>
            <button onClick={() => setIsExpanded(false)} className={`p-2 ${mutedColor} hover:${textColor}`}>
              ✕
            </button>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {items.map(item => (
              <div key={item.id} className={`flex items-center gap-3 p-2 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                <div className="flex-1">
                  <div className={`font-medium ${textColor}`}>{item.name}</div>
                  <div className={`text-sm ${mutedColor}`}>{item.price.toLocaleString()} сум</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                    className={`w-8 h-8 rounded-lg ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'} ${textColor}`}
                  >
                    −
                  </button>
                  <span className={`w-8 text-center font-bold ${textColor}`}>{item.quantity}</span>
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    className="w-8 h-8 rounded-lg bg-green-500 text-white"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="p-2 text-red-400 hover:bg-red-500/20 rounded"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className={`p-4 border-t ${borderColor} space-y-3`}>
            <div className="flex justify-between items-center">
              <span className={mutedColor}>Итого:</span>
              <span className={`text-2xl font-bold ${textColor}`}>{total.toLocaleString()} сум</span>
            </div>
            <button
              onClick={() => setShowOrderModal(true)}
              className="w-full py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors"
            >
              Оформить заказ
            </button>
          </div>
        </div>
      )}

      {/* Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className={`${bgColor} rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between p-4 border-b ${borderColor}`}>
              <h3 className={`text-xl font-bold ${textColor}`}>Оформление заказа</h3>
              <button onClick={() => setShowOrderModal(false)} className={`p-2 ${mutedColor}`}>✕</button>
            </div>

            <div className="p-4 space-y-4">
              {/* Order Type */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${mutedColor}`}>Тип заказа</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'delivery', label: '🚗 Доставка', color: 'green' },
                    { id: 'pickup', label: '🏃 Самовывоз', color: 'blue' },
                    { id: 'reservation', label: '📅 Бронь', color: 'purple' },
                  ].map(type => (
                    <button
                      key={type.id}
                      onClick={() => setOrderType(type.id as OrderType)}
                      className={`p-3 rounded-xl text-sm font-medium transition-colors ${
                        orderType === type.id
                          ? `bg-${type.color}-500 text-white`
                          : theme === 'dark' ? 'bg-white/10 text-white/70' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm mb-1 ${mutedColor}`}>Имя *</label>
                  <input
                    type="text"
                    value={form.customerName}
                    onChange={e => setForm(p => ({ ...p, customerName: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'} border-0`}
                    placeholder="Ваше имя"
                  />
                </div>
                <div>
                  <label className={`block text-sm mb-1 ${mutedColor}`}>Телефон *</label>
                  <input
                    type="tel"
                    value={form.customerPhone}
                    onChange={e => setForm(p => ({ ...p, customerPhone: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'} border-0`}
                    placeholder="+998 90 123 45 67"
                  />
                </div>
              </div>

              {/* Delivery Address */}
              {orderType === 'delivery' && (
                <>
                  <div>
                    <label className={`block text-sm mb-1 ${mutedColor}`}>Адрес доставки *</label>
                    <textarea
                      value={form.deliveryAddress}
                      onChange={e => setForm(p => ({ ...p, deliveryAddress: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'} border-0`}
                      rows={2}
                      placeholder="Улица, дом, квартира"
                    />
                  </div>
                  <div>
                    <label className={`block text-sm mb-1 ${mutedColor}`}>Комментарий к доставке</label>
                    <input
                      type="text"
                      value={form.deliveryNotes}
                      onChange={e => setForm(p => ({ ...p, deliveryNotes: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'} border-0`}
                      placeholder="Код домофона, подъезд..."
                    />
                  </div>
                </>
              )}

              {/* Pickup Time */}
              {orderType === 'pickup' && (
                <div>
                  <label className={`block text-sm mb-1 ${mutedColor}`}>Время самовывоза</label>
                  <input
                    type="time"
                    value={form.pickupTime}
                    onChange={e => setForm(p => ({ ...p, pickupTime: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'} border-0`}
                  />
                </div>
              )}

              {/* Reservation */}
              {orderType === 'reservation' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-sm mb-1 ${mutedColor}`}>Дата *</label>
                      <input
                        type="date"
                        value={form.reservationDate}
                        onChange={e => setForm(p => ({ ...p, reservationDate: e.target.value }))}
                        className={`w-full px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'} border-0`}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm mb-1 ${mutedColor}`}>Время *</label>
                      <input
                        type="time"
                        value={form.reservationTime}
                        onChange={e => setForm(p => ({ ...p, reservationTime: e.target.value }))}
                        className={`w-full px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'} border-0`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-sm mb-1 ${mutedColor}`}>Количество гостей</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={form.guestsCount}
                      onChange={e => setForm(p => ({ ...p, guestsCount: parseInt(e.target.value) || 2 }))}
                      className={`w-full px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'} border-0`}
                    />
                  </div>
                </>
              )}

              {/* Payment Method */}
              {orderType !== 'reservation' && (
                <div>
                  <label className={`block text-sm mb-1 ${mutedColor}`}>Способ оплаты</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'cash', label: '💵 Наличные' },
                      { id: 'card', label: '💳 Картой' },
                    ].map(method => (
                      <button
                        key={method.id}
                        onClick={() => setForm(p => ({ ...p, paymentMethod: method.id }))}
                        className={`p-3 rounded-lg text-sm ${
                          form.paymentMethod === method.id
                            ? 'bg-green-500 text-white'
                            : theme === 'dark' ? 'bg-white/10 text-white/70' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {method.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                <div className="flex justify-between mb-1">
                  <span className={mutedColor}>Товары ({totalItems})</span>
                  <span className={textColor}>{subtotal.toLocaleString()} сум</span>
                </div>
                {orderType === 'delivery' && (
                  <div className="flex justify-between mb-1">
                    <span className={mutedColor}>Доставка</span>
                    <span className={textColor}>{deliveryFee.toLocaleString()} сум</span>
                  </div>
                )}
                <div className={`flex justify-between pt-2 border-t ${borderColor}`}>
                  <span className={`font-bold ${textColor}`}>Итого</span>
                  <span className={`font-bold text-lg ${textColor}`}>{total.toLocaleString()} сум</span>
                </div>
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmitOrder}
                disabled={submitting}
                className="w-full py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                {submitting ? '⏳ Оформление...' : 
                  orderType === 'delivery' ? '🚗 Заказать доставку' :
                  orderType === 'pickup' ? '🏃 Оформить самовывоз' :
                  '📅 Забронировать'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

