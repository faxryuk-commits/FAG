import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * Универсальный webhook endpoint для всех интеграций
 * URL: /api/integrations/webhook/{connectionId}
 */

export async function POST(
  request: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  const startTime = Date.now();
  
  try {
    const { connectionId } = params;
    
    // Находим подключение
    const connection = await prisma.integrationConnection.findUnique({
      where: { id: connectionId },
      include: { integration: true },
    });

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    if (connection.status !== 'active') {
      return NextResponse.json({ error: 'Connection is not active' }, { status: 400 });
    }

    // Получаем тело запроса
    const body = await request.text();
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Верификация подписи (если есть)
    const signature = headers['x-webhook-signature'] || headers['x-click-signature'] || headers['x-payme-signature'];
    if (connection.webhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', connection.webhookSecret)
        .update(body)
        .digest('hex');
      
      if (signature !== expectedSignature) {
        // Логируем неудачную попытку
        await prisma.integrationLog.create({
          data: {
            connectionId,
            operation: 'webhook_received',
            direction: 'inbound',
            requestData: { headers, body: body.substring(0, 1000) },
            success: false,
            errorMessage: 'Invalid webhook signature',
            durationMs: Date.now() - startTime,
          },
        });
        
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    // Парсим JSON
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      payload = { raw: body };
    }

    // Определяем тип события на основе провайдера
    const event = detectEvent(connection.integration.provider, payload, headers);

    // Логируем успешный webhook
    const log = await prisma.integrationLog.create({
      data: {
        connectionId,
        operation: 'webhook_received',
        direction: 'inbound',
        requestData: { event, payload, headers: sanitizeHeaders(headers) },
        success: true,
        durationMs: Date.now() - startTime,
      },
    });

    // Обрабатываем событие в зависимости от типа интеграции
    await processWebhookEvent(connection, event, payload);

    // Обновляем время последней синхронизации
    await prisma.integrationConnection.update({
      where: { id: connectionId },
      data: { lastSyncAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      event,
      logId: log.id,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    
    // Логируем ошибку
    try {
      await prisma.integrationLog.create({
        data: {
          connectionId: params.connectionId,
          operation: 'webhook_received',
          direction: 'inbound',
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          durationMs: Date.now() - startTime,
        },
      });
    } catch (e) {
      console.error('Failed to log webhook error:', e);
    }

    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// Определение типа события по провайдеру
function detectEvent(provider: string, payload: any, headers: Record<string, string>): string {
  switch (provider) {
    case 'click':
      if (payload.action === 0) return 'payment.prepare';
      if (payload.action === 1) return 'payment.completed';
      return 'payment.unknown';
      
    case 'payme':
      if (payload.method === 'CheckPerformTransaction') return 'payment.prepare';
      if (payload.method === 'CreateTransaction') return 'payment.initiated';
      if (payload.method === 'PerformTransaction') return 'payment.completed';
      if (payload.method === 'CancelTransaction') return 'payment.cancelled';
      return 'payment.unknown';
      
    case 'yandex_delivery':
      return `delivery.${payload.status || 'unknown'}`;
      
    case 'iiko':
    case 'rkeeper':
    case 'poster':
      if (payload.event) return payload.event;
      return 'pos.unknown';
      
    default:
      return payload.event || 'unknown';
  }
}

// Обработка события
async function processWebhookEvent(connection: any, event: string, payload: any) {
  const { integration } = connection;
  
  switch (event) {
    case 'payment.completed':
      // Найти заказ и обновить статус оплаты
      if (payload.orderId || payload.merchant_trans_id) {
        const orderId = payload.orderId || payload.merchant_trans_id;
        await prisma.order.updateMany({
          where: { id: orderId },
          data: { isPaid: true, status: 'confirmed' },
        });
      }
      break;
      
    case 'delivery.completed':
      // Обновить статус заказа
      if (payload.order_id) {
        await prisma.order.updateMany({
          where: { id: payload.order_id },
          data: { status: 'delivered', completedAt: new Date() },
        });
      }
      break;
      
    // Добавить другие обработчики по мере необходимости
  }
}

// Удаляем чувствительные заголовки
function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const result = { ...headers };
  const sensitiveKeys = ['authorization', 'x-api-key', 'cookie'];
  sensitiveKeys.forEach((key) => {
    if (result[key]) result[key] = '[REDACTED]';
  });
  return result;
}

