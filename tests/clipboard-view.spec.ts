import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClipboardView from '@/views/ClipboardView.vue'
import MainView from '@/views/MainView.vue'
import { useClipboardStore } from '@/stores/clipboard'
import { loadClipboardEntries, saveClipboardEntry, deleteClipboardEntry } from '@/services/clipboard-storage'
import { copyClipboardContent, readClipboardContent } from '@/services/clipboard'

vi.mock('@/services/clipboard-storage', () => ({
  loadClipboardEntries: vi.fn(), saveClipboardEntry: vi.fn(), deleteClipboardEntry: vi.fn(),
}))
vi.mock('@/services/clipboard', async (original) => ({
  ...await original<typeof import('@/services/clipboard')>(),
  copyClipboardContent: vi.fn(), readClipboardContent: vi.fn(),
}))

const content = { text: '第一行\n  第二行\n\n最后一行', html: '', images: [] }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  vi.mocked(loadClipboardEntries).mockResolvedValue([])
  vi.mocked(saveClipboardEntry).mockResolvedValue()
  vi.mocked(deleteClipboardEntry).mockResolvedValue()
  vi.mocked(copyClipboardContent).mockResolvedValue()
  vi.mocked(readClipboardContent).mockResolvedValue(content)
})

describe('clipboard store', () => {
  it('adds and removes entries only after storage succeeds', async () => {
    const store = useClipboardStore()
    await store.initialize()
    await store.add(content)
    expect(store.entries[0].text).toBe(content.text)
    expect(saveClipboardEntry).toHaveBeenCalledOnce()
    await store.remove(store.entries[0].id)
    expect(deleteClipboardEntry).toHaveBeenCalledOnce()
    expect(store.entries).toEqual([])
  })

  it('does not lose entries or report success when persistence fails', async () => {
    const store = useClipboardStore()
    await store.initialize()
    vi.mocked(saveClipboardEntry).mockRejectedValueOnce(new Error('quota'))
    await expect(store.add(content)).rejects.toThrow('保存失败')
    expect(store.entries).toEqual([])
    await store.add(content)
    vi.mocked(deleteClipboardEntry).mockRejectedValueOnce(new Error('disk'))
    await expect(store.remove(store.entries[0].id)).rejects.toThrow('删除失败')
    expect(store.entries).toHaveLength(1)
  })

  it('blocks writes until load succeeds and rejects blank content', async () => {
    const store = useClipboardStore()
    await expect(store.add(content)).rejects.toThrow('尚未加载')
    await store.initialize()
    await expect(store.add({ text: '', html: '', images: [] })).rejects.toThrow('没有可保存')
    expect(saveClipboardEntry).not.toHaveBeenCalled()
  })
})

describe('clipboard page', () => {
  it('shows skeletons during load, then the empty state and paste guidance', async () => {
    let finish!: (value: []) => void
    vi.mocked(loadClipboardEntries).mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    const wrapper = mount(ClipboardView)
    expect(wrapper.findAll('.clipboard-skeleton')).toHaveLength(3)
    expect(wrapper.text()).not.toContain('剪贴板还是空的')
    finish([])
    await flushPromises()
    expect(wrapper.find('.clipboard-skeleton').exists()).toBe(false)
    expect(wrapper.text()).toContain('剪贴板还是空的')
    expect(wrapper.text()).toContain('在其他应用复制内容')
    wrapper.unmount()
  })

  it('shows load failure separately from empty state and allows retry', async () => {
    vi.mocked(loadClipboardEntries).mockRejectedValueOnce(new Error('disk'))
    const wrapper = mount(ClipboardView)
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('暂时无法打开')
    expect(wrapper.text()).not.toContain('剪贴板还是空的')
    await wrapper.get('.clipboard-empty button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('剪贴板还是空的')
    wrapper.unmount()
  })

  it('pastes the full content, copies it, deletes it and returns to empty', async () => {
    const wrapper = mount(ClipboardView)
    await flushPromises()
    const data = new DataTransfer()
    data.setData('text/plain', content.text)
    await wrapper.get('textarea').trigger('paste', { clipboardData: data })
    await flushPromises()
    expect(wrapper.get('pre').element.textContent).toBe(content.text)
    await wrapper.get('[aria-label="复制第 1 项"]').trigger('click')
    await flushPromises()
    expect(copyClipboardContent).toHaveBeenCalledWith(expect.objectContaining(content))
    expect(wrapper.get('[role="status"]').text()).toContain('已复制')
    await wrapper.get('[aria-label="删除第 1 项"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('剪贴板还是空的')
    wrapper.unmount()
  })

  it('surfaces read/copy failure without claiming success or losing content', async () => {
    vi.mocked(readClipboardContent).mockRejectedValueOnce(new Error('请按 Ctrl+V 粘贴'))
    const wrapper = mount(ClipboardView)
    await flushPromises()
    await wrapper.get('.clipboard-primary').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Ctrl+V')
    await useClipboardStore().add(content)
    await flushPromises()
    vi.mocked(copyClipboardContent).mockRejectedValueOnce(new Error('permission'))
    await wrapper.get('[aria-label="复制第 1 项"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('复制失败')
    expect(wrapper.findAll('article')).toHaveLength(1)
    wrapper.unmount()
  })

  it('renders formatted tables and image previews without truncating content', async () => {
    const wrapper = mount(ClipboardView)
    await flushPromises()
    await useClipboardStore().add({ text: '表格', html: '<table><tr><td><b>表格</b></td></tr></table>', images: ['data:image/png;base64,YQ=='] })
    await flushPromises()
    expect(wrapper.get('table td b').text()).toBe('表格')
    expect(wrapper.get('.clipboard-image').attributes('src')).toBe('data:image/png;base64,YQ==')
    wrapper.unmount()
  })

  it('opens from the main menu, hides task controls and preserves data across navigation', async () => {
    const wrapper = mount(MainView)
    const button = (label: string) => wrapper.findAll('.sidebar button').find((item) => item.text() === label)!
    await button('剪贴板').trigger('click')
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('剪贴板')
    expect(wrapper.find('.search-box').exists()).toBe(false)
    expect(wrapper.find('.page-heading__actions').exists()).toBe(false)
    expect(wrapper.find('.main-quick-add').exists()).toBe(false)
    await useClipboardStore().add(content)
    await button('全部任务').trigger('click')
    expect(wrapper.find('.search-box').exists()).toBe(true)
    expect(wrapper.find('.main-quick-add').exists()).toBe(true)
    await button('剪贴板').trigger('click')
    await flushPromises()
    expect(wrapper.get('pre').element.textContent).toBe(content.text)
    expect(loadClipboardEntries).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
})
