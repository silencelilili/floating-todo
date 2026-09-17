<script setup lang="ts">
import { ref } from 'vue'
import { Check, Database, Download, Keyboard, MonitorUp, Palette, Save, Upload } from 'lucide-vue-next'
import type { AppSettings } from '@/domain/task'
import { setFloatingAlwaysOnTop, setFloatingClickThrough } from '@/services/runtime'
import { useTodoStore } from '@/stores/todo'

const store = useTodoStore()
const notice = ref('')
type DataAction = 'backup' | 'export' | 'import'
const activeDataAction = ref<DataAction | null>(null)

function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  store.updateSettings({ [key]: value } as Pick<AppSettings, K>)
}

async function perform(key: DataAction, action: () => Promise<unknown>, message: string) {
  if (activeDataAction.value) return
  activeDataAction.value = key
  try {
    const result = await action()
    if (result === null || result === false) notice.value = '操作已取消'
    else notice.value = typeof result === 'string' ? `${message}：${result}` : message
  } catch (cause) {
    notice.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    activeDataAction.value = null
  }
  window.setTimeout(() => { notice.value = '' }, 5000)
}

async function toggleClickThrough(enabled: boolean) {
  update('floatingClickThrough', enabled)
  await setFloatingClickThrough(enabled)
}

async function toggleAlwaysOnTop(enabled: boolean) {
  update('floatingAlwaysOnTop', enabled)
  await setFloatingAlwaysOnTop(enabled)
}
</script>

<template>
  <div class="settings-panel">
    <section class="settings-card">
      <div class="settings-card__heading">
        <MonitorUp :size="19" />
        <div><h2>悬浮窗</h2><p>控制桌面任务窗口的显示方式。</p></div>
      </div>
      <label class="setting-row">
        <span><strong>始终置顶</strong><small>让悬浮窗保持在普通应用窗口上方</small></span>
        <input type="checkbox" :checked="store.settings.floatingAlwaysOnTop" @change="toggleAlwaysOnTop(($event.target as HTMLInputElement).checked)" />
      </label>
      <label class="setting-row setting-row--range">
        <span><strong>背景透明度</strong><small>当前 {{ Math.round(store.settings.floatingOpacity * 100) }}%</small></span>
        <input type="range" min="0.35" max="1" step="0.01" :value="store.settings.floatingOpacity" @input="update('floatingOpacity', Number(($event.target as HTMLInputElement).value))" />
      </label>
      <label class="setting-row">
        <span><strong>紧凑模式</strong><small>减少间距，适合小尺寸悬浮窗</small></span>
        <input type="checkbox" :checked="store.settings.floatingCompact" @change="update('floatingCompact', ($event.target as HTMLInputElement).checked)" />
      </label>
      <label class="setting-row">
        <span><strong>点击穿透</strong><small>开启后需用 ⌘⇧L 恢复交互</small></span>
        <input type="checkbox" :checked="store.settings.floatingClickThrough" @change="toggleClickThrough(($event.target as HTMLInputElement).checked)" />
      </label>
    </section>

    <section class="settings-card">
      <div class="settings-card__heading">
        <Keyboard :size="19" />
        <div><h2>快捷键</h2><p>从任何应用快速呼出浮光 Todo。</p></div>
      </div>
      <label class="setting-row setting-row--text"><span><strong>快速添加</strong></span><input :value="store.settings.quickCaptureShortcut" @change="update('quickCaptureShortcut', ($event.target as HTMLInputElement).value)" /></label>
      <label class="setting-row setting-row--text"><span><strong>显示悬浮窗</strong></span><input :value="store.settings.floatingShortcut" @change="update('floatingShortcut', ($event.target as HTMLInputElement).value)" /></label>
      <label class="setting-row setting-row--text"><span><strong>打开主窗口</strong></span><input :value="store.settings.mainWindowShortcut" @change="update('mainWindowShortcut', ($event.target as HTMLInputElement).value)" /></label>
    </section>

    <section class="settings-card">
      <div class="settings-card__heading">
        <Palette :size="19" />
        <div><h2>外观与任务</h2><p>设置主题和完成后的归档方式。</p></div>
      </div>
      <label class="setting-row setting-row--select"><span><strong>主题</strong></span><select :value="store.settings.theme" @change="update('theme', ($event.target as HTMLSelectElement).value as AppSettings['theme'])"><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label>
      <label class="setting-row setting-row--select"><span><strong>自动归档</strong></span><select :value="store.settings.autoArchive" @change="update('autoArchive', ($event.target as HTMLSelectElement).value as AppSettings['autoArchive'])"><option value="immediately">立即</option><option value="next-day">第二天</option><option value="7-days">7 天后</option><option value="never">永不</option></select></label>
    </section>

    <section class="settings-card">
      <div class="settings-card__heading">
        <Database :size="19" />
        <div><h2>本地数据</h2><p>数据仅保存在本机应用数据目录。</p></div>
      </div>
      <div class="data-actions">
        <button type="button" :disabled="activeDataAction !== null" @click="perform('backup', store.backupData, '备份已创建')">
          <Save :size="16" />{{ activeDataAction === 'backup' ? '备份中…' : '立即备份' }}
        </button>
        <button type="button" :disabled="activeDataAction !== null" @click="perform('export', store.exportData, '导出完成')">
          <Download :size="16" />{{ activeDataAction === 'export' ? '导出中…' : '导出 JSON' }}
        </button>
        <button type="button" :disabled="activeDataAction !== null" @click="perform('import', store.importData, '导入完成')">
          <Upload :size="16" />{{ activeDataAction === 'import' ? '导入中…' : '导入 JSON' }}
        </button>
      </div>
    </section>

    <Transition name="toast">
      <div v-if="notice" class="settings-notice"><Check :size="16" />{{ notice }}</div>
    </Transition>
  </div>
</template>
