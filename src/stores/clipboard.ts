import { ref } from 'vue'
import { defineStore } from 'pinia'
import { hasClipboardContent, normalizeClipboardContent, type ClipboardContent, type ClipboardEntry } from '@/domain/clipboard'
import { loadClipboardEntries, saveClipboardEntry, deleteClipboardEntry } from '@/services/clipboard-storage'

export const useClipboardStore = defineStore('clipboard', () => {
  const entries = ref<ClipboardEntry[]>([])
  const ready = ref(false)
  const loading = ref(false)
  const error = ref('')
  let pendingLoad: Promise<void> | null = null

  function initialize(): Promise<void> {
    if (ready.value) return Promise.resolve()
    if (pendingLoad) return pendingLoad
    loading.value = true
    error.value = ''
    pendingLoad = loadClipboardEntries()
      .then((loaded) => { entries.value = loaded; ready.value = true })
      .catch(() => { error.value = '暂时无法加载剪贴板，请重试。' })
      .finally(() => { loading.value = false; pendingLoad = null })
    return pendingLoad
  }

  async function add(content: ClipboardContent): Promise<void> {
    if (!ready.value) throw new Error('剪贴板尚未加载完成，请稍后重试。')
    const normalized = normalizeClipboardContent(content)
    if (!hasClipboardContent(normalized)) throw new Error('没有可保存的内容，请先复制文字、富文本或图片。')
    const entry: ClipboardEntry = { ...normalized, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
    try {
      await saveClipboardEntry(entry)
    } catch {
      throw new Error('保存失败，可能是本地存储空间不足。请释放空间后重新粘贴。')
    }
    entries.value.unshift(entry)
  }

  async function remove(id: string): Promise<void> {
    try {
      await deleteClipboardEntry(id)
    } catch {
      throw new Error('删除失败，内容仍然保留，请重试。')
    }
    entries.value = entries.value.filter((entry) => entry.id !== id)
  }

  return { entries, ready, loading, error, initialize, add, remove }
})
