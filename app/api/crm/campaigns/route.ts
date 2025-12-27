import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - Список кампаний
export async function GET(request: NextRequest) {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        template: true,
        _count: {
          select: {
            touches: true,
            sequence: true,
          },
        },
      },
    });
    
    return NextResponse.json({ campaigns });
    
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json({ campaigns: [] });
  }
}

// POST - Создать кампанию
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    const campaign = await prisma.campaign.create({
      data: {
        name: data.name,
        description: data.description,
        type: data.type || 'cold_outreach',
        channel: data.channel || 'telegram',
        status: 'draft',
        segment: data.segment ? { segment: data.segment } : undefined,
        templateId: data.templateId || undefined,
      },
    });
    
    return NextResponse.json({ campaign });
    
  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }
}

