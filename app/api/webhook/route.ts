import { NextRequest, NextResponse } from 'next/server';
import { 
  getWebhooks, 
  createWebhook, 
  updateWebhook, 
  deleteWebhook,
  testWebhook,
  WebhookEvent 
} from '@/lib/apify/webhook';

/**
 * GET /api/webhook - Получить все webhook конфигурации
 */
export async function GET() {
  try {
    const webhooks = await getWebhooks();
    
    return NextResponse.json({
      webhooks,
      availableEvents: [
        { event: 'sync.started', label: 'Парсинг начался' },
        { event: 'sync.completed', label: 'Парсинг завершён' },
        { event: 'sync.failed', label: 'Парсинг провалился' },
        { event: 'restaurant.created', label: 'Ресторан создан' },
        { event: 'restaurant.updated', label: 'Ресторан обновлён' },
        { event: 'restaurant.merged', label: 'Ресторан объединён' },
      ],
    });
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch webhooks' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/webhook - Создать webhook или тестировать
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Тестирование webhook
    if (body.action === 'test' && body.id) {
      const result = await testWebhook(body.id);
      return NextResponse.json({
        success: result.success,
        message: result.success 
          ? `✅ Webhook успешно отправлен на ${result.url}`
          : `❌ Не удалось отправить webhook на ${result.url}`,
      });
    }
    
    // Создание нового webhook
    const { name, url, events, secret } = body;
    
    if (!name || !url || !events?.length) {
      return NextResponse.json(
        { error: 'Missing required fields: name, url, events' },
        { status: 400 }
      );
    }
    
    const webhook = await createWebhook(name, url, events as WebhookEvent[], secret);
    return NextResponse.json({ success: true, webhook });
  } catch (error) {
    console.error('Error creating webhook:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create webhook' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/webhook - Обновить webhook
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Missing webhook id' },
        { status: 400 }
      );
    }
    
    const webhook = await updateWebhook(id, data);
    return NextResponse.json({ success: true, webhook });
  } catch (error) {
    console.error('Error updating webhook:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update webhook' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/webhook - Удалить webhook
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Missing webhook id' },
        { status: 400 }
      );
    }
    
    await deleteWebhook(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete webhook' },
      { status: 500 }
    );
  }
}

