import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - Детали лида
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: params.id },
      include: {
        touches: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        aiConversations: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 20,
            },
          },
        },
        deals: {
          orderBy: { createdAt: 'desc' },
        },
        notes: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    
    return NextResponse.json({ lead });
    
  } catch (error) {
    console.error('Error fetching lead:', error);
    return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 });
  }
}

// PATCH - Обновить лида
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json();
    
    const updateData: any = {};
    
    // Поля для обновления
    const allowedFields = [
      'name', 'firstName', 'lastName', 'company', 'position',
      'phone', 'email', 'telegram', 'whatsapp',
      'score', 'segment', 'status', 'tags',
      'assignedTo', 'nextAction', 'nextActionAt', 'lostReason',
    ];
    
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }
    
    // Если меняется статус - обновляем lastContactAt
    if (data.status && data.status !== 'new') {
      updateData.lastContactAt = new Date();
    }
    
    const lead = await prisma.lead.update({
      where: { id: params.id },
      data: updateData,
    });
    
    return NextResponse.json({ lead });
    
  } catch (error) {
    console.error('Error updating lead:', error);
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
  }
}

// DELETE - Удалить лида
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.lead.delete({
      where: { id: params.id },
    });
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Error deleting lead:', error);
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 });
  }
}

