import { prisma } from '@/lib/prisma';
import { startRestaurantSync, SyncSource } from './sync';

/**
 * Интерфейс для запланированной задачи парсинга
 */
export interface ScheduledTask {
  id: string;
  source: SyncSource;
  searchQuery: string;
  location: string;
  maxResults: number;
  cronExpression: string;
  isActive: boolean;
  lastRun: Date | null;
  nextRun: Date | null;
}

/**
 * Расписание CRON:
 * ┌───────────── минута (0 - 59)
 * │ ┌───────────── час (0 - 23)
 * │ │ ┌───────────── день месяца (1 - 31)
 * │ │ │ ┌───────────── месяц (1 - 12)
 * │ │ │ │ ┌───────────── день недели (0 - 6) (воскресенье = 0)
 * │ │ │ │ │
 * * * * * *
 * 
 * Примеры:
 * "0 3 * * *"   - каждый день в 3:00
 * "0 */6 * * *" - каждые 6 часов
 * "0 0 * * 1"   - каждый понедельник в 00:00
 * "0 9 1 * *"   - первого числа каждого месяца в 9:00
 */

/**
 * Предустановленные расписания
 */
export const SCHEDULE_PRESETS = {
  daily: { label: 'Ежедневно в 3:00', cron: '0 3 * * *' },
  twiceDaily: { label: 'Дважды в день (9:00 и 21:00)', cron: '0 9,21 * * *' },
  weekly: { label: 'Еженедельно (понедельник 3:00)', cron: '0 3 * * 1' },
  everyHour: { label: 'Каждый час', cron: '0 * * * *' },
  every6Hours: { label: 'Каждые 6 часов', cron: '0 */6 * * *' },
  every12Hours: { label: 'Каждые 12 часов', cron: '0 */12 * * *' },
} as const;

/**
 * Парсит CRON выражение и вычисляет следующий запуск
 */
export function getNextRunTime(cronExpression: string, fromDate = new Date()): Date {
  const parts = cronExpression.split(' ');
  if (parts.length !== 5) {
    throw new Error('Invalid cron expression');
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const next = new Date(fromDate);
  next.setSeconds(0);
  next.setMilliseconds(0);

  // Упрощенный парсер для базовых случаев
  const parseField = (field: string, current: number, max: number): number => {
    if (field === '*') return current;
    if (field.includes('/')) {
      const step = parseInt(field.split('/')[1]);
      return Math.ceil((current + 1) / step) * step;
    }
    if (field.includes(',')) {
      const values = field.split(',').map(Number);
      const next = values.find(v => v > current);
      return next !== undefined ? next : values[0];
    }
    return parseInt(field);
  };

  // Простая логика - следующий час/минута согласно cron
  if (hour !== '*') {
    const targetHour = parseInt(hour.includes(',') ? hour.split(',')[0] : hour);
    if (next.getHours() >= targetHour) {
      next.setDate(next.getDate() + 1);
    }
    next.setHours(targetHour);
  }

  if (minute !== '*') {
    next.setMinutes(parseInt(minute));
  } else {
    next.setMinutes(0);
  }

  return next;
}

/**
 * Проверяет, нужно ли запустить задачу
 */
export function shouldRunTask(task: ScheduledTask): boolean {
  if (!task.isActive) return false;
  if (!task.nextRun) return true;
  
  return new Date() >= new Date(task.nextRun);
}

/**
 * Создаёт новую запланированную задачу
 */
export async function createScheduledTask(
  source: SyncSource,
  searchQuery: string,
  location: string,
  maxResults: number,
  cronExpression: string
): Promise<any> {
  const nextRun = getNextRunTime(cronExpression);
  
  return prisma.scheduledTask.create({
    data: {
      source,
      searchQuery,
      location,
      maxResults,
      cronExpression,
      isActive: true,
      nextRun,
    },
  });
}

/**
 * Запускает запланированные задачи (вызывается по cron/vercel)
 */
export async function runScheduledTasks(): Promise<{ ran: number; errors: number }> {
  const tasks = await prisma.scheduledTask.findMany({
    where: { isActive: true },
  });

  let ran = 0;
  let errors = 0;

  for (const task of tasks) {
    if (!shouldRunTask(task as ScheduledTask)) continue;

    try {
      await startRestaurantSync({
        source: task.source as SyncSource,
        searchQuery: task.searchQuery,
        location: task.location,
        maxResults: task.maxResults,
      });

      // Обновляем время последнего и следующего запуска
      await prisma.scheduledTask.update({
        where: { id: task.id },
        data: {
          lastRun: new Date(),
          nextRun: getNextRunTime(task.cronExpression),
        },
      });

      ran++;
    } catch (error) {
      console.error(`Error running scheduled task ${task.id}:`, error);
      errors++;
    }
  }

  return { ran, errors };
}

/**
 * Получает все запланированные задачи
 */
export async function getScheduledTasks(): Promise<ScheduledTask[]> {
  const tasks = await prisma.scheduledTask.findMany({
    orderBy: { createdAt: 'desc' },
  });
  
  return tasks as ScheduledTask[];
}

/**
 * Обновляет задачу
 */
export async function updateScheduledTask(
  id: string, 
  data: Partial<Pick<ScheduledTask, 'isActive' | 'cronExpression' | 'searchQuery' | 'location' | 'maxResults'>>
) {
  const updateData: any = { ...data };
  
  if (data.cronExpression) {
    updateData.nextRun = getNextRunTime(data.cronExpression);
  }
  
  return prisma.scheduledTask.update({
    where: { id },
    data: updateData,
  });
}

/**
 * Удаляет задачу
 */
export async function deleteScheduledTask(id: string) {
  return prisma.scheduledTask.delete({
    where: { id },
  });
}

