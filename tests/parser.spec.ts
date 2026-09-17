import { describe, expect, it } from 'vitest'
import { parseTaskInput } from '@/domain/parser'

const now = new Date('2026-03-10T09:00:00+08:00')

describe('parseTaskInput', () => {
  it('parses priority, date, time and tags without polluting title', () => {
    const result = parseTaskInput('!! 明天 10:30 提交设计稿 #工作 #重要', now)
    expect(result.title).toBe('提交设计稿')
    expect(result.priority).toBe(2)
    expect(result.scheduledDate).toBe('2026-03-11')
    expect(result.tags).toEqual(['工作', '重要'])
    expect(new Date(result.dueAt!).getHours()).toBe(10)
    expect(new Date(result.dueAt!).getMinutes()).toBe(30)
  })

  it('deduplicates tags', () => {
    expect(parseTaskInput('任务 #工作 #工作', now).tags).toEqual(['工作'])
  })

  it('parses next weekday', () => {
    expect(parseTaskInput('周五 发布版本', now).scheduledDate).toBe('2026-03-13')
  })
})
