import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUpdaterStore } from './updater.store'

let onStateChangeListener: ((state: unknown) => void) | null = null

const installNowMock = vi.fn(async () => true)
const onStateChangeMock = vi.fn<(callback: (state: unknown) => void) => () => void>((callback) => {
  onStateChangeListener = callback
  return vi.fn()
})

beforeEach(() => {
  installNowMock.mockReset()
  onStateChangeMock.mockClear()
  onStateChangeListener = null
  ;(window as { api: unknown }).api = {
    updater: {
      installNow: installNowMock,
      onStateChange: onStateChangeMock
    }
  } as unknown

  // The store keeps an internal singleton unsubscribe reference; clear it before each test.
  useUpdaterStore.getState().subscribeUpdater()()

  useUpdaterStore.setState({
    updaterState: { status: 'IDLE' },
    isToastVisible: false,
    isInstalling: false
  })
})

describe('updater.store', () => {
  it('opens toast when update is downloaded and dismisses it locally', () => {
    useUpdaterStore.getState().subscribeUpdater()

    onStateChangeListener?.({
      status: 'DOWNLOADED',
      version: '1.0.1'
    })

    expect(useUpdaterStore.getState().isToastVisible).toBe(true)
    expect(useUpdaterStore.getState().updaterState.version).toBe('1.0.1')

    useUpdaterStore.getState().dismissToast()

    expect(useUpdaterStore.getState().isToastVisible).toBe(false)
  })

  it('invokes install action only after download and hides toast on success', async () => {
    useUpdaterStore.getState().subscribeUpdater()

    onStateChangeListener?.({
      status: 'DOWNLOADED',
      version: '1.0.1'
    })

    const installed = await useUpdaterStore.getState().installNow()

    expect(installed).toBe(true)
    expect(installNowMock).toHaveBeenCalledTimes(1)
    expect(useUpdaterStore.getState().isToastVisible).toBe(false)
  })

  it('does not call install when update is not downloaded', async () => {
    const installed = await useUpdaterStore.getState().installNow()

    expect(installed).toBe(false)
    expect(installNowMock).not.toHaveBeenCalled()
  })
})
