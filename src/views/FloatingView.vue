<script setup lang="ts">
import { computed, ref } from 'vue'
import { AppWindow, ChevronDown, GripHorizontal, Lock, Maximize2, Minimize2, MoreHorizontal, Plus, Unlock, X } from 'lucide-vue-next'
import QuickAdd from '@/components/QuickAdd.vue'
import TaskRow from '@/components/TaskRow.vue'
import { hideCurrentWindow, setFloatingClickThrough, showWindow, startCurrentWindowDragging } from '@/services/runtime'
import { useTodoStore } from '@/stores/todo'

const store = useTodoStore()
const collapsed = ref(false)
const adding = ref(false)
const menuOpen = ref(false)
const active = computed(() => store.todayTasks.filter((task) => task.status === 'active'))
const completed = computed(() => store.todayTasks.filter((task) => task.status === 'completed'))

async function toggleLock() {
  const locked = !store.settings.floatingLocked
  store.updateSettings({ floatingLocked: locked })
  if (locked && store.settings.floatingClickThrough) await setFloatingClickThrough(true)
}

async function disableClickThrough() {
  store.updateSettings({ floatingClickThrough: false })
  await setFloatingClickThrough(false)
}

function beginWindowDrag(event: MouseEvent) {
  if (store.settings.floatingLocked || event.button !== 0) return
  event.preventDefault()
  void startCurrentWindowDragging()
}
</script>

<template>
  <div
    class="floating-shell"
    :class="{ 'is-collapsed': collapsed, 'is-compact': store.settings.floatingCompact }"
    :style="{ '--floating-opacity': store.settings.floatingOpacity }"
  >
    <header class="floating-header">
      <div
        class="floating-header__drag"
        :class="{ 'is-locked': store.settings.floatingLocked }"
        role="button"
        :aria-label="store.settings.floatingLocked ? '悬浮窗位置已锁定' : '拖动悬浮窗'"
        :aria-disabled="store.settings.floatingLocked"
        :title="store.settings.floatingLocked ? '请先解锁位置' : '按住拖动悬浮窗'"
        @mousedown.left="beginWindowDrag"
      >
        <GripHorizontal :size="18" />
      </div>
      <div class="floating-header__title">
        <span class="floating-logo">✦</span>
        <div><strong>今天</strong><small>{{ store.openTodayCount }} 项待办</small></div>
      </div>
      <div class="floating-header__actions">
        <button type="button" title="打开主窗口" aria-label="打开主窗口" @click="showWindow('main')">
          <AppWindow :size="15" />
        </button>
        <button type="button" :title="store.settings.floatingLocked ? '解锁位置' : '锁定位置'" @click="toggleLock">
          <Lock v-if="store.settings.floatingLocked" :size="15" /><Unlock v-else :size="15" />
        </button>
        <button type="button" :title="collapsed ? '展开' : '收起'" @click="collapsed = !collapsed">
          <Maximize2 v-if="collapsed" :size="15" /><Minimize2 v-else :size="15" />
        </button>
        <button type="button" title="隐藏" @click="hideCurrentWindow"><X :size="16" /></button>
      </div>
    </header>

    <template v-if="!collapsed">
      <div class="floating-progress">
        <span :style="{ width: `${store.todayTasks.length ? (completed.length / store.todayTasks.length) * 100 : 0}%` }"></span>
      </div>

      <div class="floating-list">
        <TaskRow v-for="task in active" :key="task.id" :task="task" compact />
        <div v-if="!active.length" class="floating-empty">
          <span>✓</span>
          <strong>今天的任务已完成</strong>
          <small>享受片刻轻松吧</small>
        </div>
      </div>

      <div v-if="completed.length && store.settings.showCompletedInFloating" class="floating-completed">
        <details>
          <summary><ChevronDown :size="13" />已完成 {{ completed.length }}</summary>
          <TaskRow v-for="task in completed" :key="task.id" :task="task" compact :show-actions="false" />
        </details>
      </div>

      <div class="floating-footer">
        <QuickAdd v-if="adding" autofocus compact source="floating" @added="adding = false" @cancel="adding = false" />
        <button v-else class="floating-add" type="button" @click="adding = true"><Plus :size="17" />添加任务</button>
        <div v-if="store.settings.floatingClickThrough" class="floating-more">
          <button type="button" aria-label="更多" @click="menuOpen = !menuOpen"><MoreHorizontal :size="17" /></button>
          <div v-if="menuOpen" class="floating-menu" @mouseleave="menuOpen = false">
            <button type="button" @click="disableClickThrough">关闭点击穿透</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
