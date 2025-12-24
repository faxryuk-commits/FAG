import { NextResponse } from 'next/server';
import { SCRAPERS, calculateCost } from '@/lib/apify/scrapers';

/**
 * GET /api/scrapers - Получить список доступных скреперов
 */
export async function GET() {
  const scrapers = SCRAPERS.map(scraper => ({
    id: scraper.id,
    name: scraper.name,
    description: scraper.description,
    icon: scraper.icon,
    costPerItem: scraper.costPerItem,
    avgTimePerItem: scraper.avgTimePerItem,
    fields: scraper.fields,
    inputFields: scraper.inputFields,
  }));

  return NextResponse.json({ scrapers });
}

/**
 * POST /api/scrapers/calculate - Расчет стоимости
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { scraperId, count } = body;

  const result = calculateCost(scraperId, count);
  
  return NextResponse.json(result);
}

