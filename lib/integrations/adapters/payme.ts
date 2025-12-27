/**
 * Payme Payment Adapter
 * Документация: https://developer.payme.uz/
 */

import crypto from 'crypto';
import { IntegrationAdapter } from '../types';

interface PaymeCredentials {
  merchantId: string;
  secretKey: string;
}

interface PaymeConfig {
  testMode?: boolean;
}

export class PaymeAdapter implements IntegrationAdapter {
  private credentials!: PaymeCredentials;
  private config!: PaymeConfig;
  private baseUrl = 'https://checkout.paycom.uz';
  private testUrl = 'https://test.paycom.uz';

  async init(credentials: PaymeCredentials, config: PaymeConfig): Promise<void> {
    this.credentials = credentials;
    this.config = config;
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.credentials.merchantId || !this.credentials.secretKey) {
      return { success: false, error: 'Не все учётные данные заполнены' };
    }
    return { success: true };
  }

  /**
   * Создание ссылки для оплаты через Payme
   */
  async createPayment(
    amount: number,
    orderId: string,
    returnUrl: string
  ): Promise<{ paymentUrl: string; transactionId: string }> {
    const transactionId = `payme_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    // Payme принимает сумму в тийинах (1 сум = 100 тийин)
    const amountInTiyin = Math.round(amount * 100);
    
    // Формируем параметры
    const params = {
      m: this.credentials.merchantId,
      ac: { order_id: orderId },
      a: amountInTiyin,
      c: returnUrl,
    };
    
    // Кодируем в base64
    const encoded = Buffer.from(JSON.stringify(params)).toString('base64');
    
    const baseUrl = this.config.testMode ? this.testUrl : this.baseUrl;

    return {
      paymentUrl: `${baseUrl}/${encoded}`,
      transactionId,
    };
  }

  async checkPayment(transactionId: string): Promise<{ status: string; paid: boolean }> {
    // Payme использует webhook модель
    return { status: 'pending', paid: false };
  }

  /**
   * Обработка JSON-RPC запросов от Payme
   */
  async handleWebhook(
    payload: any,
    headers: Record<string, string>
  ): Promise<{ event: string; data: any }> {
    // Проверяем авторизацию
    const authHeader = headers['authorization'] || '';
    const expectedAuth = `Basic ${Buffer.from(`Paycom:${this.credentials.secretKey}`).toString('base64')}`;
    
    if (authHeader !== expectedAuth) {
      return {
        event: 'payment.auth_failed',
        data: {
          jsonrpc: '2.0',
          id: payload.id,
          error: {
            code: -32504,
            message: { ru: 'Недостаточно привилегий', en: 'Insufficient privileges' },
          },
        },
      };
    }

    const { method, params, id } = payload;

    switch (method) {
      case 'CheckPerformTransaction':
        return this.checkPerformTransaction(params, id);
        
      case 'CreateTransaction':
        return this.createTransaction(params, id);
        
      case 'PerformTransaction':
        return this.performTransaction(params, id);
        
      case 'CancelTransaction':
        return this.cancelTransaction(params, id);
        
      case 'CheckTransaction':
        return this.checkTransaction(params, id);
        
      case 'GetStatement':
        return this.getStatement(params, id);
        
      default:
        return {
          event: 'payment.unknown_method',
          data: {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: { ru: 'Метод не найден', en: 'Method not found' },
            },
          },
        };
    }
  }

  private checkPerformTransaction(params: any, id: any) {
    // Проверяем возможность выполнения транзакции
    const orderId = params.account?.order_id;
    const amount = params.amount;

    // Здесь нужно проверить существование заказа и сумму
    // Для демонстрации возвращаем успех

    return {
      event: 'payment.check',
      data: {
        jsonrpc: '2.0',
        id,
        result: { allow: true },
      },
    };
  }

  private createTransaction(params: any, id: any) {
    const orderId = params.account?.order_id;
    const transactionId = params.id;
    const time = params.time;
    const amount = params.amount;

    // Создаём транзакцию
    return {
      event: 'payment.initiated',
      data: {
        jsonrpc: '2.0',
        id,
        result: {
          create_time: Date.now(),
          transaction: transactionId,
          state: 1, // Создана
        },
        orderId,
      },
    };
  }

  private performTransaction(params: any, id: any) {
    const transactionId = params.id;

    // Выполняем транзакцию
    return {
      event: 'payment.completed',
      data: {
        jsonrpc: '2.0',
        id,
        result: {
          transaction: transactionId,
          perform_time: Date.now(),
          state: 2, // Выполнена
        },
      },
    };
  }

  private cancelTransaction(params: any, id: any) {
    const transactionId = params.id;
    const reason = params.reason;

    return {
      event: 'payment.cancelled',
      data: {
        jsonrpc: '2.0',
        id,
        result: {
          transaction: transactionId,
          cancel_time: Date.now(),
          state: -1, // Отменена после создания
        },
      },
    };
  }

  private checkTransaction(params: any, id: any) {
    const transactionId = params.id;

    return {
      event: 'payment.status_check',
      data: {
        jsonrpc: '2.0',
        id,
        result: {
          create_time: Date.now() - 60000,
          perform_time: Date.now(),
          cancel_time: 0,
          transaction: transactionId,
          state: 2,
          reason: null,
        },
      },
    };
  }

  private getStatement(params: any, id: any) {
    return {
      event: 'payment.statement',
      data: {
        jsonrpc: '2.0',
        id,
        result: { transactions: [] },
      },
    };
  }
}

export function createPaymeAdapter(): PaymeAdapter {
  return new PaymeAdapter();
}

