import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TaskRow from '@/components/TaskRow.vue'
import { useTodoStore } from '@/stores/todo'

describe('task row editing', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  function setup(raw = '整理资料', compact = false) {
    const store = useTodoStore()
    const task = store.addTask(raw)!
    const wrapper = mount(TaskRow, { props: { task, compact } })
    return { store, task, wrapper }
  }

  it('edits priority and local date/time without changing the title, then persists them together', async () => {
    const { store, task, wrapper } = setup()
    await wrapper.get('[aria-label="更多操作"]').trigger('click')
    await wrapper.get('.task-menu__popover button').trigger('click')
    await wrapper.get('[aria-label="优先级"]').setValue('3')
    await wrapper.get('[aria-label="任务名称"]').trigger('blur')
    expect(wrapper.find('form').exists()).toBe(true)
    expect(task.priority).toBe(0)
    expect(wrapper.attributes('draggable')).toBe('false')
    await wrapper.get('[aria-label="日期"]').setValue('2026-09-20')
    await wrapper.get('[aria-label="时间"]').setValue('00:30')
    await wrapper.get('form').trigger('submit')

    expect(task).toMatchObject({ title: '整理资料', priority: 3, scheduledDate: '2026-09-20',
      dueAt: new Date(2026, 8, 20, 0, 30).toISOString(), status: 'active', listId: 'today', revision: 2 })
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.get('.task-row__meta').text()).toContain('2026-09-20')
    expect(JSON.parse(localStorage.getItem('floating-todo:data:v1')!).tasks[0]).toMatchObject({ priority: 3, dueAt: task.dueAt })
    expect(store.activeTasks[0].id).toBe(task.id)
    wrapper.unmount()
  })

  it('loads existing values and preserves timestamp precision when only the title changes', async () => {
    const { task, wrapper } = setup('!! 今天 整理资料')
    task.dueAt = new Date(2026, 8, 18, 23, 45, 30, 123).toISOString()
    task.scheduledDate = '2026-09-18'
    const dueAt = task.dueAt
    await wrapper.trigger('dblclick')
    expect((wrapper.get('[aria-label="优先级"]').element as HTMLSelectElement).value).toBe('2')
    expect((wrapper.get('[aria-label="日期"]').element as HTMLInputElement).value).toBe('2026-09-18')
    expect((wrapper.get('[aria-label="时间"]').element as HTMLInputElement).value).toBe('23:45')
    await wrapper.get('[aria-label="任务名称"]').setValue('  更新资料  ')
    await wrapper.get('form').trigger('submit')
    expect(task.title).toBe('更新资料')
    expect(task.dueAt).toBe(dueAt)
    wrapper.unmount()
  })

  it('can clear only the time, or clear the entire schedule and priority', async () => {
    const { task, wrapper } = setup('!!! 今天 10:00 整理资料')
    const date = task.scheduledDate
    await wrapper.trigger('dblclick')
    await wrapper.get('[aria-label="时间"]').setValue('')
    await wrapper.get('form').trigger('submit')
    expect(task).toMatchObject({ scheduledDate: date, dueAt: null, status: 'active' })
    await wrapper.trigger('dblclick')
    await wrapper.get('.task-row__clear-date').trigger('click')
    await wrapper.get('[aria-label="优先级"]').setValue('0')
    await wrapper.get('form').trigger('submit')
    expect(task).toMatchObject({ priority: 0, scheduledDate: null, dueAt: null, status: 'inbox', listId: 'inbox' })
    wrapper.unmount()
  })

  it('discards all draft fields on cancel or Escape, including in compact mode', async () => {
    const { task, wrapper } = setup('整理资料', true)
    for (const escape of [false, true]) {
      await wrapper.trigger('dblclick')
      await wrapper.get('[aria-label="任务名称"]').setValue('未保存')
      await wrapper.get('[aria-label="优先级"]').setValue('2')
      await wrapper.get('[aria-label="日期"]').setValue('2026-09-21')
      await wrapper.get('[aria-label="时间"]').setValue('09:00')
      // Double-clicking a form control must not reinitialize the draft.
      await wrapper.get('[aria-label="任务名称"]').trigger('dblclick')
      expect((wrapper.get('[aria-label="任务名称"]').element as HTMLInputElement).value).toBe('未保存')
      if (escape) await wrapper.get('[aria-label="时间"]').trigger('keydown', { key: 'Escape' })
      else await wrapper.findAll('button').find((button) => button.text() === '取消')!.trigger('click')
      expect(task).toMatchObject({ title: '整理资料', priority: 0, scheduledDate: null, dueAt: null, revision: 1 })
      expect(wrapper.find('form').exists()).toBe(false)
    }
    wrapper.unmount()
  })

  it('rejects blank titles and does not save while confirming Chinese IME input', async () => {
    const { task, wrapper } = setup()
    await wrapper.trigger('dblclick')
    await wrapper.get('[aria-label="任务名称"]').setValue('   ')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.find('form').exists()).toBe(true)
    expect(task.title).toBe('整理资料')
    await wrapper.get('[aria-label="任务名称"]').setValue('新名称')
    await wrapper.get('[aria-label="任务名称"]').trigger('keydown', { key: 'Enter', isComposing: true })
    expect(wrapper.find('form').exists()).toBe(true)
    expect(task.title).toBe('整理资料')
    wrapper.unmount()
  })

  it('keeps completed tasks completed when rescheduling', async () => {
    const { store, task, wrapper } = setup('今天 整理资料')
    store.completeTask(task.id)
    const completedAt = task.completedAt
    await wrapper.trigger('dblclick')
    await wrapper.get('[aria-label="日期"]').setValue('2026-09-22')
    await wrapper.get('form').trigger('submit')
    expect(task).toMatchObject({ scheduledDate: '2026-09-22', status: 'completed', completedAt })
    wrapper.unmount()
  })
})
