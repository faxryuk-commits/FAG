import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - Верификация webhook от Meta
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Получаем verify token из настроек (или используем дефолтный)
  let verifyToken = 'delever_instagram_2024';
  try {
    const settings = await prisma.cRMSettings.findFirst();
    if (settings?.instagramVerifyToken) {
      verifyToken = settings.instagramVerifyToken;
    }
  } catch (e) {
    console.log('Using default verify token');
  }

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Instagram webhook verified');
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// POST - Получение событий от Instagram
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('📸 Instagram webhook received:', JSON.stringify(body, null, 2));

    if (body.object === 'instagram') {
      for (const entry of body.entry || []) {
        // Direct Messages
        if (entry.messaging) {
          for (const event of entry.messaging) {
            await handleDirectMessage(event);
          }
        }
        
        // Comments, mentions и т.д.
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === 'comments') {
              await handleComment(change.value);
            }
          }
        }
      }
    }

    // Lead Ads
    if (body.object === 'page') {
      for (const entry of body.entry || []) {
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === 'leadgen') {
              await handleLeadAd(change.value);
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Instagram webhook error:', error);
    return NextResponse.json({ error: 'Error processing webhook' }, { status: 500 });
  }
}

// Получить информацию о пользователе из Instagram API
async function fetchInstagramUserInfo(userId: string): Promise<{ name?: string; username?: string; avatarUrl?: string }> {
  try {
    const settings = await prisma.cRMSettings.findFirst();
    if (!settings?.instagramAccessToken) {
      return {};
    }

    // Получаем информацию о пользователе
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${userId}?fields=name,username,profile_pic&access_token=${settings.instagramAccessToken}`
    );
    const data = await response.json();

    if (data.error) {
      console.log('Could not fetch user info:', data.error.message);
      return {};
    }

    return {
      name: data.name,
      username: data.username,
      avatarUrl: data.profile_pic,
    };
  } catch (error) {
    console.log('Error fetching Instagram user info:', error);
    return {};
  }
}

// Обработка Direct сообщений - создаём Conversation
async function handleDirectMessage(event: any) {
  console.log('📩 handleDirectMessage:', JSON.stringify(event));
  
  const senderId = event.sender?.id;
  const message = event.message;
  
  if (!senderId || !message) {
    console.log('❌ Missing senderId or message');
    return;
  }
  
  try {
    // Ищем или создаём диалог
    let conversation = await prisma.conversation.findUnique({
      where: {
        channel_externalId: {
          channel: 'instagram',
          externalId: senderId,
        },
      },
    });

    // Если диалога нет - создаём новый
    if (!conversation) {
      // Подтягиваем информацию о пользователе
      const userInfo = await fetchInstagramUserInfo(senderId);
      
      conversation = await prisma.conversation.create({
        data: {
          channel: 'instagram',
          externalId: senderId,
          name: userInfo.name || `Instagram User ${senderId.slice(-6)}`,
          username: userInfo.username,
          avatarUrl: userInfo.avatarUrl,
          status: 'new',
          unreadCount: 1,
          lastMessageAt: new Date(),
          lastMessageText: message.text || '[медиа]',
          lastMessageBy: 'user',
          profileData: userInfo,
        },
      });
      
      console.log('✅ New conversation created:', conversation.id);
    } else {
      // Обновляем существующий диалог
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          unreadCount: { increment: 1 },
          lastMessageAt: new Date(),
          lastMessageText: message.text || '[медиа]',
          lastMessageBy: 'user',
          status: conversation.status === 'closed' ? 'active' : conversation.status,
        },
      });
    }

    // Добавляем сообщение в диалог
    await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'inbound',
        content: message.text || '[медиа]',
        contentType: message.attachments ? 'media' : 'text',
        mediaUrl: message.attachments?.[0]?.payload?.url,
        status: 'received',
        externalId: message.mid,
        metadata: {
          attachments: message.attachments,
        },
      },
    });

    // Если диалог привязан к лиду - создаём touch
    if (conversation.leadId) {
      await prisma.touch.create({
        data: {
          leadId: conversation.leadId,
          channel: 'instagram',
          direction: 'inbound',
          content: message.text || '[медиа]',
          status: 'completed',
          performedBy: 'instagram',
          metadata: {
            messageId: message.mid,
            conversationId: conversation.id,
          },
        },
      });
      
      // Обновляем лида
      await prisma.lead.update({
        where: { id: conversation.leadId },
        data: {
          lastContactAt: new Date(),
          score: { increment: 5 },
        },
      });
    }

    console.log(`📩 Instagram DM saved: ${message.text?.slice(0, 50)}...`);

  } catch (error) {
    console.error('❌ Error in handleDirectMessage:', error);
  }
}

// Обработка комментариев
async function handleComment(data: any) {
  const { id, text, from, media } = data;
  
  if (!from?.id) return;

  try {
    // Ищем или создаём диалог для комментатора
    let conversation = await prisma.conversation.findUnique({
      where: {
        channel_externalId: {
          channel: 'instagram',
          externalId: from.id,
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          channel: 'instagram',
          externalId: from.id,
          name: from.username || `IG User ${from.id.slice(-6)}`,
          username: from.username,
          status: 'new',
          unreadCount: 1,
          lastMessageAt: new Date(),
          lastMessageText: `💬 ${text}`,
          lastMessageBy: 'user',
          tags: ['comment'],
        },
      });
    } else {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          unreadCount: { increment: 1 },
          lastMessageAt: new Date(),
          lastMessageText: `💬 ${text}`,
          lastMessageBy: 'user',
        },
      });
    }

    // Добавляем сообщение
    await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'inbound',
        content: `💬 Комментарий к посту: ${text}`,
        contentType: 'text',
        status: 'received',
        externalId: id,
        metadata: {
          type: 'comment',
          mediaId: media?.id,
          mediaUrl: media?.permalink,
        },
      },
    });

    console.log(`💬 Instagram comment from ${from.username}: ${text?.slice(0, 50)}...`);

  } catch (error) {
    console.error('Error handling comment:', error);
  }
}

// Обработка Lead Ads (реклама с формой) - создаём сразу лида (горячий)
async function handleLeadAd(data: any) {
  const { leadgen_id, page_id, form_id, created_time } = data;
  
  const settings = await prisma.cRMSettings.findFirst();
  if (!settings?.instagramAccessToken) {
    console.error('No Instagram access token configured');
    return;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${leadgen_id}?access_token=${settings.instagramAccessToken}`
    );
    const leadData = await response.json();

    if (leadData.error) {
      console.error('Error fetching lead data:', leadData.error);
      return;
    }

    const fieldData: Record<string, string> = {};
    for (const field of leadData.field_data || []) {
      fieldData[field.name] = field.values?.[0] || '';
    }

    // Lead Ads = горячий лид, создаём сразу в CRM
    const lead = await prisma.lead.create({
      data: {
        name: fieldData.full_name || fieldData.name || null,
        firstName: fieldData.first_name || null,
        lastName: fieldData.last_name || null,
        email: fieldData.email || null,
        phone: fieldData.phone_number || fieldData.phone || null,
        company: fieldData.company_name || fieldData.company || null,
        source: 'instagram_lead_ad',
        status: 'new',
        segment: 'hot',
        score: 80,
        tags: ['instagram', 'lead_ad', 'hot'],
        metadata: {
          leadgenId: leadgen_id,
          formId: form_id,
          pageId: page_id,
          createdTime: created_time,
          rawFields: fieldData,
        },
      },
    });

    await prisma.touch.create({
      data: {
        leadId: lead.id,
        channel: 'instagram',
        direction: 'inbound',
        content: `🎯 Заявка из Instagram Lead Ad`,
        status: 'completed',
        performedBy: 'instagram_lead_ad',
        metadata: {
          formId: form_id,
          fields: fieldData,
        },
      },
    });

    console.log(`🎯 Instagram Lead Ad: ${fieldData.full_name || 'Unknown'}`);

  } catch (error) {
    console.error('Error processing lead ad:', error);
  }
}
