import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { parseTaskInput } from '@/domain/parser'
import {
  createTask,
  DEFAULT_LISTS,
  DEFAULT_SETTINGS,
  localDateKey,
  shouldAutoArchive,
  sortTasks,
  type AppData,
  type AppSettings,
  type Task,
  type TaskSource,
  type TaskStatus,
} from '@/domain/task'
import {
  configureDesktop,
  createBackup,
  emitTaskChanged,
  exportAppData,
  importAppData,
  isTauri,
  loadAppData,
  saveAppData,
} from '@/services/runtime'

const STORAGE_KEY = 'floating-todo:data:v1'

function emptyData(): AppData {
  return {
    version: 1,
    tasks: [],
    lists: DEFAULT_LISTS,
    settings: { ...DEFAULT_SETTINGS },
    updatedAt: new Date().toISOString(),
  }
}

function normalizeData(value: Partial<AppData> | null | undefined): AppData {
  const defaults = emptyData()
  return {
    version: 1,
    tasks: Array.isArray(value?.tasks) ? value.tasks : defaults.tasks,
    lists: Array.isArray(value?.lists) && value.lists.length ? value.lists : defaults.lists,
    settings: { ...defaults.settings, ...(value?.settings ?? {}) },
    updatedAt: value?.updatedAt ?? defaults.updatedAt,
  }
}

export const useTodoStore = defineStore('todo', () => {
  const data = ref<AppData>(emptyData())
  const ready = ref(false)
  const error = ref<string | null>(null)
  const lastCompletedId = ref<string | null>(null)
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  const tasks = computed(() => data.value.tasks)
  const settings = computed(() => data.value.settings)
  const todayKey = computed(() => localDateKey())
  const activeTasks = computed(() => sortTasks(tasks.value.filter((task) => task.status === 'active' || task.status === 'inbox')))
  const todayTasks = computed(() => sortTasks(tasks.value.filter((task) => {
    if (task.status !== 'active' && task.status !== 'completed') return false
    return task.scheduledDate === todayKey.value || (task.listId === 'today' && !task.scheduledDate)
  })))
  const completedTasks = computed(() => sortTasks(tasks.value.filter((task) => task.status === 'completed')))
  const archivedTasks = computed(() => [...tasks.value]
    .filter((task) => task.status === 'archived')
    .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? '')))
  const deletedTasks = computed(() => tasks.value.filter((task) => task.status === 'deleted'))
  const openTodayCount = computed(() => todayTasks.value.filter((task) => task.status === 'active').length)

  function persistLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data.value))
  }

  async function persistNow(notify = true) {
    data.value.updatedAt = new Date().toISOString()
    persistLocal()
    if (isTauri()) await saveAppData(data.value)
    if (notify) await emitTaskChanged(data.value.tasks)
  }

  function schedulePersist() {
    persistLocal()
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      void persistNow()
      saveTimer = null
    }, 120)
  }

  async function initialize(force = false) {
    if (ready.value && !force) return
    error.value = null
    try {
      let loaded: AppData | null = null
      if (isTauri()) loaded = await loadAppData()
      if (!loaded) {
        const cached = localStorage.getItem(STORAGE_KEY)
        loaded = cached ? JSON.parse(cached) as AppData : null
      }
      data.value = normalizeData(loaded)
      autoArchiveDueTasks(false)
      ready.value = true
      persistLocal()
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      data.value = emptyData()
      ready.value = true
    }
  }

  function addTask(raw: string, source: TaskSource = 'main'): Task | null {
    const parsed = parseTaskInput(raw)
    if (!parsed.title) return null
    const task = createTask(parsed, source)
    data.value.tasks.push(task)
    schedulePersist()
    return task
  }

  function patchTask(id: string, patch: Partial<Omit<Task, 'id' | 'createdAt'>>) {
    const task = data.value.tasks.find((item) => item.id === id)
    if (!task) return
    Object.assign(task, patch, {
      updatedAt: new Date().toISOString(),
      revision: task.revision + 1,
    })
    schedulePersist()
  }

  function completeTask(id: string) {
    const task = data.value.tasks.find((item) => item.id === id)
    if (!task) return
    const now = new Date().toISOString()
    lastCompletedId.value = id
    patchTask(id, { status: 'completed', completedAt: now, archivedAt: null })
    if (settings.value.autoArchive === 'immediately') archiveTask(id)
  }

  function restoreTask(id: string) {
    const task = data.value.tasks.find((item) => item.id === id)
    if (!task) return
    patchTask(id, {
      status: task.listId === 'inbox' && !task.scheduledDate ? 'inbox' : 'active',
      completedAt: null,
      archivedAt: null,
      deletedAt: null,
    })
  }

  function moveTaskToInbox(id: string) {
    const task = data.value.tasks.find((item) => item.id === id)
    if (!task) return
    patchTask(id, {
      status: 'inbox',
      listId: 'inbox',
      scheduledDate: null,
      dueAt: null,
      reminderAt: null,
      completedAt: null,
      archivedAt: null,
      deletedAt: null,
    })
  }

  function moveTaskToToday(id: string) {
    const task = data.value.tasks.find((item) => item.id === id)
    if (!task) return
    patchTask(id, {
      status: 'active',
      listId: 'today',
      scheduledDate: localDateKey(),
      completedAt: null,
      archivedAt: null,
      deletedAt: null,
    })
  }

  function archiveTask(id: string) {
    patchTask(id, { status: 'archived', archivedAt: new Date().toISOString() })
  }

  function deleteTask(id: string) {
    patchTask(id, { status: 'deleted', deletedAt: new Date().toISOString() })
  }

  function permanentlyDeleteTask(id: string) {
    data.value.tasks = data.value.tasks.filter((task) => task.id !== id)
    schedulePersist()
  }

  async function clearDeletedTasks() {
    if (!data.value.tasks.some((task) => task.status === 'deleted')) return
    data.value.tasks = data.value.tasks.filter((task) => task.status !== 'deleted')
    await persistNow()
  }

  function toggleTask(id: string) {
    const task = data.value.tasks.find((item) => item.id === id)
    if (!task) return
    if (task.status === 'completed') restoreTask(id)
    else completeTask(id)
  }

  function togglePinned(id: string) {
    const task = data.value.tasks.find((item) => item.id === id)
    if (task) patchTask(id, { pinned: !task.pinned })
  }

  function updateStatus(id: string, status: TaskStatus) {
    if (status === 'completed') completeTask(id)
    else if (status === 'archived') archiveTask(id)
    else if (status === 'deleted') deleteTask(id)
    else restoreTask(id)
  }

  function reorderTask(id: string, beforeId: string | null) {
    const list = activeTasks.value
    const task = data.value.tasks.find((item) => item.id === id)
    if (!task) return
    const without = list.filter((item) => item.id !== id)
    const index = beforeId ? without.findIndex((item) => item.id === beforeId) : without.length
    const previous = without[index - 1]?.sortOrder ?? 0
    const next = without[index]?.sortOrder ?? previous + 2000
    patchTask(id, { sortOrder: previous + (next - previous) / 2 })
  }

  function autoArchiveDueTasks(persist = true) {
    let changed = false
    for (const task of data.value.tasks) {
      if (shouldAutoArchive(task, settings.value.autoArchive)) {
        task.status = 'archived'
        task.archivedAt = new Date().toISOString()
        task.updatedAt = task.archivedAt
        task.revision += 1
        changed = true
      }
    }
    if (changed && persist) schedulePersist()
  }

  function updateSettings(patch: Partial<AppSettings>) {
    data.value.settings = { ...data.value.settings, ...patch }
    schedulePersist()
    void configureDesktop(data.value.settings).catch((cause) => {
      error.value = cause instanceof Error ? cause.message : String(cause)
    })
  }

  async function exportData() {
    return exportAppData(data.value)
  }

  async function importData() {
    const imported = await importAppData()
    if (!imported) return false
    data.value = normalizeData(imported)
    await persistNow()
    return true
  }

  async function backupData() {
    return createBackup(data.value)
  }

  async function reloadFromDisk() {
    if (!isTauri()) return
    const loaded = await loadAppData()
    if (loaded && loaded.updatedAt !== data.value.updatedAt) data.value = normalizeData(loaded)
  }

  return {
    data,
    tasks,
    settings,
    ready,
    error,
    lastCompletedId,
    activeTasks,
    todayTasks,
    completedTasks,
    archivedTasks,
    deletedTasks,
    openTodayCount,
    initialize,
    reloadFromDisk,
    addTask,
    patchTask,
    completeTask,
    restoreTask,
    moveTaskToInbox,
    moveTaskToToday,
    archiveTask,
    deleteTask,
    permanentlyDeleteTask,
    clearDeletedTasks,
    toggleTask,
    togglePinned,
    updateStatus,
    reorderTask,
    updateSettings,
    autoArchiveDueTasks,
    exportData,
    importData,
    backupData,
    persistNow,
  }
})
