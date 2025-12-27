/**
 * Click Payment Adapter
 * Документация: https://docs.click.uz/
 */

import crypto from 'crypto';
import { IntegrationAdapter } from '../types';

interface ClickCredentials {
  merchantId: string;
  serviceId: string;
  secretKey: string;
}

interface ClickConfig {
  testMode?: boolean;
}

export class ClickAdapter implements IntegrationAdapter {
  private credentials: ClickCredentials;
  private config: ClickConfig;
  private baseUrl = 'https://my.click.uz/services/pay';

  async init(credentials: ClickCredentials, config: ClickConfig): Promise<void> {
    this.credentials = credentials;
    this.config = config;
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    // Click не имеет метода проверки подключения
    // Проверяем наличие всех credentials
    if (!this.credentials.merchantId || !this.credentials.serviceId || !this.credentials.secretKey) {
      return { success: false, error: 'Не все учётные данные заполнены' };
    }
    return { success: true };
  }

  /**
   * Создание ссылки для оплаты
   */
  async createPayment(
    amount: number,
    orderId: string,
    returnUrl: string
  ): Promise<{ paymentUrl: string; transactionId: string }> {
    const transactionId = `click_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    const params = new URLSearchParams({
      service_id: this.credentials.serviceId,
      merchant_id: this.credentials.merchantId,
      amount: amount.toString(),
      transaction_param: orderId,
      return_url: returnUrl,
      card_type: 'uzcard', // или 'humo'
    });

    return {
      paymentUrl: `${this.baseUrl}?${params.toString()}`,
      transactionId,
    };
  }

  /**
   * Проверка статуса платежа (через webhook)
   */
  async checkPayment(transactionId: string): Promise<{ status: string; paid: boolean }> {
    // Click использует webhook модель, статус приходит через callback
    return { status: 'pending', paid: false };
  }

  /**
   * Обработка Prepare запроса от Click
   * action = 0
   */
  handlePrepare(payload: any): { error: number; error_note: string; click_trans_id?: string; merchant_trans_id?: string; merchant_prepare_id?: number } {
    const {
      click_trans_id,
      service_id,
      click_paydoc_id,
      merchant_trans_id,
      amount,
      action,
      sign_time,
      sign_string,
    } = payload;

    // Проверяем подпись
    const expectedSign = this.generateSignature({
      click_trans_id,
      service_id,
      secret_key: this.credentials.secretKey,
      merchant_trans_id,
      amount,
      action,
      sign_time,
    });

    if (sign_string !== expectedSign) {
      return { error: -1, error_note: 'Invalid signature' };
    }

    // Проверяем сервис
    if (service_id !== this.credentials.serviceId) {
      return { error: -3, error_note: 'Invalid service_id' };
    }

    // Здесь нужно проверить существование заказа и его сумму
    // Возвращаем успех для демонстрации
    return {
      error: 0,
      error_note: 'Success',
      click_trans_id,
      merchant_trans_id,
      merchant_prepare_id: Date.now(),
    };
  }

  /**
   * Обработка Complete запроса от Click
   * action = 1
   */
  handleComplete(payload: any): { error: number; error_note: string; click_trans_id?: string; merchant_trans_id?: string; merchant_confirm_id?: number } {
    const {
      click_trans_id,
      service_id,
      merchant_trans_id,
      merchant_prepare_id,
      amount,
      action,
      sign_time,
      sign_string,
      error,
    } = payload;

    // Проверяем подпись
    const expectedSign = this.generateSignature({
      click_trans_id,
      service_id,
      secret_key: this.credentials.secretKey,
      merchant_trans_id,
      merchant_prepare_id,
      amount,
      action,
      sign_time,
    });

    if (sign_string !== expectedSign) {
      return { error: -1, error_note: 'Invalid signature' };
    }

    // Если пришла ошибка от Click
    if (error && error !== '0') {
      return { error: -9, error_note: 'Payment failed' };
    }

    return {
      error: 0,
      error_note: 'Success',
      click_trans_id,
      merchant_trans_id,
      merchant_confirm_id: Date.now(),
    };
  }

  /**
   * Обработка webhook от Click
   */
  async handleWebhook(
    payload: any,
    headers: Record<string, string>
  ): Promise<{ event: string; data: any }> {
    const action = parseInt(payload.action);

    if (action === 0) {
      // Prepare
      const result = this.handlePrepare(payload);
      return {
        event: result.error === 0 ? 'payment.prepare' : 'payment.prepare_failed',
        data: result,
      };
    } else if (action === 1) {
      // Complete
      const result = this.handleComplete(payload);
      return {
        event: result.error === 0 ? 'payment.completed' : 'payment.failed',
        data: { ...result, orderId: payload.merchant_trans_id },
      };
    }

    return { event: 'payment.unknown', data: payload };
  }

  private generateSignature(params: Record<string, any>): string {
    const str = Object.values(params).join('');
    return crypto.createHash('md5').update(str).digest('hex');
  }
}

export function createClickAdapter(): ClickAdapter {
  return new ClickAdapter();
}

