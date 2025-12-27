import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - Получить последние касания (активность)
export async function GET() {
  try {
    const touches = await prisma.touch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100, // Последние 100 событий
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            firstName: true,
            company: true,
            phone: true,
            telegram: true,
          },
        },
      },
    });

    return NextResponse.json({ touches });
  } catch (error) {
    console.error('Error fetching touches:', error);
    return NextResponse.json({ touches: [] });
  }
}

