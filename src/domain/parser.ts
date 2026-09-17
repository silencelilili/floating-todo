import { nextLocalDateKey, type ParsedTaskInput, type TaskPriority } from './task'

const DATE_TOKENS: Array<{ pattern: RegExp; days: number }> = [
  { pattern: /(?:^|\s)今天(?:\s|$)/, days: 0 },
  { pattern: /(?:^|\s)明天(?:\s|$)/, days: 1 },
  { pattern: /(?:^|\s)后天(?:\s|$)/, days: 2 },
]

function getNextWeekday(day: number, now: Date): string {
  const date = new Date(now)
  let delta = (day - date.getDay() + 7) % 7
  if (delta === 0) delta = 7
  date.setDate(date.getDate() + delta)
  return nextLocalDateKey(0, date)
}

const WEEKDAYS: Record<string, number> = {
  日: 0,
  天: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
}

export function parseTaskInput(raw: string, now = new Date()): ParsedTaskInput {
  let value = raw.trim().replace(/\s+/g, ' ')
  let priority: TaskPriority = 0

  const priorityMatch = value.match(/^(!{1,3})\s*/)
  if (priorityMatch) {
    priority = Math.min(priorityMatch[1].length, 3) as TaskPriority
    value = value.slice(priorityMatch[0].length)
  }

  const tags: string[] = []
  value = value.replace(/(?:^|\s)#([^\s#]+)/g, (_match, tag: string) => {
    tags.push(tag)
    return ' '
  })

  let scheduledDate: string | null = null
  for (const token of DATE_TOKENS) {
    if (token.pattern.test(value)) {
      scheduledDate = nextLocalDateKey(token.days, now)
      value = value.replace(token.pattern, ' ')
      break
    }
  }

  if (!scheduledDate) {
    const weekday = value.match(/(?:^|\s)(?:周|星期)([一二三四五六日天])(?:\s|$)/)
    if (weekday) {
      scheduledDate = getNextWeekday(WEEKDAYS[weekday[1]], now)
      value = value.replace(weekday[0], ' ')
    }
  }

  let dueAt: string | null = null
  const timeMatch = value.match(/(?:^|\s)([01]?\d|2[0-3]):([0-5]\d)(?:\s|$)/)
  if (timeMatch) {
    const dateKey = scheduledDate ?? nextLocalDateKey(0, now)
    const local = new Date(`${dateKey}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`)
    dueAt = local.toISOString()
    value = value.replace(timeMatch[0], ' ')
  }

  return {
    title: value.replace(/\s+/g, ' ').trim(),
    tags: [...new Set(tags)],
    priority,
    scheduledDate,
    dueAt,
  }
}
