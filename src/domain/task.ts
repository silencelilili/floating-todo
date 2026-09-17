export type TaskStatus = 'inbox' | 'active' | 'completed' | 'archived' | 'deleted'
export type TaskPriority = 0 | 1 | 2 | 3
export type TaskSource = 'quick-capture' | 'main' | 'floating' | 'import'

export interface Task {
  id: string
  title: string
  notes: string
  status: TaskStatus
  priority: TaskPriority
  listId: string
  tags: string[]
  scheduledDate: string | null
  dueAt: string | null
  reminderAt: string | null
  completedAt: string | null
  archivedAt: string | null
  deletedAt: string | null
  sortOrder: number
  pinned: boolean
  source: TaskSource
  createdAt: string
  updatedAt: string
  revision: number
}

export interface TodoList {
  id: string
  name: string
  color: string
  icon: string
  sortOrder: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface AppSettings {
  quickCaptureShortcut: string
  floatingShortcut: string
  mainWindowShortcut: string
  clickThroughShortcut: string
  autoArchive: 'immediately' | 'next-day' | '7-days' | 'never'
  launchAtLogin: boolean
  showFloatingOnLaunch: boolean
  minimizeToTray: boolean
  floatingAlwaysOnTop: boolean
  floatingOpacity: number
  floatingHoverOpacity: number
  floatingCompact: boolean
  floatingLocked: boolean
  floatingClickThrough: boolean
  showCompletedInFloating: boolean
  theme: 'system' | 'light' | 'dark'
  accentColor: string
  draftRecovery: boolean
}

export interface AppData {
  version: 1
  tasks: Task[]
  lists: TodoList[]
  settings: AppSettings
  updatedAt: string
}

export interface ParsedTaskInput {
  title: string
  tags: string[]
  priority: TaskPriority
  scheduledDate: string | null
  dueAt: string | null
}

export interface TaskQuery {
  status?: TaskStatus | TaskStatus[]
  listId?: string
  search?: string
  scheduledDate?: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  quickCaptureShortcut: 'CommandOrControl+Shift+Space',
  floatingShortcut: 'CommandOrControl+Shift+T',
  mainWindowShortcut: 'CommandOrControl+Shift+O',
  clickThroughShortcut: 'CommandOrControl+Shift+L',
  autoArchive: 'next-day',
  launchAtLogin: false,
  showFloatingOnLaunch: true,
  minimizeToTray: true,
  floatingAlwaysOnTop: true,
  floatingOpacity: 0.82,
  floatingHoverOpacity: 0.98,
  floatingCompact: false,
  floatingLocked: false,
  floatingClickThrough: false,
  showCompletedInFloating: true,
  theme: 'system',
  accentColor: '#6968e6',
  draftRecovery: true,
}

export const DEFAULT_LISTS: TodoList[] = [
  {
    id: 'inbox',
    name: '收集箱',
    color: '#8f91a1',
    icon: 'inbox',
    sortOrder: 0,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    deletedAt: null,
  },
  {
    id: 'today',
    name: '今日',
    color: '#6968e6',
    icon: 'sun',
    sortOrder: 1,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    deletedAt: null,
  },
]

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function nextLocalDateKey(days: number, from = new Date()): string {
  const next = new Date(from)
  next.setDate(next.getDate() + days)
  return localDateKey(next)
}

export function createTask(
  input: ParsedTaskInput,
  source: TaskSource,
  now = new Date(),
): Task {
  const timestamp = now.toISOString()
  const scheduled = input.scheduledDate !== null

  return {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    notes: '',
    status: scheduled ? 'active' : 'inbox',
    priority: input.priority,
    listId: scheduled ? 'today' : 'inbox',
    tags: input.tags,
    scheduledDate: input.scheduledDate,
    dueAt: input.dueAt,
    reminderAt: null,
    completedAt: null,
    archivedAt: null,
    deletedAt: null,
    sortOrder: now.getTime(),
    pinned: false,
    source,
    createdAt: timestamp,
    updatedAt: timestamp,
    revision: 1,
  }
}

export function shouldAutoArchive(task: Task, policy: AppSettings['autoArchive'], now = new Date()): boolean {
  if (task.status !== 'completed' || !task.completedAt || policy === 'never') return false

  const completedAt = new Date(task.completedAt)
  if (policy === 'immediately') return true
  if (policy === '7-days') return now.getTime() - completedAt.getTime() >= 7 * 24 * 60 * 60 * 1000
  return localDateKey(completedAt) < localDateKey(now)
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (a.priority !== b.priority) return b.priority - a.priority
    return a.sortOrder - b.sortOrder
  })
}
