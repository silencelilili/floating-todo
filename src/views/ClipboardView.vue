<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Check, Clipboard, ClipboardPaste, Copy, Image, Trash2 } from 'lucide-vue-next'
import type { ClipboardEntry } from '@/domain/clipboard'
import { contentFromPaste, copyClipboardContent, readClipboardContent } from '@/services/clipboard'
import { useClipboardStore } from '@/stores/clipboard'

const store = useClipboardStore()
const pasteArea = ref<HTMLTextAreaElement | null>(null)
const saving = ref(false)
const copyingId = ref('')
const deletingId = ref('')
const copiedId = ref('')
const notice = ref('')
const failed = ref(false)
const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘V' : 'Ctrl+V'
const busy = computed(() => !store.ready || saving.value)

function feedback(message: string, isError = false) {
  notice.value = message
  failed.value = isError
}

async function save(read: () => ReturnType<typeof readClipboardContent>) {
  if (busy.value) return
  saving.value = true
  feedback('')
  try {
    await store.add(await read())
    feedback('已存入剪贴板。')
  } catch (error) {
    feedback(error instanceof Error ? error.message : '保存失败，请重新粘贴。', true)
  } finally {
    saving.value = false
  }
}

function paste(event: ClipboardEvent) {
  event.preventDefault()
  if (event.clipboardData) void save(() => contentFromPaste(event.clipboardData!))
}

async function read() {
  await save(readClipboardContent)
  pasteArea.value?.focus()
}

async function copy(entry: ClipboardEntry) {
  if (copyingId.value) return
  copyingId.value = entry.id
  copiedId.value = ''
  try {
    await copyClipboardContent(entry)
    copiedId.value = entry.id
    feedback('已复制，可粘贴到其他应用。')
  } catch {
    feedback('复制失败，请重试，或选中内容后按 ⌘C / Ctrl+C。', true)
  } finally {
    copyingId.value = ''
  }
}

async function remove(entry: ClipboardEntry) {
  if (deletingId.value) return
  deletingId.value = entry.id
  try {
    await store.remove(entry.id)
    feedback('已删除这条内容。')
  } catch (error) {
    feedback(error instanceof Error ? error.message : '删除失败，请重试。', true)
  } finally {
    deletingId.value = ''
  }
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

onMounted(() => { void store.initialize() })
</script>

<template>
  <section class="clipboard-view" aria-label="剪贴板内容" @paste="paste">
    <div class="clipboard-capture">
      <div class="clipboard-capture__heading">
        <span class="clipboard-capture__icon"><ClipboardPaste :size="19" /></span>
        <div><strong>把刚复制的内容，暂存在这里</strong><p>文字、富文本或图片，随时取用。</p></div>
        <button type="button" class="clipboard-primary" :disabled="busy" @click="read">
          <ClipboardPaste :size="15" />{{ saving ? '正在保存…' : '粘贴内容' }}
        </button>
      </div>
      <label class="clipboard-paste-label" for="clipboard-paste">粘贴区域</label>
      <textarea
        id="clipboard-paste"
        ref="pasteArea"
        class="clipboard-paste-area"
        :disabled="busy"
        :placeholder="`点击这里，按 ${shortcut} 粘贴并保存`"
        rows="2"
        spellcheck="false"
        @beforeinput.prevent
      ></textarea>
      <p class="clipboard-capture__hint">仅保存你主动粘贴的内容 · 保存在本机，删除前一直保留</p>
    </div>

    <p v-if="notice" :role="failed ? 'alert' : 'status'" class="clipboard-notice" :class="{ 'clipboard-notice--error': failed }">{{ notice }}</p>

    <div v-if="store.loading || (!store.ready && !store.error)" class="clipboard-loading" role="status" aria-label="正在加载剪贴板" aria-busy="true">
      <div v-for="index in 3" :key="index" class="clipboard-skeleton" aria-hidden="true">
        <div class="clipboard-skeleton__header"><span></span><span></span></div>
        <div class="clipboard-skeleton__line"></div><div class="clipboard-skeleton__line"></div><div class="clipboard-skeleton__line clipboard-skeleton__line--short"></div>
      </div>
      <span class="clipboard-sr-only">正在加载剪贴板…</span>
    </div>

    <div v-else-if="store.error" class="empty-state clipboard-empty" role="alert">
      <div class="empty-state__icon"><Clipboard :size="30" /></div>
      <h2>剪贴板暂时无法打开</h2><p>{{ store.error }}</p>
      <button type="button" class="ghost-button" @click="store.initialize()">重新加载</button>
    </div>

    <template v-else-if="store.entries.length">
      <div class="section-label"><span>已暂存</span><span>{{ store.entries.length }} 条</span></div>
      <div class="clipboard-list">
        <article v-for="(entry, index) in store.entries" :key="entry.id" class="clipboard-card" :aria-label="`剪贴板第 ${index + 1} 项`">
          <header class="clipboard-card__header">
            <span class="clipboard-card__meta">
              <Image v-if="entry.images.length || entry.html.includes('<img')" :size="14" /><Clipboard v-else :size="14" />
              <span>{{ entry.html ? '富文本' : entry.images.length ? '图片' : '文本' }}</span>
              <time :datetime="entry.createdAt">{{ formatTime(entry.createdAt) }}</time>
            </span>
            <div class="clipboard-card__actions">
              <button type="button" :disabled="!!copyingId" :aria-label="`复制第 ${index + 1} 项`" @click="copy(entry)">
                <Check v-if="copiedId === entry.id" :size="14" /><Copy v-else :size="14" />
                {{ copyingId === entry.id ? '复制中…' : copiedId === entry.id ? '已复制' : '复制' }}
              </button>
              <button type="button" class="clipboard-delete" :disabled="!!deletingId" :aria-label="`删除第 ${index + 1} 项`" @click="remove(entry)">
                <Trash2 :size="14" />{{ deletingId === entry.id ? '删除中…' : '删除' }}
              </button>
            </div>
          </header>
          <div class="clipboard-card__content">
            <!-- HTML is rebuilt by normalizeClipboardContent on both save and load. -->
            <div v-if="entry.html" class="clipboard-rich" @click.prevent v-html="entry.html"></div>
            <pre v-else-if="entry.text" class="clipboard-text">{{ entry.text }}</pre>
            <img v-for="(source, imageIndex) in entry.images" :key="imageIndex" class="clipboard-image" :src="source" :alt="`第 ${index + 1} 项图片 ${imageIndex + 1}`" />
          </div>
        </article>
      </div>
    </template>

    <div v-else class="empty-state clipboard-empty">
      <div class="empty-state__icon"><Clipboard :size="30" /></div>
      <h2>剪贴板还是空的</h2>
      <p>在其他应用复制内容，回到这里粘贴，留给稍后使用。</p>
      <button type="button" class="ghost-button" @click="pasteArea?.focus()">开始粘贴 <kbd>{{ shortcut }}</kbd></button>
    </div>
  </section>
</template>

<style scoped>
.clipboard-view { min-width: 0; }
.clipboard-capture { padding: 18px; border: 1px solid var(--line); border-radius: 13px; background: color-mix(in srgb, var(--accent) 3%, var(--surface)); }
.clipboard-capture__heading { display: flex; align-items: center; gap: 11px; flex-wrap: wrap; }
.clipboard-capture__icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; color: var(--accent); background: var(--accent-soft); }
.clipboard-capture__heading > div { flex: 1; min-width: 170px; }
.clipboard-capture strong { color: var(--text); font-size: 13px; font-weight: 600; }
.clipboard-capture__heading p { margin: 5px 0 0; color: var(--muted); font-size: 11px; }
.clipboard-primary { display: inline-flex; align-items: center; gap: 7px; min-height: 34px; padding: 0 12px; border: 0; border-radius: 8px; background: var(--accent); color: white; font-size: 12px; cursor: pointer; }
.clipboard-primary:hover { filter: brightness(.95); }
.clipboard-paste-label { display: block; margin: 16px 0 7px; color: var(--muted); font-size: 11px; }
.clipboard-paste-area { display: block; width: 100%; min-height: 68px; padding: 14px; resize: vertical; border: 1px dashed color-mix(in srgb, var(--accent) 35%, var(--line)); border-radius: 8px; background: var(--surface); color: var(--text); font: inherit; font-size: 12px; line-height: 1.6; user-select: text; }
.clipboard-paste-area::placeholder { color: var(--muted); }
.clipboard-paste-area:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.clipboard-capture__hint { margin: 10px 0 0; color: var(--muted); font-size: 10px; line-height: 1.7; }
.clipboard-notice { margin: 14px 0 0; font-size: 12px; color: var(--accent); line-height: 1.6; }
.clipboard-notice--error { color: var(--danger); }
.section-label { margin-top: 25px; }
.clipboard-list, .clipboard-loading { display: grid; gap: 16px; }
.clipboard-loading { margin-top: 25px; }
.clipboard-card { min-width: 0; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
.clipboard-card__header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--line); }
.clipboard-card__meta { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; color: var(--muted); font-size: 11px; }
.clipboard-card__meta time { margin-left: 5px; font-size: 10px; }
.clipboard-card__actions { display: flex; gap: 4px; }
.clipboard-card__actions button { display: flex; align-items: center; gap: 5px; min-height: 30px; padding: 0 8px; border: 0; border-radius: 6px; background: transparent; color: var(--muted); font-size: 11px; cursor: pointer; }
.clipboard-card__actions button:hover { background: var(--accent-soft); color: var(--accent); }
.clipboard-card__actions .clipboard-delete:hover { color: var(--danger); background: color-mix(in srgb, var(--danger) 8%, var(--surface)); }
.clipboard-view button:disabled, .clipboard-paste-area:disabled { opacity: .5; cursor: wait; }
.clipboard-card__content { padding: 18px; user-select: text; overflow-x: auto; }
.clipboard-text { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; tab-size: 4; font: inherit; font-size: 13px; line-height: 1.8; color: var(--text); }
.clipboard-rich { display: flow-root; font-size: 13px; line-height: 1.7; color: var(--text); overflow-wrap: anywhere; }
.clipboard-rich :deep(pre) { white-space: pre-wrap; }
.clipboard-rich :deep(table) { border-collapse: collapse; }
.clipboard-rich :deep(td), .clipboard-rich :deep(th) { padding: 7px 10px; border: 1px solid var(--line); }
.clipboard-rich :deep(a) { color: var(--accent); }
.clipboard-rich :deep(img), .clipboard-image { display: block; max-width: 100%; height: auto; }
.clipboard-image + .clipboard-image { margin-top: 12px; }
.clipboard-empty { min-height: 260px; height: auto; padding: 40px 12px; }
.clipboard-empty p { max-width: 340px; line-height: 1.8; }
.clipboard-empty button { margin-top: 20px; font-size: 12px; }
.clipboard-empty kbd { margin-left: 6px; font: inherit; opacity: .7; }
.clipboard-skeleton { padding: 18px; border: 1px solid var(--line); border-radius: 12px; }
.clipboard-skeleton__header { display: flex; justify-content: space-between; margin-bottom: 24px; }
.clipboard-skeleton__header span, .clipboard-skeleton__line { height: 11px; border-radius: 4px; background: var(--sidebar); animation: clipboard-pulse 1.4s ease-in-out infinite; }
.clipboard-skeleton__header span { width: 90px; }
.clipboard-skeleton__header span:last-child { width: 64px; }
.clipboard-skeleton__line { margin-top: 12px; width: 100%; }
.clipboard-skeleton__line--short { width: 60%; }
.clipboard-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
@keyframes clipboard-pulse { 50% { opacity: .4; } }
@media (prefers-reduced-motion: reduce) { .clipboard-skeleton__header span, .clipboard-skeleton__line { animation: none; } }
</style>
