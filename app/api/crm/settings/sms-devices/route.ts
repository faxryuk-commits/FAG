import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - Получить список устройств
export async function GET() {
  try {
    const settings = await prisma.cRMSettings.findFirst();
    
    if (!settings || !settings.smsDevices) {
      return NextResponse.json({ devices: [] });
    }
    
    const devices = JSON.parse(settings.smsDevices);
    return NextResponse.json({ devices });
  } catch (error) {
    console.error('Error fetching SMS devices:', error);
    return NextResponse.json({ devices: [] });
  }
}

// POST - Сохранить список устройств
export async function POST(request: NextRequest) {
  try {
    const { devices } = await request.json();
    
    // Получаем или создаём настройки
    let settings = await prisma.cRMSettings.findFirst();
    
    if (settings) {
      await prisma.cRMSettings.update({
        where: { id: settings.id },
        data: { smsDevices: JSON.stringify(devices) },
      });
    } else {
      await prisma.cRMSettings.create({
        data: { smsDevices: JSON.stringify(devices) },
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving SMS devices:', error);
    return NextResponse.json({ error: 'Failed to save devices' }, { status: 500 });
  }
}

