/**
 * Типы интеграций
 */

export type IntegrationType = 'pos' | 'payment' | 'delivery' | 'fiscal' | 'crm' | 'marketing';

export interface IntegrationProvider {
  type: IntegrationType;
  provider: string;
  name: string;
  description: string;
  logo?: string;
  docsUrl?: string;
  supportedEvents: string[];
  configSchema: ConfigField[];
}

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'boolean' | 'select';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  description?: string;
}

// Стандартные события
export const INTEGRATION_EVENTS = {
  // Заказы
  ORDER_CREATED: 'order.created',
  ORDER_CONFIRMED: 'order.confirmed',
  ORDER_PREPARING: 'order.preparing',
  ORDER_READY: 'order.ready',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_PAID: 'order.paid',
  
  // Меню
  MENU_SYNC: 'menu.sync',
  MENU_ITEM_CREATED: 'menu.item.created',
  MENU_ITEM_UPDATED: 'menu.item.updated',
  MENU_ITEM_DELETED: 'menu.item.deleted',
  
  // Платежи
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',
  
  // Доставка
  DELIVERY_ASSIGNED: 'delivery.assigned',
  DELIVERY_PICKED_UP: 'delivery.picked_up',
  DELIVERY_IN_TRANSIT: 'delivery.in_transit',
  DELIVERY_COMPLETED: 'delivery.completed',
  
  // Фискализация
  RECEIPT_CREATED: 'receipt.created',
  RECEIPT_SENT: 'receipt.sent',
};

// Интерфейс для адаптера интеграции
export interface IntegrationAdapter {
  // Инициализация
  init(credentials: Record<string, any>, config: Record<string, any>): Promise<void>;
  
  // Проверка подключения
  testConnection(): Promise<{ success: boolean; error?: string }>;
  
  // Синхронизация меню (для POS)
  syncMenu?(): Promise<{ items: any[]; categories: any[] }>;
  
  // Отправка заказа (для POS)
  pushOrder?(order: any): Promise<{ externalId: string; success: boolean }>;
  
  // Создание платежа (для Payment)
  createPayment?(amount: number, orderId: string, returnUrl: string): Promise<{ paymentUrl: string; transactionId: string }>;
  
  // Проверка статуса платежа
  checkPayment?(transactionId: string): Promise<{ status: string; paid: boolean }>;
  
  // Создание заявки на доставку (для Delivery)
  createDelivery?(order: any): Promise<{ deliveryId: string; trackingUrl?: string }>;
  
  // Получение статуса доставки
  getDeliveryStatus?(deliveryId: string): Promise<{ status: string; eta?: string }>;
  
  // Фискализация чека (для Fiscal)
  createReceipt?(order: any): Promise<{ receiptId: string; fiscalSign?: string }>;
  
  // Отправка SMS/Email (для Marketing)
  sendNotification?(type: 'sms' | 'email', to: string, message: string): Promise<{ success: boolean }>;
  
  // Обработка webhook
  handleWebhook?(payload: any, headers: Record<string, string>): Promise<{ event: string; data: any }>;
}

