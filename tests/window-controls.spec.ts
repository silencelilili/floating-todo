import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FloatingView from '@/views/FloatingView.vue'
import MainView from '@/views/MainView.vue'
import QuickCaptureView from '@/views/QuickCaptureView.vue'
import { useTodoStore } from '@/stores/todo'
import { listenCurrentWindowFocus, setFloatingWindowCollapsed, startCurrentWindowDragging } from '@/services/runtime'

vi.mock('@/services/runtime', () => ({
  configureDesktop: vi.fn().mockResolvedValue(undefined),
  createBackup: vi.fn(),
  emitTaskChanged: vi.fn().mockResolvedValue(undefined),
  exportAppData: vi.fn(),
  hideCurrentWindow: vi.fn(),
  importAppData: vi.fn(),
  isTauri: () => false,
  listenCurrentWindowFocus: vi.fn().mockResolvedValue(() => undefined),
  listenTaskChanged: vi.fn().mockResolvedValue(() => undefined),
  loadAppData: vi.fn(),
  saveAppData: vi.fn(),
  setFloatingClickThrough: vi.fn().mockResolvedValue(undefined),
  setFloatingWindowCollapsed: vi.fn().mockResolvedValue(undefined),
  showWindow: vi.fn().mockResolvedValue(undefined),
  startCurrentWindowDragging: vi.fn().mockResolvedValue(undefined),
}))

describe('window controls', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('filters and sorts tasks from the main window controls', async () => {
    const store = useTodoStore()
    store.addTask('今天 普通任务')
    store.addTask('!!! 今天 紧急任务')
    const wrapper = mount(MainView)

    await wrapper.get('.ghost-button').trigger('click')
    expect(wrapper.find('.filter-popover').exists()).toBe(true)
    expect(wrapper.text()).toContain('仅已完成')
    const urgentFilter = wrapper.findAll('.filter-popover button').find((button) => button.text().includes('P3 紧急'))
    await urgentFilter?.trigger('click')
    expect(wrapper.findAll('.task-row__title').map((item) => item.text())).toEqual(['紧急任务'])

    const clearFilter = wrapper.findAll('.filter-popover button').find((button) => button.text().includes('清除筛选'))
    await clearFilter?.trigger('click')

    await wrapper.get('.icon-ghost').trigger('click')
    expect(wrapper.find('.filter-popover').exists()).toBe(false)
    expect(wrapper.find('.sort-popover').exists()).toBe(true)
    expect(wrapper.text()).toContain('最近创建')
    const titleSort = wrapper.findAll('.sort-popover button').find((button) => button.text().includes('任务名称'))
    await titleSort?.trigger('click')
    expect(wrapper.findAll('.task-row__title').map((item) => item.text())).toEqual(['紧急任务', '普通任务'])
  })

  it('hides the task search field on the settings page', async () => {
    const wrapper = mount(MainView)
    expect(wrapper.find('.search-box').exists()).toBe(true)

    const settingsNavigation = wrapper.findAll('.sidebar__bottom button').find((button) => button.text().includes('设置'))
    await settingsNavigation?.trigger('click')

    expect(wrapper.find('.search-box').exists()).toBe(false)
    expect(wrapper.find('.topbar').exists()).toBe(true)
  })

  it('requires confirmation before permanently clearing the trash', async () => {
    const store = useTodoStore()
    const task = store.addTask('待删除任务')
    store.deleteTask(task!.id)
    const wrapper = mount(MainView)

    const trashNavigation = wrapper.findAll('.sidebar__nav button').find((button) => button.text().includes('回收站'))
    await trashNavigation?.trigger('click')
    await wrapper.get('.clear-trash-button').trigger('click')

    expect(wrapper.get('[role="dialog"]').text()).toContain('清空后数据无法找回')
    expect(store.deletedTasks).toHaveLength(1)

    const cancel = wrapper.findAll('.confirm-dialog__actions button').find((button) => button.text() === '取消')
    await cancel?.trigger('click')
    expect(store.deletedTasks).toHaveLength(1)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)

    await wrapper.get('.clear-trash-button').trigger('click')
    await wrapper.get('.confirm-dialog__danger').trigger('click')
    await flushPromises()

    expect(store.deletedTasks).toHaveLength(0)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('moves tasks between the inbox and today from the task menu', async () => {
    const store = useTodoStore()
    const task = store.addTask('稍后整理资料')!
    const wrapper = mount(MainView)

    const inboxNavigation = wrapper.findAll('.sidebar__nav button').find((button) => button.text().includes('收集箱'))
    await inboxNavigation?.trigger('click')
    expect(wrapper.text()).toContain('稍后整理资料')

    await wrapper.get('.task-menu .icon-button').trigger('click')
    const moveToToday = wrapper.findAll('.task-menu__popover button').find((button) => button.text().includes('移到今天'))
    await moveToToday?.trigger('click')
    expect(task.status).toBe('active')
    expect(task.scheduledDate).not.toBeNull()
    expect(wrapper.text()).not.toContain('稍后整理资料')

    const todayNavigation = wrapper.findAll('.sidebar__nav button').find((button) => button.text().includes('今天'))
    await todayNavigation?.trigger('click')
    await wrapper.get('.task-menu .icon-button').trigger('click')
    const moveToInbox = wrapper.findAll('.task-menu__popover button').find((button) => button.text().includes('移到收集箱'))
    await moveToInbox?.trigger('click')

    expect(task.status).toBe('inbox')
    expect(task.scheduledDate).toBeNull()
  })

  it('starts dragging only while the floating window is unlocked', async () => {
    const store = useTodoStore()
    const wrapper = mount(FloatingView)
    const handle = wrapper.get('.floating-header__drag')

    await handle.trigger('mousedown', { button: 0 })
    expect(startCurrentWindowDragging).toHaveBeenCalledTimes(1)

    store.updateSettings({ floatingLocked: true })
    await wrapper.vm.$nextTick()
    await handle.trigger('mousedown', { button: 0 })
    expect(startCurrentWindowDragging).toHaveBeenCalledTimes(1)
    expect(handle.attributes('aria-disabled')).toBe('true')
  })

  it('keeps the title and header actions visible when collapsed', async () => {
    const wrapper = mount(FloatingView)

    expect(wrapper.find('[title="打开主窗口"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('打开主窗口')

    await wrapper.get('[title="收起"]').trigger('click')
    await flushPromises()

    expect(setFloatingWindowCollapsed).toHaveBeenCalledWith(true)
    expect(wrapper.find('.floating-list').exists()).toBe(false)
    expect(wrapper.find('.floating-header__drag').exists()).toBe(true)
    expect(wrapper.get('.floating-header__title').text()).toContain('今天')
    expect(wrapper.get('.floating-header__actions').findAll('button')).toHaveLength(4)
    expect(wrapper.find('.floating-pill').exists()).toBe(false)
    await wrapper.get('[title="展开"]').trigger('click')
    await flushPromises()
    expect(setFloatingWindowCollapsed).toHaveBeenLastCalledWith(false)
    expect(wrapper.find('.floating-list').exists()).toBe(true)
    wrapper.unmount()
  })

  it('ignores repeated collapse clicks while resizing and keeps the view expanded on failure', async () => {
    let rejectResize!: (error: Error) => void
    vi.mocked(setFloatingWindowCollapsed).mockImplementationOnce(() => new Promise((_, reject) => { rejectResize = reject }))
    const wrapper = mount(FloatingView)
    const button = wrapper.get('[aria-label="收起"]')
    await button.trigger('click')
    await button.trigger('click')
    expect(setFloatingWindowCollapsed).toHaveBeenCalledTimes(1)
    expect(button.attributes('disabled')).toBeDefined()
    rejectResize(new Error('resize failed'))
    await flushPromises()
    expect(wrapper.find('.floating-list').exists()).toBe(true)
    expect(button.attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[role="status"]').text()).toContain('请重试')
    wrapper.unmount()
  })

  it('shows every active task for today in compact mode', () => {
    const store = useTodoStore()
    store.updateSettings({ floatingCompact: true })
    for (let index = 1; index <= 4; index += 1) store.addTask(`今天 今日任务 ${index}`)

    const wrapper = mount(FloatingView)

    expect(wrapper.findAll('.floating-list .task-row')).toHaveLength(4)
  })

  it('focuses the quick capture input whenever its window gains focus', async () => {
    const wrapper = mount(QuickCaptureView, { attachTo: document.body })
    await flushPromises()

    const input = wrapper.get('input').element as HTMLInputElement
    input.blur()
    const focusHandler = vi.mocked(listenCurrentWindowFocus).mock.calls.at(-1)?.[0]
    focusHandler?.(true)
    await nextTick()

    expect(document.activeElement).toBe(input)
    wrapper.unmount()
  })
})
