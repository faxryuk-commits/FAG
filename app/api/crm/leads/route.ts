import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - Список лидов с фильтрами
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const segment = searchParams.get('segment') || 'all';
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Формируем условия
    const where: any = {};
    
    if (status !== 'all') {
      where.status = status;
    }
    
    if (segment !== 'all') {
      where.segment = segment;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    // Получаем лиды
    const leads = await prisma.lead.findMany({
      where,
      orderBy: [
        { score: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
      skip: offset,
      include: {
        _count: {
          select: {
            touches: true,
            aiConversations: true,
          },
        },
      },
    });
    
    const total = await prisma.lead.count({ where });
    
    return NextResponse.json({ 
      leads,
      total,
      hasMore: offset + limit < total,
    });
    
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}

// POST - Создать нового лида
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    const lead = await prisma.lead.create({
      data: {
        name: data.name,
        firstName: data.firstName,
        lastName: data.lastName,
        company: data.company,
        position: data.position,
        phone: data.phone,
        email: data.email,
        telegram: data.telegram,
        whatsapp: data.whatsapp,
        source: data.source || 'manual',
        score: data.score || 0,
        segment: data.segment || 'cold',
        tags: data.tags || [],
        status: 'new',
      },
    });
    
    return NextResponse.json({ lead });
    
  } catch (error) {
    console.error('Error creating lead:', error);
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}

