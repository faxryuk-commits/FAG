import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export type WebhookEvent = 
  | 'sync.started'
  | 'sync.completed'
  | 'sync.failed'
  | 'restaurant.created'
  | 'restaurant.updated'
  | 'restaurant.merged';

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: any;
}

/**
 * Генерирует подпись для webhook
 */
function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Отправляет webhook
 */
async function sendWebhook(url: string, payload: WebhookPayload, secret?: string): Promise<boolean> {
  try {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': payload.event,
      'X-Webhook-Timestamp': payload.timestamp,
    };
    
    if (secret) {
      headers['X-Webhook-Signature'] = generateSignature(body, secret);
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });
    
    return response.ok;
  } catch (error) {
    console.error('Webhook send error:', error);
    return false;
  }
}

/**
 * Триггерит webhook событие
 */
export async function triggerWebhook(event: WebhookEvent, data: any) {
  // Получаем все активные webhook конфигурации для этого события
  const webhooks = await prisma.webhookConfig.findMany({
    where: {
      isActive: true,
      events: { has: event },
    },
  });
  
  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };
  
  const results = await Promise.all(
    webhooks.map(async (webhook) => {
      const success = await sendWebhook(webhook.url, payload, webhook.secret || undefined);
      
      // Обновляем статистику
      await prisma.webhookConfig.update({
        where: { id: webhook.id },
        data: {
          lastSent: success ? new Date() : undefined,
          failCount: success ? 0 : { increment: 1 },
        },
      });
      
      return { webhookId: webhook.id, success };
    })
  );
  
  return results;
}

/**
 * Создаёт webhook конфигурацию
 */
export async function createWebhook(
  name: string,
  url: string,
  events: WebhookEvent[],
  secret?: string
) {
  return prisma.webhookConfig.create({
    data: {
      name,
      url,
      events,
      secret,
      isActive: true,
    },
  });
}

/**
 * Получает все webhook конфигурации
 */
export async function getWebhooks() {
  return prisma.webhookConfig.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Обновляет webhook
 */
export async function updateWebhook(
  id: string,
  data: { name?: string; url?: string; events?: WebhookEvent[]; secret?: string; isActive?: boolean }
) {
  return prisma.webhookConfig.update({
    where: { id },
    data,
  });
}

/**
 * Удаляет webhook
 */
export async function deleteWebhook(id: string) {
  return prisma.webhookConfig.delete({
    where: { id },
  });
}

/**
 * Тестирует webhook
 */
export async function testWebhook(id: string) {
  const webhook = await prisma.webhookConfig.findUnique({
    where: { id },
  });
  
  if (!webhook) {
    throw new Error('Webhook not found');
  }
  
  const payload: WebhookPayload = {
    event: 'sync.completed',
    timestamp: new Date().toISOString(),
    data: { 
      test: true, 
      message: 'This is a test webhook from Restaurant Directory',
    },
  };
  
  const success = await sendWebhook(webhook.url, payload, webhook.secret || undefined);
  
  return { success, url: webhook.url };
}

