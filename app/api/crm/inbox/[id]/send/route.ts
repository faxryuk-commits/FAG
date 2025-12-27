import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST - Отправить сообщение в диалог
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { content, contentType = 'text' } = body;

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Получаем диалог
    const conversation = await prisma.conversation.findUnique({
      where: { id: params.id },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Отправляем сообщение через соответствующий канал
    let sendResult: { success: boolean; error?: string; externalId?: string } = { 
      success: false, 
      error: 'Channel not supported' 
    };

    if (conversation.channel === 'instagram') {
      sendResult = await sendInstagramMessage(conversation.externalId, content);
    } else if (conversation.channel === 'telegram') {
      sendResult = await sendTelegramMessage(conversation.externalId, content);
    }

    // Создаём сообщение в базе
    const message = await prisma.chatMessage.create({
      data: {
        conversationId: params.id,
        direction: 'outbound',
        content,
        contentType,
        status: sendResult.success ? 'sent' : 'failed',
        externalId: sendResult.externalId || null,
        sentBy: 'user',
        metadata: sendResult.success ? undefined : { error: sendResult.error || 'Unknown error' },
      },
    });

    // Обновляем диалог
    await prisma.conversation.update({
      where: { id: params.id },
      data: {
        lastMessageAt: new Date(),
        lastMessageText: content,
        lastMessageBy: 'us',
        status: 'active',
      },
    });

    return NextResponse.json({
      message,
      sent: sendResult.success,
      error: sendResult.success ? null : sendResult.error,
    });

  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

// Отправка сообщения в Instagram
async function sendInstagramMessage(recipientId: string, text: string): Promise<{ success: boolean; error?: string; externalId?: string }> {
  try {
    const settings = await prisma.cRMSettings.findFirst();
    if (!settings?.instagramAccessToken) {
      return { success: false, error: 'Instagram not configured' };
    }

    // Пробуем разные ID для отправки
    const pageId = settings.instagramPageId;
    const igAccountId = settings.instagramAccountId;
    
    if (!pageId && !igAccountId) {
      return { success: false, error: 'Instagram/Page ID not configured' };
    }

    // Сначала пробуем через Page ID (Facebook Messenger style)
    let response = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text },
          access_token: settings.instagramAccessToken,
        }),
      }
    );

    let data = await response.json();
    console.log('Instagram send via Page ID:', JSON.stringify(data));

    // Если не сработало через Page ID, пробуем через Instagram Account ID
    if (data.error && igAccountId && igAccountId !== pageId) {
      console.log('Trying via Instagram Account ID...');
      response = await fetch(
        `https://graph.facebook.com/v18.0/${igAccountId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: recipientId },
            message: { text },
            access_token: settings.instagramAccessToken,
          }),
        }
      );
      data = await response.json();
      console.log('Instagram send via IG Account ID:', JSON.stringify(data));
    }

    if (data.error) {
      return { success: false, error: data.error.message };
    }

    return { success: true, externalId: data.message_id };

  } catch (error) {
    console.error('Instagram send error:', error);
    return { success: false, error: String(error) };
  }
}

// Отправка сообщения в Telegram
async function sendTelegramMessage(chatId: string, text: string): Promise<{ success: boolean; error?: string; externalId?: string }> {
  try {
    const settings = await prisma.cRMSettings.findFirst();
    
    // Пробуем через бота
    if (settings?.telegramBotToken) {
      const response = await fetch(
        `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
          }),
        }
      );

      const data = await response.json();

      if (data.ok) {
        return { success: true, externalId: String(data.result.message_id) };
      } else {
        return { success: false, error: data.description };
      }
    }

    return { success: false, error: 'Telegram not configured' };

  } catch (error) {
    return { success: false, error: String(error) };
  }
}

