import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { INTEGRATION_PROVIDERS, INTEGRATION_GROUPS } from '@/lib/integrations/registry';

export const dynamic = 'force-dynamic';

// GET - получить список всех доступных интеграций
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const restaurantId = searchParams.get('restaurantId');

    // Если запрашивают список провайдеров
    if (!restaurantId) {
      const providers = type
        ? INTEGRATION_PROVIDERS.filter((p) => p.type === type)
        : INTEGRATION_PROVIDERS;

      return NextResponse.json({
        providers,
        groups: INTEGRATION_GROUPS,
      });
    }

    // Если запрашивают подключения ресторана
    const connections = await prisma.integrationConnection.findMany({
      where: { restaurantId },
      include: {
        integration: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ connections });
  } catch (error) {
    console.error('Error fetching integrations:', error);
    return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 });
  }
}

// POST - создать новое подключение интеграции
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { restaurantId, type, provider, credentials, config } = body;

    if (!restaurantId || !type || !provider) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Проверяем, существует ли интеграция в реестре
    const providerInfo = INTEGRATION_PROVIDERS.find(
      (p) => p.type === type && p.provider === provider
    );

    if (!providerInfo) {
      return NextResponse.json({ error: 'Unknown integration provider' }, { status: 400 });
    }

    // Создаём или находим запись интеграции
    let integration = await prisma.integration.findUnique({
      where: { type_provider: { type, provider } },
    });

    if (!integration) {
      integration = await prisma.integration.create({
        data: {
          type,
          provider,
          name: providerInfo.name,
          description: providerInfo.description,
          logo: providerInfo.logo,
          docsUrl: providerInfo.docsUrl,
          supportedEvents: providerInfo.supportedEvents,
          defaultConfig: providerInfo.configSchema,
        },
      });
    }

    // Проверяем, нет ли уже такого подключения
    const existingConnection = await prisma.integrationConnection.findUnique({
      where: {
        integrationId_restaurantId: {
          integrationId: integration.id,
          restaurantId,
        },
      },
    });

    if (existingConnection) {
      return NextResponse.json(
        { error: 'This integration is already connected' },
        { status: 400 }
      );
    }

    // Генерируем webhook secret
    const webhookSecret = `whsec_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;

    // Создаём подключение
    const connection = await prisma.integrationConnection.create({
      data: {
        integrationId: integration.id,
        restaurantId,
        credentials: credentials || {},
        config: config || {},
        webhookSecret,
        status: 'pending',
      },
      include: {
        integration: true,
      },
    });

    return NextResponse.json({
      success: true,
      connection,
      webhookUrl: `${process.env.NEXTAUTH_URL || ''}/api/integrations/webhook/${connection.id}`,
    });
  } catch (error) {
    console.error('Error creating integration:', error);
    return NextResponse.json({ error: 'Failed to create integration' }, { status: 500 });
  }
}

// PATCH - обновить подключение
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, credentials, config, status } = body;

    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID required' }, { status: 400 });
    }

    const updateData: any = {};
    if (credentials) updateData.credentials = credentials;
    if (config) updateData.config = config;
    if (status) updateData.status = status;

    const connection = await prisma.integrationConnection.update({
      where: { id: connectionId },
      data: updateData,
      include: { integration: true },
    });

    return NextResponse.json({ success: true, connection });
  } catch (error) {
    console.error('Error updating integration:', error);
    return NextResponse.json({ error: 'Failed to update integration' }, { status: 500 });
  }
}

// DELETE - удалить подключение
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');

    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID required' }, { status: 400 });
    }

    await prisma.integrationConnection.delete({
      where: { id: connectionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting integration:', error);
    return NextResponse.json({ error: 'Failed to delete integration' }, { status: 500 });
  }
}

