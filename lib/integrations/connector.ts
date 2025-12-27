/**
 * Multi-Connector - Универсальный коннектор для всех интеграций
 * 
 * Автоматически выбирает нужный адаптер и выполняет операции
 */

import { prisma } from '../prisma';
import { IntegrationAdapter } from './types';

// Импорт адаптеров
import { createClickAdapter } from './adapters/click';
import { createPaymeAdapter } from './adapters/payme';
import { createEskizAdapter, SMS_TEMPLATES } from './adapters/eskiz';
import { createTelegramAdapter, TELEGRAM_TEMPLATES } from './adapters/telegram';
import { createIikoAdapter } from './adapters/iiko';

// Реестр фабрик адаптеров
const ADAPTER_FACTORIES: Record<string, () => IntegrationAdapter> = {
  click: createClickAdapter,
  payme: createPaymeAdapter,
  eskiz: createEskizAdapter,
  telegram_bot: createTelegramAdapter,
  iiko: createIikoAdapter,
};

/**
 * Получить инициализированный адаптер для подключения
 */
export async function getAdapter(connectionId: string): Promise<IntegrationAdapter | null> {
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
    include: { integration: true },
  });

  if (!connection || connection.status !== 'active') {
    return null;
  }

  const factory = ADAPTER_FACTORIES[connection.integration.provider];
  if (!factory) {
    console.warn(`Adapter not found for provider: ${connection.integration.provider}`);
    return null;
  }

  const adapter = factory();
  await adapter.init(
    connection.credentials as Record<string, any>,
    connection.config as Record<string, any>
  );

  return adapter;
}

/**
 * Получить все активные подключения ресторана по типу
 */
export async function getActiveConnections(
  restaurantId: string,
  type?: string
): Promise<any[]> {
  const where: any = {
    restaurantId,
    status: 'active',
  };

  if (type) {
    where.integration = { type };
  }

  return prisma.integrationConnection.findMany({
    where,
    include: { integration: true },
  });
}

// =============================================
// PAYMENT CONNECTOR
// =============================================

export class PaymentConnector {
  private restaurantId: string;

  constructor(restaurantId: string) {
    this.restaurantId = restaurantId;
  }

  /**
   * Создать платёж через первый доступный платёжный провайдер
   */
  async createPayment(
    amount: number,
    orderId: string,
    returnUrl: string,
    preferredProvider?: string
  ): Promise<{ paymentUrl: string; transactionId: string; provider: string } | null> {
    const connections = await getActiveConnections(this.restaurantId, 'payment');

    // Сортируем по предпочтению
    if (preferredProvider) {
      connections.sort((a, b) =>
        a.integration.provider === preferredProvider ? -1 : 1
      );
    }

    for (const connection of connections) {
      try {
        const adapter = await getAdapter(connection.id);
        if (!adapter?.createPayment) continue;

        const result = await adapter.createPayment(amount, orderId, returnUrl);

        // Логируем успешную операцию
        await logOperation(connection.id, 'create_payment', 'outbound', {
          orderId,
          amount,
        }, result, true);

        return {
          ...result,
          provider: connection.integration.provider,
        };
      } catch (error) {
        await logOperation(connection.id, 'create_payment', 'outbound', {
          orderId,
          amount,
        }, null, false, error);
      }
    }

    return null;
  }
}

// =============================================
// NOTIFICATION CONNECTOR
// =============================================

export class NotificationConnector {
  private restaurantId: string;

  constructor(restaurantId: string) {
    this.restaurantId = restaurantId;
  }

  /**
   * Отправить SMS клиенту
   */
  async sendSMS(phone: string, message: string): Promise<boolean> {
    const connections = await getActiveConnections(this.restaurantId, 'marketing');
    const smsConnection = connections.find((c) => c.integration.provider === 'eskiz');

    if (!smsConnection) return false;

    try {
      const adapter = await getAdapter(smsConnection.id);
      if (!adapter?.sendNotification) return false;

      const result = await adapter.sendNotification('sms', phone, message);

      await logOperation(smsConnection.id, 'send_sms', 'outbound', {
        phone,
        message,
      }, result, result.success);

      return result.success;
    } catch (error) {
      return false;
    }
  }

  /**
   * Отправить уведомление в Telegram
   */
  async sendTelegram(message: string): Promise<boolean> {
    const connections = await getActiveConnections(this.restaurantId, 'marketing');
    const tgConnection = connections.find((c) => c.integration.provider === 'telegram_bot');

    if (!tgConnection) return false;

    try {
      const adapter = await getAdapter(tgConnection.id);
      if (!adapter?.sendNotification) return false;

      const result = await adapter.sendNotification('sms', '', message);

      await logOperation(tgConnection.id, 'send_telegram', 'outbound', {
        message,
      }, result, result.success);

      return result.success;
    } catch (error) {
      return false;
    }
  }

  /**
   * Уведомить о новом заказе
   */
  async notifyNewOrder(order: any): Promise<void> {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: this.restaurantId },
      select: { name: true },
    });

    // SMS клиенту
    if (order.customerPhone) {
      const smsMessage = SMS_TEMPLATES.ORDER_CREATED(
        order.orderNumber || order.id.slice(0, 8),
        restaurant?.name || 'Ресторан'
      );
      await this.sendSMS(order.customerPhone, smsMessage);
    }

    // Telegram мерчанту
    const tgMessage = TELEGRAM_TEMPLATES.NEW_ORDER(order);
    await this.sendTelegram(tgMessage);
  }

  /**
   * Уведомить об изменении статуса заказа
   */
  async notifyOrderStatusChange(order: any, newStatus: string): Promise<void> {
    if (!order.customerPhone) return;

    const orderNumber = order.orderNumber || order.id.slice(0, 8);

    let message: string | null = null;

    switch (newStatus) {
      case 'confirmed':
        message = SMS_TEMPLATES.ORDER_CONFIRMED(orderNumber, '30-45 мин');
        break;
      case 'ready':
        message = SMS_TEMPLATES.ORDER_READY(orderNumber);
        break;
      case 'delivered':
        message = SMS_TEMPLATES.ORDER_DELIVERED(orderNumber);
        break;
      case 'cancelled':
        message = SMS_TEMPLATES.ORDER_CANCELLED(orderNumber);
        break;
    }

    if (message) {
      await this.sendSMS(order.customerPhone, message);
    }
  }
}

// =============================================
// POS CONNECTOR
// =============================================

export class POSConnector {
  private restaurantId: string;

  constructor(restaurantId: string) {
    this.restaurantId = restaurantId;
  }

  /**
   * Синхронизировать меню из POS системы
   */
  async syncMenu(): Promise<{ items: any[]; categories: any[] } | null> {
    const connections = await getActiveConnections(this.restaurantId, 'pos');

    for (const connection of connections) {
      try {
        const adapter = await getAdapter(connection.id);
        if (!adapter?.syncMenu) continue;

        const result = await adapter.syncMenu();

        await logOperation(connection.id, 'sync_menu', 'inbound', null, {
          itemsCount: result.items.length,
          categoriesCount: result.categories.length,
        }, true);

        // Обновляем меню в базе
        await this.updateMenuFromPOS(result);

        // Обновляем время синхронизации
        await prisma.integrationConnection.update({
          where: { id: connection.id },
          data: { lastSyncAt: new Date() },
        });

        return result;
      } catch (error) {
        await logOperation(connection.id, 'sync_menu', 'inbound', null, null, false, error);
      }
    }

    return null;
  }

  /**
   * Отправить заказ в POS систему
   */
  async pushOrder(order: any): Promise<{ externalId: string; provider: string } | null> {
    const connections = await getActiveConnections(this.restaurantId, 'pos');

    for (const connection of connections) {
      try {
        const adapter = await getAdapter(connection.id);
        if (!adapter?.pushOrder) continue;

        const result = await adapter.pushOrder(order);

        await logOperation(connection.id, 'push_order', 'outbound', {
          orderId: order.id,
        }, result, result.success);

        if (result.success) {
          return {
            externalId: result.externalId,
            provider: connection.integration.provider,
          };
        }
      } catch (error) {
        await logOperation(connection.id, 'push_order', 'outbound', {
          orderId: order.id,
        }, null, false, error);
      }
    }

    return null;
  }

  private async updateMenuFromPOS(data: { items: any[]; categories: any[] }): Promise<void> {
    // Обновляем категории (можно сохранить в отдельную таблицу или теги)
    // Обновляем позиции меню
    for (const item of data.items) {
      if (!item.isActive) continue;

      await prisma.menuItem.upsert({
        where: {
          id: item.id,
        },
        create: {
          id: item.id,
          restaurantId: this.restaurantId,
          name: item.name,
          description: item.description,
          price: item.price,
          category: data.categories.find((c) => c.id === item.categoryId)?.name,
          image: item.image,
        },
        update: {
          name: item.name,
          description: item.description,
          price: item.price,
          category: data.categories.find((c) => c.id === item.categoryId)?.name,
          image: item.image,
        },
      });
    }
  }
}

// =============================================
// MAIN MULTI-CONNECTOR
// =============================================

export class MultiConnector {
  public payment: PaymentConnector;
  public notifications: NotificationConnector;
  public pos: POSConnector;

  constructor(restaurantId: string) {
    this.payment = new PaymentConnector(restaurantId);
    this.notifications = new NotificationConnector(restaurantId);
    this.pos = new POSConnector(restaurantId);
  }

  /**
   * Обработать новый заказ - отправить во все системы
   */
  async processNewOrder(order: any): Promise<void> {
    // 1. Уведомления
    await this.notifications.notifyNewOrder(order);

    // 2. Отправка в POS (если настроено)
    const posResult = await this.pos.pushOrder(order);
    if (posResult) {
      // Сохраняем external ID
      await prisma.order.update({
        where: { id: order.id },
        data: {
          // Можно добавить поле externalId в модель Order
        },
      });
    }
  }

  /**
   * Обработать изменение статуса заказа
   */
  async processOrderStatusChange(order: any, newStatus: string): Promise<void> {
    await this.notifications.notifyOrderStatusChange(order, newStatus);
  }
}

// =============================================
// HELPER: Логирование операций
// =============================================

async function logOperation(
  connectionId: string,
  operation: string,
  direction: 'inbound' | 'outbound',
  requestData: any,
  responseData: any,
  success: boolean,
  error?: any
): Promise<void> {
  try {
    await prisma.integrationLog.create({
      data: {
        connectionId,
        operation,
        direction,
        requestData,
        responseData,
        success,
        errorMessage: error instanceof Error ? error.message : error?.toString(),
        durationMs: 0,
      },
    });
  } catch (e) {
    console.error('Failed to log integration operation:', e);
  }
}

// =============================================
// FACTORY
// =============================================

export function createConnector(restaurantId: string): MultiConnector {
  return new MultiConnector(restaurantId);
}

// Экспорт шаблонов
export { SMS_TEMPLATES, TELEGRAM_TEMPLATES };

