import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7d';
    
    // Определяем даты
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Статистика воронки
    const pipeline = await prisma.lead.groupBy({
      by: ['status'],
      _count: true,
    });
    
    const pipelineStats: Record<string, number> = {
      new: 0,
      contacted: 0,
      qualified: 0,
      demo_scheduled: 0,
      demo_done: 0,
      negotiation: 0,
      won: 0,
      lost: 0,
    };
    
    for (const item of pipeline) {
      if (item.status in pipelineStats) {
        pipelineStats[item.status] = item._count;
      }
    }
    
    // Конверсии
    const total = Object.values(pipelineStats).reduce((a, b) => a + b, 0) || 1;
    const conversions = {
      contactRate: total > 0 ? ((pipelineStats.contacted + pipelineStats.qualified + pipelineStats.demo_scheduled + pipelineStats.demo_done + pipelineStats.negotiation + pipelineStats.won) / total) * 100 : 0,
      qualificationRate: pipelineStats.contacted > 0 ? ((pipelineStats.qualified + pipelineStats.demo_scheduled + pipelineStats.demo_done + pipelineStats.negotiation + pipelineStats.won) / pipelineStats.contacted) * 100 : 0,
      demoRate: pipelineStats.qualified > 0 ? ((pipelineStats.demo_done + pipelineStats.negotiation + pipelineStats.won) / pipelineStats.qualified) * 100 : 0,
      closeRate: (pipelineStats.demo_done + pipelineStats.negotiation) > 0 ? (pipelineStats.won / (pipelineStats.demo_done + pipelineStats.negotiation)) * 100 : 0,
    };
    
    // Статистика по каналам
    const touchesByChannel = await prisma.touch.groupBy({
      by: ['channel', 'status'],
      _count: true,
      where: {
        createdAt: { gte: startDate },
      },
    });
    
    const channels: Record<string, { sent: number; delivered: number; opened: number; replied: number }> = {
      email: { sent: 0, delivered: 0, opened: 0, replied: 0 },
      sms: { sent: 0, delivered: 0, opened: 0, replied: 0 },
      telegram: { sent: 0, delivered: 0, opened: 0, replied: 0 },
    };
    
    for (const item of touchesByChannel) {
      const channel = item.channel as string;
      if (channels[channel]) {
        if (item.status === 'sent' || item.status === 'pending') {
          channels[channel].sent += item._count;
        } else if (item.status === 'delivered') {
          channels[channel].delivered += item._count;
        } else if (item.status === 'opened') {
          channels[channel].opened += item._count;
        } else if (item.status === 'replied') {
          channels[channel].replied += item._count;
        }
      }
    }
    
    // AI статистика
    const aiStats = await prisma.aIConversation.groupBy({
      by: ['status'],
      _count: true,
      where: {
        createdAt: { gte: startDate },
      },
    });
    
    let aiConversationsStarted = 0;
    let aiEscalated = 0;
    let aiAutoConverted = 0;
    
    for (const item of aiStats) {
      aiConversationsStarted += item._count;
      if (item.status === 'escalated') {
        aiEscalated = item._count;
      } else if (item.status === 'completed') {
        aiAutoConverted = item._count;
      }
    }
    
    return NextResponse.json({
      pipeline: pipelineStats,
      conversions,
      channels,
      ai: {
        conversationsStarted: aiConversationsStarted,
        escalated: aiEscalated,
        autoConverted: aiAutoConverted,
      },
      topPerformers: [], // TODO: добавить когда будут сделки
    });
    
  } catch (error) {
    console.error('Error fetching CRM analytics:', error);
    return NextResponse.json({
      pipeline: {},
      conversions: {},
      channels: {},
      ai: {},
      topPerformers: [],
    });
  }
}

