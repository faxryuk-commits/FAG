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
  let verifyToken = 'delever_instagram_2024'; // Default token
  try {
    const settings = await prisma.cRMSettings.findFirst();
    if (settings?.instagramVerifyToken) {
      verifyToken = settings.instagramVerifyToken;
    }
  } catch (e) {
    console.log('Using default verify token');
  }

  console.log(`Instagram webhook verify: mode=${mode}, token=${token}, expected=${verifyToken}`);

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Instagram webhook verified');
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden', received: token, expected: verifyToken }, { status: 403 });
}

// POST - Получение событий от Instagram
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('📸 Instagram webhook received:', JSON.stringify(body, null, 2));

    // Обрабатываем разные типы событий
    if (body.object === 'instagram') {
      for (const entry of body.entry || []) {
        // Direct Messages
        if (entry.messaging) {
          for (const event of entry.messaging) {
            await handleDirectMessage(event);
          }
        }
        
        // Comments
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === 'comments') {
              await handleComment(change.value);
            }
            if (change.field === 'mentions') {
              await handleMention(change.value);
            }
          }
        }
      }
    }

    // Lead Ads (реклама с формой)
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

// Обработка Direct сообщений
async function handleDirectMessage(event: any) {
  console.log('📩 handleDirectMessage called:', JSON.stringify(event));
  
  const senderId = event.sender?.id;
  const message = event.message;
  
  if (!senderId || !message) {
    console.log('❌ Missing senderId or message:', { senderId, message });
    return;
  }
  
  try {

  // Ищем лида по всем полям (instagramId хранится в telegram поле временно)
  const allLeads = await prisma.lead.findMany({
    where: {
      OR: [
        { telegram: senderId },
        { telegram: { contains: senderId } },
      ],
    },
    take: 1,
  });
  
  let lead = allLeads[0] || null;

  if (!lead) {
    // Создаём нового лида из Instagram
    lead = await prisma.lead.create({
      data: {
        name: event.sender?.name || `Instagram User ${senderId.slice(-6)}`,
        telegram: `ig_${senderId}`, // Храним IG ID с префиксом
        source: 'instagram_dm',
        status: 'new',
        segment: 'warm',
        score: 55,
        metadata: {
          instagramId: senderId,
          instagramUsername: event.sender?.username,
        },
      },
    });
  }

  // Создаём touch
  await prisma.touch.create({
    data: {
      leadId: lead.id,
      channel: 'instagram',
      direction: 'inbound',
      content: message.text || '[медиа]',
      status: 'completed',
      performedBy: 'instagram',
      metadata: {
        messageId: message.mid,
        attachments: message.attachments,
      },
    },
  });

  // Повышаем скор за активность
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      score: Math.min(100, lead.score + 5),
      lastContactAt: new Date(),
    },
  });

  console.log(`📩 Instagram DM from ${senderId}: ${message.text?.slice(0, 50)}...`);
  console.log('✅ Lead created/updated:', lead.id);
  
  } catch (error) {
    console.error('❌ Error in handleDirectMessage:', error);
  }
}

// Обработка комментариев
async function handleComment(data: any) {
  const { id, text, from, media } = data;
  
  if (!from?.id) return;

  // Ищем лида по telegram полю (где храним IG ID)
  const allLeads = await prisma.lead.findMany({
    where: {
      OR: [
        { telegram: from.id },
        { telegram: `ig_${from.id}` },
      ],
    },
    take: 1,
  });
  
  let lead = allLeads[0] || null;

  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        name: from.username || `IG User ${from.id.slice(-6)}`,
        telegram: `ig_${from.id}`,
        source: 'instagram_comment',
        status: 'new',
        segment: 'cold',
        score: 35,
        metadata: {
          instagramId: from.id,
          instagramUsername: from.username,
        },
      },
    });
  }

  // Создаём touch
  await prisma.touch.create({
    data: {
      leadId: lead.id,
      channel: 'instagram',
      direction: 'inbound',
      content: `💬 Комментарий: ${text}`,
      status: 'completed',
      performedBy: 'instagram',
      metadata: {
        commentId: id,
        mediaId: media?.id,
        mediaUrl: media?.permalink,
      },
    },
  });

  console.log(`💬 Instagram comment from ${from.username}: ${text?.slice(0, 50)}...`);
}

// Обработка упоминаний
async function handleMention(data: any) {
  const { media_id, comment_id } = data;
  
  // Создаём touch с упоминанием
  // Нужен дополнительный API-запрос для получения деталей
  console.log(`🏷️ Instagram mention: media=${media_id}, comment=${comment_id}`);
}

// Обработка Lead Ads (реклама с формой)
async function handleLeadAd(data: any) {
  const { leadgen_id, page_id, form_id, created_time } = data;
  
  // Для получения данных лида нужен дополнительный API запрос
  // GET /{leadgen_id}?access_token={page_access_token}
  
  const settings = await prisma.cRMSettings.findFirst();
  if (!settings?.instagramAccessToken) {
    console.error('No Instagram access token configured');
    return;
  }

  try {
    // Получаем данные лида
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${leadgen_id}?access_token=${settings.instagramAccessToken}`
    );
    const leadData = await response.json();

    if (leadData.error) {
      console.error('Error fetching lead data:', leadData.error);
      return;
    }

    // Парсим поля формы
    const fieldData: Record<string, string> = {};
    for (const field of leadData.field_data || []) {
      fieldData[field.name] = field.values?.[0] || '';
    }

    // Создаём лида в CRM
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
        segment: 'hot', // Lead Ads = горячий лид
        score: 75,
        metadata: {
          leadgenId: leadgen_id,
          formId: form_id,
          pageId: page_id,
          createdTime: created_time,
          rawFields: fieldData,
        },
      },
    });

    // Создаём touch
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

    console.log(`🎯 Instagram Lead Ad: ${fieldData.full_name || 'Unknown'} - ${fieldData.email || fieldData.phone}`);

  } catch (error) {
    console.error('Error processing lead ad:', error);
  }
}

