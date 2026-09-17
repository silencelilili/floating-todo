<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  Archive,
  CalendarCheck2,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleEllipsis,
  Inbox,
  LayoutList,
  MoreHorizontal,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
} from 'lucide-vue-next'
import type { Task } from '@/domain/task'
import { useTodoStore } from '@/stores/todo'
import { showWindow } from '@/services/runtime'
import QuickAdd from '@/components/QuickAdd.vue'
import TaskRow from '@/components/TaskRow.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'

const store = useTodoStore()
type ViewKey = 'today' | 'inbox' | 'all' | 'completed' | 'archived' | 'deleted' | 'settings'
const activeView = ref<ViewKey>('today')
const search = ref('')
const showCompleted = ref(true)
type StatusFilter = 'all' | 'open' | 'completed'
type PriorityFilter = 'all' | 0 | 1 | 2 | 3
type SortMode = 'smart' | 'newest' | 'due' | 'title'
const statusFilter = ref<StatusFilter>('all')
const priorityFilter = ref<PriorityFilter>('all')
const pinnedOnly = ref(false)
const sortMode = ref<SortMode>('smart')
const filterOpen = ref(false)
const moreOpen = ref(false)
const clearDeletedDialogOpen = ref(false)
const clearingDeleted = ref(false)
const actionsElement = ref<HTMLElement | null>(null)

const nav = [
  { key: 'today' as const, label: '今天', icon: Sun },
  { key: 'inbox' as const, label: '收集箱', icon: Inbox },
  { key: 'all' as const, label: '全部任务', icon: LayoutList },
]
const historyNav = [
  { key: 'completed' as const, label: '已完成', icon: CheckCircle2 },
  { key: 'archived' as const, label: '归档', icon: Archive },
  { key: 'deleted' as const, label: '回收站', icon: Trash2 },
]

const titles: Record<ViewKey, { title: string; subtitle: string }> = {
  today: { title: '今天', subtitle: '专注当下，一件一件完成' },
  inbox: { title: '收集箱', subtitle: '暂时放下，稍后再安排' },
  all: { title: '全部任务', subtitle: '查看所有正在进行的事项' },
  completed: { title: '已完成', subtitle: '每一步都值得被记录' },
  archived: { title: '归档', subtitle: '安静保存你的完成历史' },
  deleted: { title: '回收站', subtitle: '删除的任务会暂存在这里' },
  settings: { title: '偏好设置', subtitle: '让浮光 Todo 更适合你的工作方式' },
}

const sourceTasks = computed<Task[]>(() => {
  switch (activeView.value) {
    case 'today':
      return store.todayTasks
    case 'inbox':
      return store.activeTasks.filter((task) => task.status === 'inbox')
    case 'all':
      return store.activeTasks
    case 'completed':
      return store.completedTasks
    case 'archived':
      return store.archivedTasks
    case 'deleted':
      return store.deletedTasks
    default:
      return []
  }
})

const currentTasks = computed<Task[]>(() => {
  let result = [...sourceTasks.value]
  if (statusFilter.value === 'open') {
    result = result.filter((task) => task.status === 'active' || task.status === 'inbox')
  } else if (statusFilter.value === 'completed') {
    result = result.filter((task) => task.status === 'completed')
  }
  if (priorityFilter.value !== 'all') result = result.filter((task) => task.priority === priorityFilter.value)
  if (pinnedOnly.value) result = result.filter((task) => task.pinned)

  const needle = search.value.trim().toLocaleLowerCase()
  if (needle) {
    result = result.filter((task) => `${task.title} ${task.notes} ${task.tags.join(' ')}`.toLocaleLowerCase().includes(needle))
  }

  if (sortMode.value === 'newest') {
    result.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } else if (sortMode.value === 'due') {
    result.sort((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'))
  } else if (sortMode.value === 'title') {
    result.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
  }
  return result
})

const openTasks = computed(() => currentTasks.value.filter((task) => task.status === 'active' || task.status === 'inbox'))
const doneTasks = computed(() => currentTasks.value.filter((task) => task.status === 'completed'))
const activeFilterCount = computed(() => (
  Number(statusFilter.value !== 'all') + Number(priorityFilter.value !== 'all') + Number(pinnedOnly.value)
))

const sortLabels: Record<SortMode, string> = {
  smart: '智能排序',
  newest: '最近创建',
  due: '截止时间',
  title: '任务名称',
}

function switchView(key: ViewKey) {
  activeView.value = key
  search.value = ''
  resetFilters()
  filterOpen.value = false
  moreOpen.value = false
  clearDeletedDialogOpen.value = false
}

async function confirmClearDeleted() {
  clearingDeleted.value = true
  try {
    await store.clearDeletedTasks()
    clearDeletedDialogOpen.value = false
  } finally {
    clearingDeleted.value = false
  }
}

function toggleFilter() {
  filterOpen.value = !filterOpen.value
  moreOpen.value = false
}

function toggleMore() {
  moreOpen.value = !moreOpen.value
  filterOpen.value = false
}

function resetFilters() {
  statusFilter.value = 'all'
  priorityFilter.value = 'all'
  pinnedOnly.value = false
}

function setSort(mode: SortMode) {
  sortMode.value = mode
  moreOpen.value = false
}

function closeActionMenus(event: MouseEvent) {
  if (!actionsElement.value?.contains(event.target as Node)) {
    filterOpen.value = false
    moreOpen.value = false
  }
}

function closeActionMenusOnEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  filterOpen.value = false
  moreOpen.value = false
  if (!clearingDeleted.value) clearDeletedDialogOpen.value = false
}

onMounted(() => {
  document.addEventListener('mousedown', closeActionMenus)
  document.addEventListener('keydown', closeActionMenusOnEscape)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', closeActionMenus)
  document.removeEventListener('keydown', closeActionMenusOnEscape)
})
</script>

<template>
  <div class="main-shell">
    <aside class="sidebar">
      <div class="traffic-space" data-tauri-drag-region></div>
      <div class="brand">
        <span class="brand__mark"><Sparkles :size="17" /></span>
        <span>浮光</span>
      </div>

      <nav class="sidebar__nav" aria-label="任务导航">
        <button
          v-for="item in nav"
          :key="item.key"
          type="button"
          :class="{ active: activeView === item.key }"
          @click="switchView(item.key)"
        >
          <component :is="item.icon" :size="17" />
          <span>{{ item.label }}</span>
          <span v-if="item.key === 'today' && store.openTodayCount" class="nav-count">{{ store.openTodayCount }}</span>
        </button>

        <div class="nav-divider"></div>
        <button
          v-for="item in historyNav"
          :key="item.key"
          type="button"
          :class="{ active: activeView === item.key }"
          @click="switchView(item.key)"
        >
          <component :is="item.icon" :size="17" />
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <div class="sidebar__bottom">
        <button type="button" @click="showWindow('floating')">
          <CircleEllipsis :size="17" /><span>显示悬浮窗</span>
        </button>
        <button type="button" :class="{ active: activeView === 'settings' }" @click="switchView('settings')">
          <Settings :size="17" /><span>设置</span>
        </button>
      </div>
    </aside>

    <main class="main-content">
      <header class="topbar" data-tauri-drag-region>
        <div v-if="activeView !== 'settings'" class="search-box">
          <Search :size="16" />
          <input v-model="search" type="search" placeholder="搜索任务" />
          <kbd>⌘ K</kbd>
        </div>
      </header>

      <section class="content-panel">
        <div class="page-heading">
          <div>
            <p v-if="activeView === 'today'" class="eyebrow">{{ new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }) }}</p>
            <h1>{{ titles[activeView].title }}</h1>
            <p>{{ titles[activeView].subtitle }}</p>
          </div>
          <div v-if="activeView !== 'settings'" ref="actionsElement" class="page-heading__actions">
            <button
              v-if="activeView === 'deleted'"
              class="ghost-button danger-button clear-trash-button"
              type="button"
              :disabled="!store.deletedTasks.length"
              @click="clearDeletedDialogOpen = true"
            >
              <Trash2 :size="16" />清空
            </button>
            <div class="heading-action">
              <button
                class="ghost-button"
                :class="{ active: filterOpen || activeFilterCount > 0 }"
                type="button"
                :aria-expanded="filterOpen"
                aria-haspopup="menu"
                @click="toggleFilter"
              >
                <SlidersHorizontal :size="16" />筛选
                <span v-if="activeFilterCount" class="filter-count">{{ activeFilterCount }}</span>
              </button>
              <div v-if="filterOpen" class="heading-popover filter-popover" role="menu">
                <template v-if="activeView === 'today'">
                  <div class="popover-heading">状态</div>
                  <button
                    v-for="option in ([['all', '全部'], ['open', '仅待办'], ['completed', '仅已完成']] as const)"
                    :key="option[0]"
                    type="button"
                    :class="{ selected: statusFilter === option[0] }"
                    @click="statusFilter = option[0]"
                  >
                    <span>{{ option[1] }}</span><Check v-if="statusFilter === option[0]" :size="14" />
                  </button>
                  <div class="popover-divider"></div>
                </template>
                <div class="popover-heading">优先级</div>
                <button
                  v-for="option in ([['all', '全部优先级'], [3, 'P3 紧急'], [2, 'P2 高'], [1, 'P1 普通'], [0, '无优先级']] as const)"
                  :key="option[0]"
                  type="button"
                  :class="{ selected: priorityFilter === option[0] }"
                  @click="priorityFilter = option[0]"
                >
                  <span>{{ option[1] }}</span><Check v-if="priorityFilter === option[0]" :size="14" />
                </button>
                <div class="popover-divider"></div>
                <button type="button" :class="{ selected: pinnedOnly }" @click="pinnedOnly = !pinnedOnly">
                  <span>仅看置顶任务</span><Check v-if="pinnedOnly" :size="14" />
                </button>
                <button v-if="activeFilterCount" type="button" class="popover-reset" @click="resetFilters">清除筛选</button>
              </div>
            </div>
            <div class="heading-action">
              <button
                class="icon-ghost"
                :class="{ active: moreOpen || sortMode !== 'smart' }"
                type="button"
                aria-label="排序与更多"
                :aria-expanded="moreOpen"
                aria-haspopup="menu"
                @click="toggleMore"
              ><MoreHorizontal :size="18" /></button>
              <div v-if="moreOpen" class="heading-popover sort-popover" role="menu">
                <div class="popover-heading">任务排序</div>
                <button
                  v-for="(label, mode) in sortLabels"
                  :key="mode"
                  type="button"
                  :class="{ selected: sortMode === mode }"
                  @click="setSort(mode)"
                >
                  <span>{{ label }}</span><Check v-if="sortMode === mode" :size="14" />
                </button>
                <div class="popover-divider"></div>
                <button type="button" @click="showWindow('floating'); moreOpen = false">显示悬浮窗</button>
              </div>
            </div>
          </div>
        </div>

        <SettingsPanel v-if="activeView === 'settings'" />

        <template v-else>
          <QuickAdd v-if="['today', 'inbox', 'all'].includes(activeView)" class="main-quick-add" source="main" />

          <div v-if="currentTasks.length" class="task-sections">
            <section v-if="openTasks.length" class="task-section">
              <div class="section-label">
                <span>待办</span>
                <span>{{ openTasks.length }}</span>
              </div>
              <div class="task-card">
                <TaskRow v-for="task in openTasks" :key="task.id" :task="task" />
              </div>
            </section>

            <section v-if="doneTasks.length" class="task-section">
              <button type="button" class="section-label section-label--button" @click="showCompleted = !showCompleted">
                <span><ChevronDown :size="14" :class="{ collapsed: !showCompleted }" />已完成</span>
                <span>{{ doneTasks.length }}</span>
              </button>
              <div v-if="showCompleted" class="task-card task-card--completed">
                <TaskRow v-for="task in doneTasks" :key="task.id" :task="task" />
              </div>
            </section>

            <section v-if="activeView === 'archived' || activeView === 'deleted'" class="task-section">
              <div class="task-card">
                <TaskRow v-for="task in currentTasks" :key="task.id" :task="task" />
              </div>
            </section>
          </div>

          <div v-else class="empty-state">
            <div class="empty-state__icon">
              <CalendarCheck2 v-if="activeView === 'today'" :size="30" />
              <Archive v-else-if="activeView === 'archived'" :size="30" />
              <Inbox v-else :size="30" />
            </div>
            <h2>{{ search ? '没有找到匹配的任务' : '这里还没有任务' }}</h2>
            <p>{{ search ? '试试其他关键词。' : '从一个轻松的小目标开始吧。' }}</p>
          </div>
        </template>
      </section>
    </main>

    <div
      v-if="clearDeletedDialogOpen"
      class="confirm-overlay"
      role="presentation"
      @mousedown.self="clearDeletedDialogOpen = false"
    >
      <section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="clear-trash-title">
        <div class="confirm-dialog__icon"><Trash2 :size="22" /></div>
        <h2 id="clear-trash-title">确认清空回收站？</h2>
        <p>回收站中的 {{ store.deletedTasks.length }} 条任务将被永久删除，清空后数据无法找回。</p>
        <div class="confirm-dialog__actions">
          <button type="button" :disabled="clearingDeleted" @click="clearDeletedDialogOpen = false">取消</button>
          <button
            type="button"
            class="confirm-dialog__danger"
            :disabled="clearingDeleted"
            @click="confirmClearDeleted"
          >
            {{ clearingDeleted ? '正在清空…' : '确认清空' }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
