import { NextRequest, NextResponse } from 'next/server';
import { 
  getScheduledTasks, 
  createScheduledTask, 
  updateScheduledTask, 
  deleteScheduledTask,
  runScheduledTasks,
  SCHEDULE_PRESETS 
} from '@/lib/apify/scheduler';
import { SyncSource } from '@/lib/apify/sync';

/**
 * GET /api/schedule - Получить все запланированные задачи
 */
export async function GET() {
  try {
    const tasks = await getScheduledTasks();
    
    return NextResponse.json({
      tasks,
      presets: SCHEDULE_PRESETS,
    });
  } catch (error) {
    console.error('Error fetching scheduled tasks:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/schedule - Создать новую задачу или запустить все задачи
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Если action = "run" - запустить все активные задачи
    if (body.action === 'run') {
      const result = await runScheduledTasks();
      return NextResponse.json({
        success: true,
        message: `Запущено задач: ${result.ran}, ошибок: ${result.errors}`,
        ...result,
      });
    }
    
    // Создание новой задачи
    const { source, searchQuery, location, maxResults, cronExpression } = body;
    
    if (!source || !cronExpression) {
      return NextResponse.json(
        { error: 'Missing required fields: source, cronExpression' },
        { status: 400 }
      );
    }
    
    const task = await createScheduledTask(
      source as SyncSource,
      searchQuery || 'рестораны',
      location || 'Москва',
      maxResults || 50,
      cronExpression
    );
    
    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Error creating scheduled task:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create task' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/schedule - Обновить задачу
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Missing task id' },
        { status: 400 }
      );
    }
    
    const task = await updateScheduledTask(id, data);
    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Error updating scheduled task:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update task' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/schedule - Удалить задачу
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Missing task id' },
        { status: 400 }
      );
    }
    
    await deleteScheduledTask(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting scheduled task:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete task' },
      { status: 500 }
    );
  }
}

