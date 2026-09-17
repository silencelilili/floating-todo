<script setup lang="ts">
import { computed, ref } from 'vue'
import { Archive, CalendarDays, Clock3, Inbox, MoreHorizontal, Pin, RotateCcw, Sun, Trash2 } from 'lucide-vue-next'
import type { Task } from '@/domain/task'
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
const menuOpen = ref(false)
const dragging = ref(false)

const completed = computed(() => props.task.status === 'completed' || props.task.status === 'archived')
const meta = computed(() => {
  const result: string[] = []
  if (props.task.dueAt) {
    result.push(new Date(props.task.dueAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
  } else if (props.task.scheduledDate) {
    result.push(props.task.scheduledDate)
  }
  result.push(...props.task.tags.map((tag) => `#${tag}`))
  return result
})

function beginEdit() {
  editTitle.value = props.task.title
  editing.value = true
  menuOpen.value = false
}

function saveEdit() {
  const title = editTitle.value.trim()
  if (title && title !== props.task.title) store.patchTask(props.task.id, { title })
  editing.value = false
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
    :class="{ 'is-completed': completed, 'is-compact': compact, 'is-dragging': dragging }"
    :draggable="task.status === 'active' || task.status === 'inbox'"
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
      @click="store.toggleTask(task.id)"
    >
      <span v-if="completed">✓</span>
    </button>

    <div class="task-row__body">
      <input
        v-if="editing"
        v-model="editTitle"
        class="task-row__edit"
        autofocus
        @keydown.enter.prevent="saveEdit"
        @keydown.esc="editing = false"
        @blur="saveEdit"
      />
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

    <div v-if="showActions" class="task-row__actions">
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
