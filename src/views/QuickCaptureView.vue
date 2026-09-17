<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { CalendarDays, CornerDownLeft, Hash, Sparkles, X } from 'lucide-vue-next'
import { parseTaskInput } from '@/domain/parser'
import { hideCurrentWindow, listenCurrentWindowFocus, listenTaskChanged } from '@/services/runtime'
import { useTodoStore } from '@/stores/todo'

const store = useTodoStore()
const value = ref('')
const input = ref<HTMLInputElement | null>(null)
const parsed = computed(() => parseTaskInput(value.value))
let unlistenFocus: (() => void) | null = null
let unlistenTaskChanged: (() => void) | null = null

function focusInput() {
  void nextTick(() => input.value?.focus({ preventScroll: true }))
}

function cancel() {
  if (!store.settings.draftRecovery) value.value = ''
  void hideCurrentWindow()
}

async function submit(keepOpen = false) {
  const task = store.addTask(value.value, 'quick-capture')
  if (!task) return
  value.value = ''
  await store.persistNow()
  if (!keepOpen) await hideCurrentWindow()
  else await nextTick(() => input.value?.focus())
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') cancel()
  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault()
    void submit(event.shiftKey)
  }
}

onMounted(async () => {
  focusInput()
  unlistenFocus = await listenCurrentWindowFocus((focused) => {
    if (focused) focusInput()
  })
  unlistenTaskChanged = await listenTaskChanged(focusInput)
})

onUnmounted(() => {
  unlistenFocus?.()
  unlistenTaskChanged?.()
})
</script>

<template>
  <div class="capture-stage">
    <div class="capture-card">
      <div class="capture-card__top" data-tauri-drag-region>
        <span><Sparkles :size="15" />快速添加</span>
        <button type="button" aria-label="关闭" @click="cancel"><X :size="16" /></button>
      </div>
      <div class="capture-input">
        <span class="capture-check"></span>
        <input
          ref="input"
          v-model="value"
          type="text"
          autocomplete="off"
          spellcheck="false"
          placeholder="现在要做什么？"
          aria-label="现在要做什么"
          @keydown="onKeydown"
        />
        <button type="button" :disabled="!parsed.title" @click="submit(false)"><CornerDownLeft :size="17" />添加</button>
      </div>
      <div class="capture-meta">
        <span v-if="parsed.scheduledDate"><CalendarDays :size="13" />{{ parsed.scheduledDate }}</span>
        <span v-for="tag in parsed.tags" :key="tag"><Hash :size="13" />{{ tag }}</span>
        <span v-if="parsed.priority" class="priority">{{ '!'.repeat(parsed.priority) }} 优先</span>
        <span v-if="!parsed.scheduledDate && !parsed.tags.length && !parsed.priority">输入“明天”、时间、#标签 或 !优先级</span>
        <kbd>Enter 添加 · Shift+Enter 连续添加 · Esc 关闭</kbd>
      </div>
    </div>
  </div>
</template>
