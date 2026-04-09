import * as childProcess from 'node:child_process'
import {
  RuntimeSessionInfoSchema,
  SessionDiagnosticsSchema,
  type RuntimeSessionInfo,
  type SessionDetectionConfidence,
  type SessionDetectionProbe,
  type SessionDetectionSource,
  type SessionDiagnostics,
  type SessionType
} from '../../shared/api'

export type SessionDetectionSnapshot = {
  xdgSessionType: string | null
  waylandDisplay: string | null
  display: string | null
  desktopSession: string | null
  xdgSessionDesktop: string | null
  gdmSession: string | null
  sessionId: string | null
  loginctlSessionType: string | null
}

const normalize = (value: string | undefined): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const toSessionType = (value: string | null): SessionType => {
  if (!value) return 'UNKNOWN'

  const normalized = value.trim().toLowerCase()

  if (normalized === 'x11' || normalized === 'xorg') return 'X11'
  if (normalized === 'wayland') return 'WAYLAND'

  if (normalized.includes('x11') || normalized.includes('xorg')) return 'X11'
  if (normalized.includes('wayland')) return 'WAYLAND'

  return 'UNKNOWN'
}

const LOGINCTL_CANDIDATES = ['/usr/bin/loginctl', '/bin/loginctl', 'loginctl'] as const

const runLoginctl = (args: string[]): string | null => {
  for (const loginctlBinary of LOGINCTL_CANDIDATES) {
    try {
      return childProcess.execFileSync(loginctlBinary, args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      })
    } catch {
      // Try next loginctl candidate path.
    }
  }

  return null
}

const readSessionTypeById = (sessionRef: string): string | null => {
  const output = runLoginctl(['show-session', sessionRef, '-p', 'Type', '--value', '--no-pager'])
  return normalize(output ?? undefined)
}

const readSessionIdsFromList = (): string[] => {
  const output = runLoginctl(['list-sessions', '--no-legend', '--no-pager'])
  if (!output) return []

  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) return []

  const uid = typeof process.getuid === 'function' ? String(process.getuid()) : null

  const parsed = lines
    .map((line) => line.split(/\s+/))
    .map((parts) => ({
      id: parts[0] ?? '',
      uid: parts[1] ?? null,
      state: parts[5] ?? null
    }))
    .filter((entry) => entry.id.length > 0)

  const byUid = uid ? parsed.filter((entry) => entry.uid === uid) : parsed
  const candidates = byUid.length > 0 ? byUid : parsed
  const activeFirst = [...candidates].sort((a, b) => {
    if (a.state === 'active' && b.state !== 'active') return -1
    if (a.state !== 'active' && b.state === 'active') return 1
    return 0
  })

  return activeFirst.map((entry) => entry.id)
}

const readLoginctlSessionType = (sessionId: string | null): string | null => {
  if (process.platform !== 'linux') return null

  const candidates = ['self', sessionId].filter((candidate): candidate is string =>
    Boolean(candidate)
  )

  for (const candidate of candidates) {
    const parsed = readSessionTypeById(candidate)
    if (parsed) {
      return parsed
    }
  }

  const listedSessionIds = readSessionIdsFromList()
  for (const listedSessionId of listedSessionIds) {
    const parsed = readSessionTypeById(listedSessionId)
    if (parsed) {
      return parsed
    }
  }

  return null
}

export const readSessionEnvSnapshot = (): SessionDetectionSnapshot => {
  const sessionId = normalize(process.env['XDG_SESSION_ID'])

  return {
    xdgSessionType: normalize(process.env['XDG_SESSION_TYPE']),
    waylandDisplay: normalize(process.env['WAYLAND_DISPLAY']),
    display: normalize(process.env['DISPLAY']),
    desktopSession: normalize(process.env['DESKTOP_SESSION']),
    xdgSessionDesktop: normalize(process.env['XDG_SESSION_DESKTOP']),
    gdmSession: normalize(process.env['GDMSESSION']),
    sessionId,
    loginctlSessionType: readLoginctlSessionType(sessionId)
  }
}

type SessionResolution = {
  sessionType: SessionType
  rawSession: string | null
  detectionSource: SessionDetectionSource
  detectionConfidence: SessionDetectionConfidence
}

const resolveSessionFromSnapshot = (
  snapshot: SessionDetectionSnapshot,
  probes: SessionDetectionProbe[]
): SessionResolution => {
  const fromLoginctl = toSessionType(snapshot.loginctlSessionType)
  probes.push({
    step: 'loginctlSessionType',
    signal: snapshot.loginctlSessionType,
    matched: fromLoginctl !== 'UNKNOWN',
    note:
      fromLoginctl !== 'UNKNOWN'
        ? 'Resolved from loginctl session metadata.'
        : 'No decisive session type from loginctl metadata.'
  })
  if (fromLoginctl !== 'UNKNOWN') {
    return {
      sessionType: fromLoginctl,
      rawSession: snapshot.loginctlSessionType,
      detectionSource: 'LOGINCTL',
      detectionConfidence: 'HIGH'
    }
  }

  const fromXdg = toSessionType(snapshot.xdgSessionType)
  probes.push({
    step: 'xdgSessionType',
    signal: snapshot.xdgSessionType,
    matched: fromXdg !== 'UNKNOWN',
    note:
      fromXdg !== 'UNKNOWN'
        ? 'Resolved from XDG_SESSION_TYPE.'
        : 'XDG_SESSION_TYPE missing or inconclusive.'
  })
  if (fromXdg !== 'UNKNOWN') {
    // Guard against stale env after re-login: XDG says wayland, but no WAYLAND_DISPLAY and X11 DISPLAY is present.
    if (fromXdg === 'WAYLAND' && snapshot.display && !snapshot.waylandDisplay) {
      probes.push({
        step: 'xdgWaylandStaleGuard',
        signal: snapshot.xdgSessionType,
        matched: true,
        note: 'Downgraded stale XDG wayland signal to X11 because DISPLAY exists and WAYLAND_DISPLAY is missing.'
      })
      return {
        sessionType: 'X11',
        rawSession: 'x11',
        detectionSource: 'DISPLAY',
        detectionConfidence: 'MEDIUM'
      }
    }

    return {
      sessionType: fromXdg,
      rawSession: snapshot.xdgSessionType,
      detectionSource: 'XDG_SESSION_TYPE',
      detectionConfidence: 'HIGH'
    }
  }

  const fromDesktop = toSessionType(snapshot.desktopSession)
  probes.push({
    step: 'desktopSession',
    signal: snapshot.desktopSession,
    matched: fromDesktop !== 'UNKNOWN',
    note:
      fromDesktop !== 'UNKNOWN'
        ? 'Resolved from DESKTOP_SESSION.'
        : 'DESKTOP_SESSION missing or inconclusive.'
  })
  if (fromDesktop !== 'UNKNOWN') {
    return {
      sessionType: fromDesktop,
      rawSession: snapshot.desktopSession,
      detectionSource: 'DESKTOP_SESSION',
      detectionConfidence: 'MEDIUM'
    }
  }

  const fromXdgDesktop = toSessionType(snapshot.xdgSessionDesktop)
  probes.push({
    step: 'xdgSessionDesktop',
    signal: snapshot.xdgSessionDesktop,
    matched: fromXdgDesktop !== 'UNKNOWN',
    note:
      fromXdgDesktop !== 'UNKNOWN'
        ? 'Resolved from XDG_SESSION_DESKTOP.'
        : 'XDG_SESSION_DESKTOP missing or inconclusive.'
  })
  if (fromXdgDesktop !== 'UNKNOWN') {
    return {
      sessionType: fromXdgDesktop,
      rawSession: snapshot.xdgSessionDesktop,
      detectionSource: 'XDG_SESSION_DESKTOP',
      detectionConfidence: 'MEDIUM'
    }
  }

  const fromGdmSession = toSessionType(snapshot.gdmSession)
  probes.push({
    step: 'gdmSession',
    signal: snapshot.gdmSession,
    matched: fromGdmSession !== 'UNKNOWN',
    note:
      fromGdmSession !== 'UNKNOWN'
        ? 'Resolved from GDMSESSION.'
        : 'GDMSESSION missing or inconclusive.'
  })
  if (fromGdmSession !== 'UNKNOWN') {
    return {
      sessionType: fromGdmSession,
      rawSession: snapshot.gdmSession,
      detectionSource: 'GDMSESSION',
      detectionConfidence: 'MEDIUM'
    }
  }

  probes.push({
    step: 'display',
    signal: snapshot.display,
    matched: Boolean(snapshot.display),
    note: snapshot.display ? 'Resolved from DISPLAY fallback.' : 'DISPLAY not available.'
  })
  if (snapshot.display) {
    return {
      sessionType: 'X11',
      rawSession: 'x11',
      detectionSource: 'DISPLAY',
      detectionConfidence: 'LOW'
    }
  }

  probes.push({
    step: 'waylandDisplay',
    signal: snapshot.waylandDisplay,
    matched: Boolean(snapshot.waylandDisplay),
    note: snapshot.waylandDisplay
      ? 'Resolved from WAYLAND_DISPLAY fallback.'
      : 'WAYLAND_DISPLAY not available.'
  })
  if (snapshot.waylandDisplay) {
    return {
      sessionType: 'WAYLAND',
      rawSession: 'wayland',
      detectionSource: 'WAYLAND_DISPLAY',
      detectionConfidence: 'LOW'
    }
  }

  probes.push({
    step: 'platformFallback',
    signal: process.platform,
    matched: process.platform === 'win32',
    note:
      process.platform === 'win32'
        ? 'Detected Windows platform; treating runtime as X11-compatible for input injection.'
        : 'No platform fallback applied.'
  })
  if (process.platform === 'win32') {
    return {
      sessionType: 'X11',
      rawSession: 'windows',
      detectionSource: 'PROCESS_PLATFORM',
      detectionConfidence: 'MEDIUM'
    }
  }

  probes.push({
    step: 'finalUnknown',
    signal: null,
    matched: true,
    note: 'No signal could determine session type; returning UNKNOWN.'
  })
  return {
    sessionType: 'UNKNOWN',
    rawSession: null,
    detectionSource: 'UNKNOWN',
    detectionConfidence: 'LOW'
  }
}

export const detectRuntimeSessionDiagnostics = (): SessionDiagnostics => {
  const snapshot = readSessionEnvSnapshot()
  const probes: SessionDetectionProbe[] = []
  const resolved = resolveSessionFromSnapshot(snapshot, probes)

  const sessionInfo = RuntimeSessionInfoSchema.parse({
    sessionType: resolved.sessionType,
    rawSession: resolved.rawSession,
    detectedAt: new Date().toISOString(),
    isInputInjectionSupported: resolved.sessionType === 'X11',
    detectionSource: resolved.detectionSource,
    detectionConfidence: resolved.detectionConfidence
  })

  return SessionDiagnosticsSchema.parse({
    sessionInfo,
    snapshot,
    probes
  })
}

export const detectRuntimeSessionInfo = (): RuntimeSessionInfo =>
  detectRuntimeSessionDiagnostics().sessionInfo
