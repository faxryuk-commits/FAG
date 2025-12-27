/**
 * Eskiz SMS Adapter
 * Документация: https://eskiz.uz/developers/
 */

import { IntegrationAdapter } from '../types';

interface EskizCredentials {
  email: string;
  password: string;
  sender?: string;
}

interface EskizConfig {
  defaultSender?: string;
}

export class EskizAdapter implements IntegrationAdapter {
  private credentials!: EskizCredentials;
  private config!: EskizConfig;
  private token: string | null = null;
  private tokenExpiry: number = 0;
  private baseUrl = 'https://notify.eskiz.uz/api';

  async init(credentials: EskizCredentials, config: EskizConfig): Promise<void> {
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
        error: error instanceof Error ? error.message : 'Ошибка подключения к Eskiz' 
      };
    }
  }

  /**
   * Получение/обновление токена
   */
  private async getToken(): Promise<string> {
    // Если токен валиден, возвращаем его
    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: this.credentials.email,
        password: this.credentials.password,
      }),
    });

    if (!response.ok) {
      throw new Error('Ошибка авторизации в Eskiz');
    }

    const data = await response.json();
    
    if (!data.data?.token) {
      throw new Error(data.message || 'Не удалось получить токен');
    }

    this.token = data.data.token;
    // Токен действует 30 дней, обновляем за день до истечения
    this.tokenExpiry = Date.now() + 29 * 24 * 60 * 60 * 1000;

    return this.token;
  }

  /**
   * Отправка SMS
   */
  async sendNotification(
    type: 'sms' | 'email',
    to: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (type !== 'sms') {
      return { success: false, error: 'Eskiz поддерживает только SMS' };
    }

    try {
      const token = await this.getToken();

      // Нормализуем номер телефона (убираем +, пробелы)
      const phone = to.replace(/[+\s-]/g, '');

      const response = await fetch(`${this.baseUrl}/message/sms/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          mobile_phone: phone,
          message: message,
          from: this.credentials.sender || this.config.defaultSender || '4546',
        }),
      });

      const data = await response.json();

      if (data.status === 'success' || data.id) {
        return {
          success: true,
          messageId: data.id?.toString(),
        };
      }

      return {
        success: false,
        error: data.message || 'Ошибка отправки SMS',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка отправки SMS',
      };
    }
  }

  /**
   * Проверка баланса
   */
  async getBalance(): Promise<{ balance: number; currency: string }> {
    const token = await this.getToken();

    const response = await fetch(`${this.baseUrl}/user/get-limit`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    return {
      balance: data.data?.balance || 0,
      currency: 'SMS',
    };
  }

  /**
   * Обработка webhook (Eskiz может отправлять delivery reports)
   */
  async handleWebhook(
    payload: any,
    headers: Record<string, string>
  ): Promise<{ event: string; data: any }> {
    // Eskiz может отправлять статусы доставки
    const { message_id, status, phone } = payload;

    return {
      event: status === 'delivered' ? 'sms.delivered' : 'sms.status_update',
      data: { messageId: message_id, status, phone },
    };
  }
}

export function createEskizAdapter(): EskizAdapter {
  return new EskizAdapter();
}

// =====================================
// SMS ШАБЛОНЫ
// =====================================

export const SMS_TEMPLATES = {
  ORDER_CREATED: (orderNumber: string, restaurantName: string) =>
    `Заказ #${orderNumber} принят! ${restaurantName} готовит ваш заказ. Ожидайте звонка для подтверждения.`,

  ORDER_CONFIRMED: (orderNumber: string, time: string) =>
    `Заказ #${orderNumber} подтверждён! Ориентировочное время: ${time}.`,

  ORDER_READY: (orderNumber: string) =>
    `Заказ #${orderNumber} готов! Ожидаем вас или курьер уже в пути.`,

  ORDER_DELIVERED: (orderNumber: string) =>
    `Заказ #${orderNumber} доставлен! Спасибо за заказ! Оцените нас на сайте.`,

  ORDER_CANCELLED: (orderNumber: string, reason?: string) =>
    `Заказ #${orderNumber} отменён${reason ? `: ${reason}` : ''}. Приносим извинения.`,

  RESERVATION_CONFIRMED: (date: string, time: string, guests: number, restaurantName: string) =>
    `Бронь подтверждена! ${restaurantName}, ${date} в ${time} на ${guests} чел. Ждём вас!`,

  PROMO_CODE: (code: string, discount: string, validUntil: string) =>
    `Промокод ${code} даёт скидку ${discount}! Действует до ${validUntil}.`,
};

