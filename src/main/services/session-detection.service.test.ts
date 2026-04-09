import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { execFileSyncMock } = vi.hoisted(() => ({
  execFileSyncMock: vi.fn()
}))

vi.mock('node:child_process', () => ({
  execFileSync: execFileSyncMock
}))

import {
  detectRuntimeSessionDiagnostics,
  detectRuntimeSessionInfo
} from './session-detection.service'

const originalPlatform = process.platform

const setPlatform = (platform: NodeJS.Platform): void => {
  Object.defineProperty(process, 'platform', {
    value: platform,
    configurable: true
  })
}

const setEnv = (values: Record<string, string | undefined>): void => {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key]
      continue
    }

    process.env[key] = value
  }
}

describe('session-detection.service', () => {
  beforeEach(() => {
    setPlatform('linux')
    execFileSyncMock.mockReset()
    setEnv({
      XDG_SESSION_ID: '4',
      XDG_SESSION_TYPE: undefined,
      WAYLAND_DISPLAY: undefined,
      DISPLAY: undefined,
      DESKTOP_SESSION: undefined,
      XDG_SESSION_DESKTOP: undefined,
      GDMSESSION: undefined
    })
  })

  afterEach(() => {
    setPlatform(originalPlatform)
  })

  it('prefers loginctl result over conflicting env values', () => {
    execFileSyncMock.mockReturnValueOnce('x11\n')

    setEnv({
      XDG_SESSION_TYPE: 'wayland',
      WAYLAND_DISPLAY: 'wayland-0',
      DISPLAY: ':0',
      DESKTOP_SESSION: 'ubuntu'
    })

    const session = detectRuntimeSessionInfo()

    expect(session.sessionType).toBe('X11')
    expect(session.isInputInjectionSupported).toBe(true)
  })

  it('queries loginctl self before XDG session id to avoid stale session-id mismatch', () => {
    execFileSyncMock.mockReturnValueOnce('x11\n').mockReturnValueOnce('wayland\n')

    setEnv({
      XDG_SESSION_ID: '2',
      XDG_SESSION_TYPE: 'wayland',
      WAYLAND_DISPLAY: 'wayland-0',
      DISPLAY: ':0'
    })

    const session = detectRuntimeSessionInfo()

    expect(execFileSyncMock).toHaveBeenCalledWith(
      '/usr/bin/loginctl',
      ['show-session', 'self', '-p', 'Type', '--value', '--no-pager'],
      expect.any(Object)
    )
    expect(session.sessionType).toBe('X11')
  })

  it('falls back to XDG_SESSION_TYPE when loginctl is unavailable', () => {
    execFileSyncMock.mockImplementationOnce(() => {
      throw new Error('loginctl not found')
    })

    setEnv({ XDG_SESSION_TYPE: 'wayland' })

    const session = detectRuntimeSessionInfo()

    expect(session.sessionType).toBe('WAYLAND')
    expect(session.isInputInjectionSupported).toBe(false)
  })

  it('uses desktop session hint before display fallbacks', () => {
    execFileSyncMock.mockImplementationOnce(() => {
      throw new Error('no loginctl')
    })

    setEnv({
      XDG_SESSION_TYPE: 'tty',
      DESKTOP_SESSION: 'ubuntu-xorg',
      WAYLAND_DISPLAY: 'wayland-0',
      DISPLAY: ':0'
    })

    const session = detectRuntimeSessionInfo()

    expect(session.sessionType).toBe('X11')
    expect(session.rawSession).toBe('ubuntu-xorg')
  })

  it('prefers DISPLAY over stale WAYLAND_DISPLAY when no stronger signal exists', () => {
    execFileSyncMock.mockImplementation(() => {
      throw new Error('no loginctl')
    })

    setEnv({
      XDG_SESSION_TYPE: 'unknown',
      WAYLAND_DISPLAY: 'wayland-0',
      DISPLAY: ':0'
    })

    const session = detectRuntimeSessionInfo()

    expect(session.sessionType).toBe('X11')
    expect(session.rawSession).toBe('x11')
  })

  it('downgrades stale XDG wayland to X11 when only DISPLAY is present', () => {
    execFileSyncMock.mockImplementation(() => {
      throw new Error('no loginctl')
    })

    setEnv({
      XDG_SESSION_TYPE: 'wayland',
      WAYLAND_DISPLAY: undefined,
      DISPLAY: ':0'
    })

    const session = detectRuntimeSessionInfo()

    expect(session.sessionType).toBe('X11')
    expect(session.rawSession).toBe('x11')
  })

  it('uses XDG_SESSION_DESKTOP hint when DESKTOP_SESSION is missing', () => {
    execFileSyncMock.mockImplementation(() => {
      throw new Error('no loginctl')
    })

    setEnv({
      DESKTOP_SESSION: undefined,
      XDG_SESSION_TYPE: 'tty',
      XDG_SESSION_DESKTOP: 'ubuntu-xorg',
      DISPLAY: undefined,
      WAYLAND_DISPLAY: undefined
    })

    const session = detectRuntimeSessionInfo()

    expect(session.sessionType).toBe('X11')
    expect(session.rawSession).toBe('ubuntu-xorg')
  })

  it('uses GDMSESSION hint when desktop session variables are unavailable', () => {
    execFileSyncMock.mockImplementation(() => {
      throw new Error('no loginctl')
    })

    setEnv({
      DESKTOP_SESSION: undefined,
      XDG_SESSION_DESKTOP: undefined,
      XDG_SESSION_TYPE: 'tty',
      GDMSESSION: 'ubuntu-wayland',
      DISPLAY: undefined,
      WAYLAND_DISPLAY: undefined
    })

    const session = detectRuntimeSessionInfo()

    expect(session.sessionType).toBe('WAYLAND')
    expect(session.rawSession).toBe('ubuntu-wayland')
  })

  it('falls back to loginctl list-sessions when self and xdg session id lookup fail', () => {
    execFileSyncMock.mockImplementation((file, args) => {
      if (file !== '/usr/bin/loginctl' || !Array.isArray(args)) {
        throw new Error('missing binary')
      }

      if (args[0] === 'show-session' && args[1] === 'self') {
        throw new Error('self failed')
      }

      if (args[0] === 'show-session' && args[1] === '4') {
        throw new Error('id failed')
      }

      if (args[0] === 'list-sessions') {
        return '2 1000 jakub seat0 tty2 active no -\n'
      }

      if (args[0] === 'show-session' && args[1] === '2') {
        return 'x11\n'
      }

      throw new Error('unexpected loginctl args')
    })

    setEnv({
      XDG_SESSION_ID: '4',
      XDG_SESSION_TYPE: undefined,
      DISPLAY: undefined,
      WAYLAND_DISPLAY: undefined,
      DESKTOP_SESSION: undefined,
      XDG_SESSION_DESKTOP: undefined,
      GDMSESSION: undefined
    })

    const session = detectRuntimeSessionInfo()

    expect(session.sessionType).toBe('X11')
    expect(session.isInputInjectionSupported).toBe(true)
    expect(execFileSyncMock).toHaveBeenCalledWith(
      '/usr/bin/loginctl',
      ['list-sessions', '--no-legend', '--no-pager'],
      expect.any(Object)
    )
    expect(execFileSyncMock).toHaveBeenCalledWith(
      '/usr/bin/loginctl',
      ['show-session', '2', '-p', 'Type', '--value', '--no-pager'],
      expect.any(Object)
    )
  })

  it('falls back to global active sessions when uid filter has no match', () => {
    const originalGetuid = process.getuid
    process.getuid = vi.fn(() => 9999)

    try {
      execFileSyncMock.mockImplementation((file, args) => {
        if (file !== '/usr/bin/loginctl' || !Array.isArray(args)) {
          throw new Error('missing binary')
        }

        if (args[0] === 'show-session' && args[1] === 'self') {
          throw new Error('self failed')
        }

        if (args[0] === 'show-session' && args[1] === '4') {
          throw new Error('id failed')
        }

        if (args[0] === 'list-sessions') {
          return '2 1000 jakub seat0 tty2 active no -\n'
        }

        if (args[0] === 'show-session' && args[1] === '2') {
          return 'x11\n'
        }

        throw new Error('unexpected loginctl args')
      })

      setEnv({
        XDG_SESSION_ID: '4',
        XDG_SESSION_TYPE: undefined,
        DISPLAY: undefined,
        WAYLAND_DISPLAY: undefined,
        DESKTOP_SESSION: undefined,
        XDG_SESSION_DESKTOP: undefined,
        GDMSESSION: undefined
      })

      const session = detectRuntimeSessionInfo()

      expect(session.sessionType).toBe('X11')
      expect(session.rawSession).toBe('x11')
    } finally {
      process.getuid = originalGetuid
    }
  })

  it('tries absolute loginctl paths when command lookup by name is unavailable', () => {
    execFileSyncMock.mockImplementation((file, args) => {
      if (file === '/usr/bin/loginctl' && Array.isArray(args)) {
        if (args[0] === 'show-session' && args[1] === 'self') {
          return 'x11\n'
        }
      }

      throw new Error('missing binary')
    })

    setEnv({
      XDG_SESSION_ID: undefined,
      XDG_SESSION_TYPE: undefined,
      DISPLAY: undefined,
      WAYLAND_DISPLAY: undefined,
      DESKTOP_SESSION: undefined,
      XDG_SESSION_DESKTOP: undefined,
      GDMSESSION: undefined
    })

    const session = detectRuntimeSessionInfo()

    expect(session.sessionType).toBe('X11')
    expect(execFileSyncMock).toHaveBeenCalledWith(
      '/usr/bin/loginctl',
      ['show-session', 'self', '-p', 'Type', '--value', '--no-pager'],
      expect.any(Object)
    )
  })

  it('returns diagnostics with probe trace and source metadata', () => {
    execFileSyncMock.mockReturnValueOnce('x11\n')

    const diagnostics = detectRuntimeSessionDiagnostics()

    expect(diagnostics.sessionInfo.sessionType).toBe('X11')
    expect(diagnostics.sessionInfo.detectionSource).toBe('LOGINCTL')
    expect(diagnostics.sessionInfo.detectionConfidence).toBe('HIGH')
    expect(Array.isArray(diagnostics.probes)).toBe(true)
    expect(diagnostics.probes.length).toBeGreaterThan(0)
    expect(diagnostics.probes.some((probe) => probe.step === 'loginctlSessionType')).toBe(true)
  })

  it('treats Windows platform as X11-compatible when Linux signals are unavailable', () => {
    setPlatform('win32')
    execFileSyncMock.mockImplementation(() => {
      throw new Error('loginctl not available on win32')
    })

    setEnv({
      XDG_SESSION_ID: undefined,
      XDG_SESSION_TYPE: undefined,
      WAYLAND_DISPLAY: undefined,
      DISPLAY: undefined,
      DESKTOP_SESSION: undefined,
      XDG_SESSION_DESKTOP: undefined,
      GDMSESSION: undefined
    })

    const diagnostics = detectRuntimeSessionDiagnostics()

    expect(diagnostics.sessionInfo.sessionType).toBe('X11')
    expect(diagnostics.sessionInfo.isInputInjectionSupported).toBe(true)
    expect(diagnostics.sessionInfo.detectionSource).toBe('PROCESS_PLATFORM')
    expect(diagnostics.probes.some((probe) => probe.step === 'platformFallback' && probe.matched)).toBe(
      true
    )
  })
})
