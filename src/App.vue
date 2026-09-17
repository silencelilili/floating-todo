<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import MainView from '@/views/MainView.vue'
import FloatingView from '@/views/FloatingView.vue'
import QuickCaptureView from '@/views/QuickCaptureView.vue'
import { currentWindowLabel, listenTaskChanged } from '@/services/runtime'
import { useTodoStore } from '@/stores/todo'

const store = useTodoStore()
const label = ref(new URLSearchParams(location.search).get('window') ?? 'main')
let unlisten: (() => void) | null = null

function applyTheme() {
  const theme = store.settings.theme
  document.documentElement.dataset.theme = theme
  document.documentElement.style.setProperty('--accent', store.settings.accentColor)
}

onMounted(async () => {
  label.value = await currentWindowLabel()
  document.documentElement.dataset.window = label.value
  await store.initialize()
  applyTheme()
  unlisten = await listenTaskChanged(() => store.reloadFromDisk())
})

watch(() => [store.settings.theme, store.settings.accentColor], applyTheme)
onUnmounted(() => unlisten?.())
</script>

<template>
  <div v-if="!store.ready" class="app-loading"><span>✦</span><p>正在点亮浮光…</p></div>
  <QuickCaptureView v-else-if="label === 'quick-capture'" />
  <FloatingView v-else-if="label === 'floating'" />
  <MainView v-else />
</template>
