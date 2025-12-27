import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - Список шаблонов
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channel = searchParams.get('channel');
    
    const where: any = {};
    if (channel) {
      where.channel = channel;
    }
    
    const templates = await prisma.messageTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    
    return NextResponse.json({ templates });
    
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ templates: [] });
  }
}

// POST - Создать шаблон
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Извлекаем переменные из текста
    const variableRegex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;
    while ((match = variableRegex.exec(data.body)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    
    const template = await prisma.messageTemplate.create({
      data: {
        name: data.name,
        channel: data.channel || 'telegram',
        type: data.type || 'outreach',
        subject: data.subject,
        body: data.body,
        variables,
      },
    });
    
    return NextResponse.json({ template });
    
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}

