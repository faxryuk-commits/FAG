import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendSMSViaGateway } from '@/lib/crm/sms-gateway';
import { generateSmartFirstContact } from '@/lib/crm/openai-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 секунд для обработки

// POST - Запустить кампанию
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id;
    const { dryRun = false, limit = 10 } = await request.json().catch(() => ({}));
    
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
      // Только мобильные телефоны!
      where.phone = { not: null };
      where.phoneType = 'mobile';
    }
    
    // Исключаем лидов, которые уже получили сообщение в этой кампании
    const alreadySent = await prisma.touch.findMany({
      where: { campaignId },
      select: { leadId: true },
    });
    const sentLeadIds = alreadySent.map(t => t.leadId);
    
    if (sentLeadIds.length > 0) {
      where.id = { notIn: sentLeadIds };
    }
    
    const leads = await prisma.lead.findMany({
      where,
      take: limit, // Контролируемый размер партии
      orderBy: { score: 'desc' }, // Сначала горячие лиды
    });
    
    console.log(`[Campaign ${campaignId}] Found ${leads.length} leads to process`);
    
    if (leads.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Нет подходящих лидов для рассылки',
        processed: 0,
        total: 0,
        skipped: {
          alreadySent: sentLeadIds.length,
          reason: campaign.channel === 'sms' ? 'Нет лидов с мобильными телефонами' : 'Нет лидов с нужными контактами'
        }
      });
    }
    
    // Обновляем статус кампании
    if (!dryRun) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'running' },
      });
    }
    
    // Результаты
    const results = {
      sent: 0,
      failed: 0,
      skipped: 0,
      details: [] as Array<{ lead: string; status: string; error?: string }>,
    };
    
    for (const lead of leads) {
      try {
        // Генерируем или используем шаблон
        let message: string;
        
        if (campaign.template?.body) {
          // Используем шаблон
          message = campaign.template.body
            .replace(/\{\{name\}\}/g, lead.firstName || lead.name || '')
            .replace(/\{\{company\}\}/g, lead.company || '')
            .replace(/\{\{first_name\}\}/g, lead.firstName || '');
        } else {
          // Генерируем через AI
          const aiResult = await generateSmartFirstContact({
            id: lead.id,
            name: lead.name,
            firstName: lead.firstName,
            lastName: lead.lastName,
            company: lead.company,
            segment: lead.segment,
            score: lead.score,
            tags: lead.tags,
            source: lead.source,
          });
          
          if (!aiResult.success || !aiResult.message) {
            results.skipped++;
            results.details.push({ lead: lead.name || lead.id, status: 'skipped', error: aiResult.error });
            continue;
          }
          
          message = aiResult.message;
        }
        
        // Dry run - только показываем что отправили бы
        if (dryRun) {
          results.details.push({ 
            lead: lead.name || lead.company || lead.id, 
            status: 'preview',
            error: message.substring(0, 100) + '...'
          });
          results.sent++;
          continue;
        }
        
        // Реальная отправка
        let sendResult: { success: boolean; error?: string; messageId?: string } = { success: false, error: 'Unknown channel' };
        
        if (campaign.channel === 'sms' && lead.phone) {
          sendResult = await sendSMSViaGateway(lead.phone, message);
        } else if (campaign.channel === 'telegram' && lead.telegram) {
          // TODO: Telegram отправка
          sendResult = { success: false, error: 'Telegram sending not implemented yet' };
        }
        
        // Создаём касание
        await prisma.touch.create({
          data: {
            leadId: lead.id,
            channel: campaign.channel,
            direction: 'outbound',
            content: message,
            status: sendResult.success ? 'sent' : 'failed',
            campaignId: campaign.id,
            performedBy: 'campaign',
            metadata: {
              sendResult,
              generatedAt: new Date().toISOString(),
            },
          },
        });
        
        // Обновляем статус лида
        if (sendResult.success) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              status: lead.status === 'new' ? 'contacted' : lead.status,
              lastContactAt: new Date(),
            },
          });
          results.sent++;
          results.details.push({ lead: lead.name || lead.id, status: 'sent' });
        } else {
          results.failed++;
          results.details.push({ lead: lead.name || lead.id, status: 'failed', error: sendResult.error });
        }
        
      } catch (error) {
        console.error(`[Campaign] Error processing lead ${lead.id}:`, error);
        results.failed++;
        results.details.push({ 
          lead: lead.name || lead.id, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
    
    // Обновляем статистику кампании
    const currentStats = (campaign.stats as any) || {};
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: results.sent > 0 ? 'running' : 'paused',
        stats: {
          sent: (currentStats.sent || 0) + results.sent,
          failed: (currentStats.failed || 0) + results.failed,
          delivered: currentStats.delivered || 0,
          opened: currentStats.opened || 0,
          replied: currentStats.replied || 0,
          total: (currentStats.total || 0) + leads.length,
        },
      },
    });
    
    return NextResponse.json({
      success: true,
      dryRun,
      processed: leads.length,
      sent: results.sent,
      failed: results.failed,
      skipped: results.skipped,
      details: results.details.slice(0, 10), // Первые 10 для UI
      hasMore: leads.length === limit,
    });
    
  } catch (error) {
    console.error('Error starting campaign:', error);
    return NextResponse.json({ 
      error: 'Failed to start campaign',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

