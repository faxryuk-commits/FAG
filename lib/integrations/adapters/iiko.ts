/**
 * iiko POS Adapter
 * Документация: https://api-ru.iiko.services/
 */

import { IntegrationAdapter } from '../types';

interface IikoCredentials {
  apiLogin: string;
  organizationId: string;
  terminalGroupId: string;
}

interface IikoConfig {
  autoSyncMenu?: boolean;
  syncInterval?: number; // минуты
}

export class IikoAdapter implements IntegrationAdapter {
  private credentials!: IikoCredentials;
  private config!: IikoConfig;
  private token: string | null = null;
  private tokenExpiry: number = 0;
  private baseUrl = 'https://api-ru.iiko.services/api/1';

  async init(credentials: IikoCredentials, config: IikoConfig): Promise<void> {
    this.credentials = credentials;
    this.config = config;
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.getToken();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка подключения к iiko',
      };
    }
  }

  /**
   * Получение токена доступа
   */
  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token as string;
    }

    const response = await fetch(`${this.baseUrl}/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiLogin: this.credentials.apiLogin }),
    });

    if (!response.ok) {
      throw new Error('Ошибка авторизации в iiko');
    }

    const data = await response.json();

    if (!data.token) {
      throw new Error('Не удалось получить токен iiko');
    }

    this.token = data.token;
    // Токен действует 1 час
    this.tokenExpiry = Date.now() + 55 * 60 * 1000;

    return this.token as string;
  }

  /**
   * Синхронизация меню из iiko
   */
  async syncMenu(): Promise<{ items: any[]; categories: any[] }> {
    const token = await this.getToken();

    // Получаем номенклатуру
    const response = await fetch(`${this.baseUrl}/nomenclature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        organizationId: this.credentials.organizationId,
      }),
    });

    if (!response.ok) {
      throw new Error('Ошибка получения меню из iiko');
    }

    const data = await response.json();

    // Преобразуем категории
    const categories = (data.groups || []).map((group: any) => ({
      id: group.id,
      name: group.name,
      parentId: group.parentGroup,
      order: group.order,
      isActive: !group.isDeleted,
    }));

    // Преобразуем товары
    const items = (data.products || [])
      .filter((product: any) => product.type === 'Dish' || product.type === 'Goods')
      .map((product: any) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.sizePrices?.[0]?.price?.currentPrice || 0,
        categoryId: product.parentGroup,
        image: product.imageLinks?.[0],
        weight: product.weight,
        isActive: !product.isDeleted,
        // Дополнительные поля iiko
        iikoId: product.id,
        iikoCode: product.code,
        modifiers: product.groupModifiers || [],
      }));

    return { items, categories };
  }

  /**
   * Отправка заказа в iiko
   */
  async pushOrder(order: any): Promise<{ externalId: string; success: boolean }> {
    const token = await this.getToken();

    // Формируем заказ в формате iiko
    const iikoOrder = {
      organizationId: this.credentials.organizationId,
      terminalGroupId: this.credentials.terminalGroupId,
      order: {
        id: order.id,
        completeBefore: this.calculateDeliveryTime(order),
        phone: order.customerPhone?.replace(/[^0-9]/g, ''),
        orderTypeId: this.getOrderTypeId(order.orderType),
        
        customer: {
          name: order.customerName,
          type: 'regular',
        },

        items: order.items?.map((item: any) => ({
          productId: item.iikoId || item.menuItemId,
          amount: item.quantity,
          comment: item.notes,
        })) || [],

        payments: order.isPaid
          ? [
              {
                paymentTypeKind: 'Card',
                sum: order.total,
                isProcessedExternally: true,
              },
            ]
          : [],

        comment: order.deliveryNotes || order.notes,
      },
    };

    // Добавляем данные доставки если нужно
    if (order.orderType === 'delivery' && order.deliveryAddress) {
      (iikoOrder.order as any).deliveryPoint = {
        address: {
          street: { name: order.deliveryAddress },
        },
        comment: order.deliveryNotes,
      };
    }

    const response = await fetch(`${this.baseUrl}/deliveries/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(iikoOrder),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ошибка создания заказа в iiko: ${error}`);
    }

    const data = await response.json();

    return {
      externalId: data.orderInfo?.id || data.correlationId,
      success: true,
    };
  }

  /**
   * Получение статуса заказа
   */
  async getOrderStatus(externalId: string): Promise<{ status: string; iikoStatus?: string }> {
    const token = await this.getToken();

    const response = await fetch(`${this.baseUrl}/deliveries/by_id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        organizationId: this.credentials.organizationId,
        orderIds: [externalId],
      }),
    });

    if (!response.ok) {
      throw new Error('Ошибка получения статуса заказа');
    }

    const data = await response.json();
    const order = data.orders?.[0];

    if (!order) {
      return { status: 'unknown' };
    }

    // Маппинг статусов iiko -> наши статусы
    const statusMap: Record<string, string> = {
      'Unconfirmed': 'pending',
      'WaitCooking': 'confirmed',
      'ReadyForCooking': 'confirmed',
      'CookingStarted': 'preparing',
      'CookingCompleted': 'ready',
      'Waiting': 'ready',
      'OnWay': 'delivering',
      'Delivered': 'delivered',
      'Closed': 'delivered',
      'Cancelled': 'cancelled',
    };

    return {
      status: statusMap[order.status] || 'unknown',
      iikoStatus: order.status,
    };
  }

  /**
   * Обработка webhook от iiko
   */
  async handleWebhook(
    payload: any,
    headers: Record<string, string>
  ): Promise<{ event: string; data: any }> {
    // iiko может отправлять события о статусе заказов
    const eventType = payload.eventType || payload.type;

    switch (eventType) {
      case 'DeliveryOrderUpdate':
        return {
          event: 'order.status_update',
          data: {
            externalId: payload.orderId,
            status: payload.status,
            iikoStatus: payload.iikoStatus,
          },
        };

      case 'StopListUpdate':
        return {
          event: 'menu.stop_list_update',
          data: {
            items: payload.items,
          },
        };

      default:
        return { event: 'iiko.unknown', data: payload };
    }
  }

  private calculateDeliveryTime(order: any): string {
    // Время доставки через 60 минут по умолчанию
    const deliveryTime = new Date(Date.now() + 60 * 60 * 1000);
    return deliveryTime.toISOString();
  }

  private getOrderTypeId(orderType: string): string | null {
    // ID типов заказов нужно получить из настроек iiko
    // Пока возвращаем null для автоопределения
    return null;
  }
}

export function createIikoAdapter(): IikoAdapter {
  return new IikoAdapter();
}

