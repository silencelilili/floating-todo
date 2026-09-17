import { describe, expect, it, vi } from 'vitest'
import { createTask, shouldAutoArchive, sortTasks, type Task } from '@/domain/task'

vi.stubGlobal('crypto', { randomUUID: () => 'test-id' })

const input = { title: '检查支付接口', tags: [], priority: 2 as const, scheduledDate: null, dueAt: null }

describe('task domain', () => {
  it('places an undated task in the inbox', () => {
    const now = new Date('2026-03-10T09:00:00+08:00')
    const task = createTask(input, 'main', now)
    expect(task).toMatchObject({
      id: 'test-id',
      status: 'inbox',
      listId: 'inbox',
      scheduledDate: null,
      priority: 2,
      revision: 1,
    })
  })

  it('places a task with an explicit date in the scheduled task list', () => {
    const task = createTask({ ...input, scheduledDate: '2026-03-11' }, 'main', new Date('2026-03-10T09:00:00+08:00'))
    expect(task).toMatchObject({ status: 'active', listId: 'today', scheduledDate: '2026-03-11' })
  })

  it('archives completed tasks on the next local day', () => {
    const task = createTask(input, 'main', new Date('2026-03-10T09:00:00+08:00'))
    task.status = 'completed'
    task.completedAt = '2026-03-10T15:00:00+08:00'
    expect(shouldAutoArchive(task, 'next-day', new Date('2026-03-10T23:59:00+08:00'))).toBe(false)
    expect(shouldAutoArchive(task, 'next-day', new Date('2026-03-11T00:01:00+08:00'))).toBe(true)
  })

  it('sorts pinned and priority tasks first', () => {
    const base = createTask(input, 'main', new Date())
    const tasks: Task[] = [
      { ...base, id: 'low', priority: 0, pinned: false, sortOrder: 1 },
      { ...base, id: 'high', priority: 3, pinned: false, sortOrder: 2 },
      { ...base, id: 'pin', priority: 0, pinned: true, sortOrder: 3 },
    ]
    expect(sortTasks(tasks).map((task) => task.id)).toEqual(['pin', 'high', 'low'])
  })
})
