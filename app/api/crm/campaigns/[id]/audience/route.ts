import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - Получить целевую аудиторию кампании
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id;
    
    // Получаем кампанию
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    
    // Формируем условия фильтрации
    const segment = (campaign.segment as any)?.segment || 'all';
    const where: any = {
      status: { in: ['new', 'contacted'] },
    };
    
    // Фильтр по сегменту
    if (segment !== 'all') {
      where.segment = segment;
    }
    
    // Фильтр по каналу (должен быть контакт)
    if (campaign.channel === 'email') {
      where.email = { not: null };
    } else if (campaign.channel === 'telegram') {
      where.telegram = { not: null };
    } else if (campaign.channel === 'sms') {
      where.phone = { not: null };
      where.phoneType = 'mobile';
    }
    
    // Исключаем тех, кому уже отправили в этой кампании
    const alreadySent = await prisma.touch.findMany({
      where: { campaignId },
      select: { leadId: true },
    });
    const sentLeadIds = alreadySent.map(t => t.leadId);
    
    if (sentLeadIds.length > 0) {
      where.id = { notIn: sentLeadIds };
    }
    
    // Получаем общее количество
    const total = await prisma.lead.count({ where });
    
    // Получаем первых 20 для превью
    const leads = await prisma.lead.findMany({
      where,
      take: 20,
      orderBy: { score: 'desc' },
      select: {
        id: true,
        name: true,
        firstName: true,
        company: true,
        phone: true,
        telegram: true,
        email: true,
        segment: true,
        score: true,
      },
    });
    
    return NextResponse.json({
      total,
      leads: leads.map(l => ({
        ...l,
        name: l.firstName || l.name,
      })),
      alreadySent: sentLeadIds.length,
      filters: {
        segment,
        channel: campaign.channel,
        status: ['new', 'contacted'],
      },
    });
    
  } catch (error) {
    console.error('Error fetching audience:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch audience',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

