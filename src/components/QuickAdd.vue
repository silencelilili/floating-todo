<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { CalendarDays, CornerDownLeft, Hash, Plus } from 'lucide-vue-next'
import { parseTaskInput } from '@/domain/parser'
import { useTodoStore } from '@/stores/todo'

const props = withDefaults(defineProps<{
  autofocus?: boolean
  source?: 'main' | 'floating' | 'quick-capture'
  compact?: boolean
}>(), {
  autofocus: false,
  source: 'main',
  compact: false,
})

const emit = defineEmits<{
  added: []
  cancel: []
}>()

const store = useTodoStore()
const input = ref('')
const inputElement = ref<HTMLInputElement | null>(null)
const parsed = computed(() => parseTaskInput(input.value))
const hasMeta = computed(() => parsed.value.tags.length > 0 || parsed.value.priority > 0 || !!parsed.value.scheduledDate || !!parsed.value.dueAt)

function submit(keepOpen = false) {
  const task = store.addTask(input.value, props.source)
  if (!task) return
  input.value = ''
  emit('added')
  if (keepOpen) void nextTick(() => inputElement.value?.focus())
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('cancel')
    return
  }
  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault()
    submit(event.shiftKey)
  }
}

onMounted(() => {
  if (props.autofocus) void nextTick(() => inputElement.value?.focus())
})

defineExpose({ focus: () => inputElement.value?.focus(), input })
</script>

<template>
  <div class="quick-add" :class="{ 'quick-add--compact': compact }">
    <div class="quick-add__field">
      <Plus :size="compact ? 18 : 20" aria-hidden="true" />
      <input
        ref="inputElement"
        v-model="input"
        type="text"
        autocomplete="off"
        spellcheck="false"
        aria-label="输入待办事项"
        placeholder="添加任务，试试“! 明天 10:00 提交设计稿 #工作”"
        @keydown="onKeydown"
      />
      <button v-if="input" type="button" class="quick-add__submit" @click="submit(false)">
        <CornerDownLeft :size="16" />
        <span>添加</span>
      </button>
    </div>
    <div v-if="input && hasMeta" class="quick-add__preview" aria-live="polite">
      <span v-if="parsed.scheduledDate"><CalendarDays :size="13" />{{ parsed.scheduledDate }}</span>
      <span v-for="tag in parsed.tags" :key="tag"><Hash :size="13" />{{ tag }}</span>
      <span v-if="parsed.priority" class="priority">{{ '!'.repeat(parsed.priority) }} 优先</span>
      <span v-if="parsed.dueAt">{{ new Date(parsed.dueAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}</span>
    </div>
  </div>
</template>
