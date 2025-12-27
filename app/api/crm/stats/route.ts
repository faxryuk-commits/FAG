import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Статистика воронки
    const pipeline = await prisma.lead.groupBy({
      by: ['status'],
      _count: true,
    });
    
    const pipelineStats = {
      new: 0,
      contacted: 0,
      qualified: 0,
      demo_scheduled: 0,
      demo_done: 0,
      negotiation: 0,
      won: 0,
      lost: 0,
      nurturing: 0,
    };
    
    for (const item of pipeline) {
      if (item.status in pipelineStats) {
        pipelineStats[item.status as keyof typeof pipelineStats] = item._count;
      }
    }
    
    // Общая статистика
    const totalLeads = await prisma.lead.count();
    
    const activeLeads = await prisma.lead.count({
      where: {
        status: {
          notIn: ['won', 'lost'],
        },
      },
    });
    
    // Касания за сегодня
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayTouches = await prisma.touch.count({
      where: {
        createdAt: {
          gte: today,
        },
      },
    });
    
    // Конверсия (won / total * 100)
    const conversionRate = totalLeads > 0 
      ? (pipelineStats.won / totalLeads) * 100 
      : 0;
    
    // Средний скоринг
    const avgScoreResult = await prisma.lead.aggregate({
      _avg: {
        score: true,
      },
    });
    const avgScore = avgScoreResult._avg.score || 0;
    
    // По сегментам
    const segments = await prisma.lead.groupBy({
      by: ['segment'],
      _count: true,
    });
    
    const segmentStats = {
      hot: 0,
      warm: 0,
      cold: 0,
      enterprise: 0,
    };
    
    for (const item of segments) {
      if (item.segment && item.segment in segmentStats) {
        segmentStats[item.segment as keyof typeof segmentStats] = item._count;
      }
    }
    
    return NextResponse.json({
      pipeline: pipelineStats,
      dashboard: {
        totalLeads,
        activeLeads,
        todayTouches,
        conversionRate,
        avgScore,
        hotLeads: segmentStats.hot,
        warmLeads: segmentStats.warm,
        coldLeads: segmentStats.cold,
      },
    });
    
  } catch (error) {
    console.error('Error fetching CRM stats:', error);
    return NextResponse.json({ 
      pipeline: {},
      dashboard: {
        totalLeads: 0,
        activeLeads: 0,
        todayTouches: 0,
        conversionRate: 0,
        avgScore: 0,
        hotLeads: 0,
        warmLeads: 0,
        coldLeads: 0,
      },
    });
  }
}

