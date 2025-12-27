/**
 * Telegram Bot Adapter
 * Для уведомлений мерчантам о новых заказах
 */

import { IntegrationAdapter } from '../types';

interface TelegramCredentials {
  botToken: string;
  chatId: string;
}

interface TelegramConfig {
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
}

export class TelegramAdapter implements IntegrationAdapter {
  private credentials: TelegramCredentials;
  private config: TelegramConfig;
  private baseUrl = 'https://api.telegram.org/bot';

  async init(credentials: TelegramCredentials, config: TelegramConfig): Promise<void> {
    this.credentials = credentials;
    this.config = config || { parseMode: 'HTML' };
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}${this.credentials.botToken}/getMe`);
      const data = await response.json();

      if (data.ok) {
        return { success: true };
      }

      return { success: false, error: data.description || 'Неверный токен бота' };
    } catch (error) {
      return { success: false, error: 'Не удалось подключиться к Telegram API' };
    }
  }

  /**
   * Отправка сообщения
   */
  async sendNotification(
    type: 'sms' | 'email',
    to: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const chatId = to || this.credentials.chatId;

      const response = await fetch(`${this.baseUrl}${this.credentials.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: this.config.parseMode || 'HTML',
        }),
      });

      const data = await response.json();

      if (data.ok) {
        return {
          success: true,
          messageId: data.result?.message_id?.toString(),
        };
      }

      return {
        success: false,
        error: data.description || 'Ошибка отправки',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка отправки',
      };
    }
  }

  /**
   * Отправка уведомления о новом заказе
   */
  async sendOrderNotification(order: any): Promise<{ success: boolean }> {
    const message = this.formatOrderMessage(order);
    const result = await this.sendNotification('sms', this.credentials.chatId, message);
    return { success: result.success };
  }

  /**
   * Форматирование сообщения о заказе
   */
  private formatOrderMessage(order: any): string {
    const orderType = {
      delivery: '🚗 Доставка',
      pickup: '🏃 Самовывоз',
      reservation: '📅 Бронь',
    }[order.orderType] || order.orderType;

    const items = order.items
      ?.map((item: any) => `  • ${item.name} x${item.quantity} — ${item.price?.toLocaleString()} сум`)
      .join('\n') || '';

    return `
🆕 <b>Новый заказ #${order.orderNumber || order.id?.slice(0, 8)}</b>

${orderType}
👤 ${order.customerName}
📞 ${order.customerPhone}
${order.deliveryAddress ? `📍 ${order.deliveryAddress}` : ''}
${order.reservationDate ? `📅 ${order.reservationDate} в ${order.reservationTime}` : ''}
${order.guestsCount ? `👥 Гостей: ${order.guestsCount}` : ''}

📦 <b>Заказ:</b>
${items}

💰 <b>Итого: ${order.total?.toLocaleString()} сум</b>

⏰ ${new Date().toLocaleString('ru-RU')}
    `.trim();
  }

  /**
   * Обработка webhook (updates от Telegram)
   */
  async handleWebhook(
    payload: any,
    headers: Record<string, string>
  ): Promise<{ event: string; data: any }> {
    // Telegram может отправлять обновления
    if (payload.message) {
      return {
        event: 'telegram.message',
        data: {
          chatId: payload.message.chat.id,
          text: payload.message.text,
          from: payload.message.from,
        },
      };
    }

    if (payload.callback_query) {
      return {
        event: 'telegram.callback',
        data: {
          callbackId: payload.callback_query.id,
          data: payload.callback_query.data,
          chatId: payload.callback_query.message?.chat?.id,
        },
      };
    }

    return { event: 'telegram.unknown', data: payload };
  }
}

export function createTelegramAdapter(): TelegramAdapter {
  return new TelegramAdapter();
}

// =====================================
// TELEGRAM ШАБЛОНЫ
// =====================================

export const TELEGRAM_TEMPLATES = {
  NEW_ORDER: (order: any) => `
🆕 <b>Новый заказ #${order.orderNumber}</b>

${order.orderType === 'delivery' ? '🚗 Доставка' : order.orderType === 'pickup' ? '🏃 Самовывоз' : '📅 Бронь'}
👤 ${order.customerName}
📞 <a href="tel:${order.customerPhone}">${order.customerPhone}</a>

💰 <b>${order.total?.toLocaleString()} сум</b>
  `.trim(),

  ORDER_CONFIRMED: (orderNumber: string) =>
    `✅ Заказ #${orderNumber} подтверждён`,

  ORDER_READY: (orderNumber: string) =>
    `📦 Заказ #${orderNumber} готов к выдаче`,

  LOW_STOCK: (itemName: string, quantity: number) =>
    `⚠️ Мало на складе: ${itemName} (осталось ${quantity})`,
};

