import type { ClipboardEntry } from '@/domain/clipboard'
import { normalizeClipboardContent, hasClipboardContent } from '@/domain/clipboard'

const DATABASE = 'floating-todo-clipboard'
const STORE = 'entries'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('剪贴板存储正被其他窗口占用，请关闭其他窗口后重试。'))
  })
}

async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = database.transaction(STORE, mode)
      const request = action(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(request.result)
      tx.onerror = () => reject(tx.error ?? request.error)
      tx.onabort = () => reject(tx.error ?? new Error('剪贴板保存已中断。'))
    })
  } finally {
    database.close()
  }
}

export async function loadClipboardEntries(): Promise<ClipboardEntry[]> {
  const records = await transaction<ClipboardEntry[]>('readonly', (store) => store.getAll())
  return records.flatMap((entry) => {
    if (!entry || typeof entry.id !== 'string' || typeof entry.createdAt !== 'string'
      || typeof entry.text !== 'string' || typeof entry.html !== 'string' || !Array.isArray(entry.images)) return []
    const content = normalizeClipboardContent({ ...entry, images: entry.images.filter((item) => typeof item === 'string') })
    return hasClipboardContent(content) ? [{ ...entry, ...content }] : []
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function saveClipboardEntry(entry: ClipboardEntry): Promise<void> {
  await transaction('readwrite', (store) => store.put(entry))
}

export async function deleteClipboardEntry(id: string): Promise<void> {
  await transaction('readwrite', (store) => store.delete(id))
}
