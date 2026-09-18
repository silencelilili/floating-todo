<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Archive, CalendarDays, Clock3, Inbox, MoreHorizontal, Pin, RotateCcw, Sun, Trash2 } from 'lucide-vue-next'
import { localDateKey, type Task, type TaskPriority } from '@/domain/task'
import { useTodoStore } from '@/stores/todo'
import IconButton from './IconButton.vue'

const props = withDefaults(defineProps<{
  task: Task
  compact?: boolean
  showActions?: boolean
}>(), {
  compact: false,
  showActions: true,
})

const store = useTodoStore()
const editing = ref(false)
const editTitle = ref('')
const editPriority = ref<TaskPriority>(0)
const editDate = ref('')
const editTime = ref('')
const editInput = ref<HTMLInputElement | null>(null)
let originalDate = ''
let originalTime = ''
const menuOpen = ref(false)
const dragging = ref(false)

const completed = computed(() => props.task.status === 'completed' || props.task.status === 'archived')
const meta = computed(() => {
  const result: string[] = []
  if (props.task.dueAt) {
    const due = new Date(props.task.dueAt)
    result.push(`${localDateKey(due)} ${due.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`)
  } else if (props.task.scheduledDate) {
    result.push(props.task.scheduledDate)
  }
  result.push(...props.task.tags.map((tag) => `#${tag}`))
  return result
})

function beginEdit() {
  if (editing.value) return
  editTitle.value = props.task.title
  editPriority.value = props.task.priority
  const due = props.task.dueAt ? new Date(props.task.dueAt) : null
  editDate.value = props.task.scheduledDate ?? (due ? localDateKey(due) : '')
  editTime.value = due ? `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}` : ''
  originalDate = editDate.value
  originalTime = editTime.value
  editing.value = true
  menuOpen.value = false
  void nextTick(() => editInput.value?.focus())
}

function saveEdit() {
  const title = editTitle.value.trim()
  if (!title) {
    editInput.value?.focus()
    return
  }
  const patch: Partial<Task> = {}
  if (title !== props.task.title) patch.title = title
  if (editPriority.value !== props.task.priority) patch.priority = editPriority.value
  if (editDate.value !== originalDate || editTime.value !== originalTime) {
    patch.scheduledDate = editDate.value || null
    patch.dueAt = editDate.value && editTime.value
      ? new Date(`${editDate.value}T${editTime.value}`).toISOString()
      : null
    // Keep scheduling consistent with task creation without reopening completed tasks.
    if (props.task.listId === 'inbox' || props.task.listId === 'today') {
      patch.listId = editDate.value ? 'today' : 'inbox'
    }
    if (props.task.status === 'active' || props.task.status === 'inbox') {
      patch.status = editDate.value ? 'active' : 'inbox'
    }
  }
  if (Object.keys(patch).length) store.patchTask(props.task.id, patch)
  editing.value = false
}

function onEditKeydown(event: KeyboardEvent) {
  if (event.isComposing) {
    if (event.key === 'Enter') event.preventDefault()
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    editing.value = false
  }
}

function onDragStart(event: DragEvent) {
  dragging.value = true
  event.dataTransfer?.setData('text/task-id', props.task.id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDrop(event: DragEvent) {
  const id = event.dataTransfer?.getData('text/task-id')
  if (id && id !== props.task.id) store.reorderTask(id, props.task.id)
}
</script>

<template>
  <article
    class="task-row"
    :class="{ 'is-completed': completed, 'is-compact': compact, 'is-dragging': dragging, 'is-editing': editing }"
    :draggable="!editing && (task.status === 'active' || task.status === 'inbox')"
    @dragstart="onDragStart"
    @dragend="dragging = false"
    @dragover.prevent
    @drop.prevent="onDrop"
    @dblclick="beginEdit"
  >
    <button
      type="button"
      class="task-check"
      :class="{ 'is-checked': completed }"
      :aria-label="completed ? '恢复任务' : '完成任务'"
      :disabled="editing"
      @click="store.toggleTask(task.id)"
    >
      <span v-if="completed">✓</span>
    </button>

    <div class="task-row__body">
      <form
        v-if="editing"
        class="task-row__editor"
        aria-label="编辑任务"
        @submit.prevent="saveEdit"
        @keydown="onEditKeydown"
        @dblclick.stop
      >
        <input ref="editInput" v-model="editTitle" class="task-row__edit" aria-label="任务名称" required />
        <div class="task-row__edit-fields">
          <label>
            <span>优先级</span>
            <select v-model="editPriority" aria-label="优先级">
              <option :value="0">无优先级</option>
              <option :value="1">P1 普通</option>
              <option :value="2">P2 高</option>
              <option :value="3">P3 紧急</option>
            </select>
          </label>
          <label>
            <span>日期</span>
            <input v-model="editDate" type="date" aria-label="日期" @input="editTime = editDate ? editTime : ''" />
          </label>
          <label>
            <span>时间（可选）</span>
            <input v-model="editTime" type="time" aria-label="时间" :disabled="!editDate" />
          </label>
        </div>
        <div class="task-row__edit-actions">
          <button v-if="editDate || editTime" type="button" class="task-row__clear-date" @click="editDate = ''; editTime = ''">清除日期和时间</button>
          <button type="button" @click="editing = false">取消</button>
          <button type="submit" class="task-row__save" :disabled="!editTitle.trim()">保存</button>
        </div>
      </form>
      <template v-else>
        <div class="task-row__title-line">
          <Pin v-if="task.pinned" :size="13" class="task-row__pin" fill="currentColor" />
          <span class="task-row__title">{{ task.title }}</span>
          <span v-if="task.priority" class="task-row__priority" :data-level="task.priority">{{ '!'.repeat(task.priority) }}</span>
        </div>
        <div v-if="meta.length && !compact" class="task-row__meta">
          <span v-for="(item, index) in meta" :key="item">
            <Clock3 v-if="index === 0 && task.dueAt" :size="12" />
            <CalendarDays v-else-if="index === 0 && task.scheduledDate" :size="12" />
            {{ item }}
          </span>
        </div>
      </template>
    </div>

    <div v-if="showActions && !editing" class="task-row__actions">
      <IconButton
        v-if="task.status === 'archived' || task.status === 'deleted'"
        label="恢复"
        size="small"
        @click="store.restoreTask(task.id)"
      >
        <RotateCcw :size="15" />
      </IconButton>
      <div v-else class="task-menu">
        <IconButton label="更多操作" size="small" @click="menuOpen = !menuOpen">
          <MoreHorizontal :size="17" />
        </IconButton>
        <div v-if="menuOpen" class="task-menu__popover" @mouseleave="menuOpen = false">
          <button type="button" @click="beginEdit">编辑</button>
          <button type="button" @click="store.togglePinned(task.id); menuOpen = false">
            {{ task.pinned ? '取消置顶' : '置顶' }}
          </button>
          <button v-if="task.status === 'active'" type="button" @click="store.moveTaskToInbox(task.id); menuOpen = false">
            <Inbox :size="14" />移到收集箱
          </button>
          <button v-else-if="task.status === 'inbox'" type="button" @click="store.moveTaskToToday(task.id); menuOpen = false">
            <Sun :size="14" />移到今天
          </button>
          <button type="button" @click="store.archiveTask(task.id); menuOpen = false">
            <Archive :size="14" />归档
          </button>
          <button type="button" class="danger" @click="store.deleteTask(task.id); menuOpen = false">
            <Trash2 :size="14" />删除
          </button>
        </div>
      </div>
    </div>
  </article>
</template>
