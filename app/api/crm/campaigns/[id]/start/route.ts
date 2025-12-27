import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST - Запустить кампанию
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id;
    
    // Получаем кампанию
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        template: true,
      },
    });
    
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    
    if (campaign.status === 'running') {
      return NextResponse.json({ error: 'Campaign is already running' }, { status: 400 });
    }
    
    // Получаем лиды по сегменту
    const segment = (campaign.segment as any)?.segment || 'all';
    const where: any = {
      status: { in: ['new', 'contacted'] },
    };
    
    if (segment !== 'all') {
      where.segment = segment;
    }
    
    // Добавляем фильтр по каналу
    if (campaign.channel === 'email') {
      where.email = { not: null };
    } else if (campaign.channel === 'telegram') {
      where.telegram = { not: null };
    } else if (campaign.channel === 'sms') {
      where.phone = { not: null };
    }
    
    const leads = await prisma.lead.findMany({
      where,
      take: 100, // Ограничиваем первую партию
    });
    
    // Обновляем статус кампании
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'running',
        stats: {
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          replied: 0,
          total: leads.length,
        },
      },
    });
    
    // Создаём касания для каждого лида
    let sentCount = 0;
    
    for (const lead of leads) {
      try {
        // Персонализируем шаблон
        let message = campaign.template?.body || 'Привет!';
        message = message
          .replace(/\{\{name\}\}/g, lead.firstName || lead.name || 'Привет')
          .replace(/\{\{company\}\}/g, lead.company || 'вашем заведении');
        
        // Создаём касание
        await prisma.touch.create({
          data: {
            leadId: lead.id,
            channel: campaign.channel,
            direction: 'outbound',
            content: message,
            subject: campaign.template?.subject?.replace(/\{\{company\}\}/g, lead.company || '') || null,
            status: 'pending',
            campaignId: campaign.id,
            performedBy: 'campaign',
          },
        });
        
        // Обновляем статус лида
        if (lead.status === 'new') {
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              status: 'contacted',
              lastContactAt: new Date(),
            },
          });
        }
        
        sentCount++;
        
      } catch (error) {
        console.error(`Error processing lead ${lead.id}:`, error);
      }
    }
    
    // Обновляем статистику
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        stats: {
          sent: sentCount,
          delivered: 0,
          opened: 0,
          clicked: 0,
          replied: 0,
          total: leads.length,
        },
      },
    });
    
    return NextResponse.json({
      success: true,
      processed: sentCount,
      total: leads.length,
    });
    
  } catch (error) {
    console.error('Error starting campaign:', error);
    return NextResponse.json({ error: 'Failed to start campaign' }, { status: 500 });
  }
}

