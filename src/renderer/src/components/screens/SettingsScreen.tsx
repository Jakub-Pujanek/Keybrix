import { useEffect, useState } from 'react'
import ToggleSwitch from '../primitives/ToggleSwitch'
import { useSettingsStore } from '../../store/settings.store'
import { t } from '../../lib/i18n'
import type { Language } from '../../../../shared/i18n'
import keybrixLogo from '../../assets/KeyBrix.svg'

function SectionHeader({ title }: { title: string }): React.JSX.Element {
  return (
    <h2 className="mb-4 text-[12px] font-bold tracking-[0.18em] text-(--kb-text-muted) uppercase">
      {title}
    </h2>
  )
}

function SettingsScreen(): React.JSX.Element {
  const appSettings = useSettingsStore((state) => state.appSettings)
  const currentLanguage = useSettingsStore((state) => state.language)
  const updateAppSettings = useSettingsStore((state) => state.updateAppSettings)

  const launchAtStartup = appSettings?.launchAtStartup ?? false
  const trayOnClose = appSettings?.minimizeToTrayOnClose ?? false
  const notifyOnRun = appSettings?.notifyOnMacroRun ?? false
  const language = appSettings?.language ?? currentLanguage

  const globalMaster = appSettings?.globalMaster ?? true
  const delayMs = appSettings?.delayMs ?? 0
  const stopOnError = appSettings?.stopOnError ?? true
  const themeMode = appSettings?.themeMode ?? 'DARK'
  const accentColor = appSettings?.accentColor ?? 'blue'

  const [delayDraft, setDelayDraft] = useState(String(delayMs))

  useEffect(() => {
    setDelayDraft(String(delayMs))
  }, [delayMs])

  const commitDelay = (): void => {
    const parsed = Number(delayDraft)
    const safeDelay = Number.isFinite(parsed)
      ? Math.min(10_000, Math.max(0, Math.round(parsed)))
      : delayMs
    setDelayDraft(String(safeDelay))
    void updateAppSettings({ delayMs: safeDelay })
  }

  const tx = (key: Parameters<typeof t>[1]): string => t(language, key)

  return (
    <section data-testid="settings-screen" className="h-full overflow-y-auto pb-8">
      <div className="mx-auto w-full max-w-215 space-y-10 pt-3">
        <div>
          <SectionHeader title={tx('settings.generalConfiguration')} />
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-(--kb-bg-surface) px-5 py-5">
              <span className="text-[25px] font-medium text-(--kb-text-main)">
                {tx('settings.launchAtStartup')}
              </span>
              <ToggleSwitch
                checked={launchAtStartup}
                onChange={(checked) => {
                  void updateAppSettings({ launchAtStartup: checked })
                }}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-(--kb-bg-surface) px-5 py-5">
              <span className="text-sm font-medium text-(--kb-text-main)">
                {tx('settings.minimizeToTrayOnClose')}
              </span>
              <ToggleSwitch
                checked={trayOnClose}
                onChange={(checked) => {
                  void updateAppSettings({ minimizeToTrayOnClose: checked })
                }}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-(--kb-bg-surface) px-5 py-5">
              <span className="text-sm font-medium text-(--kb-text-main)">
                {tx('settings.showNotificationsOnMacroRun')}
              </span>
              <ToggleSwitch
                checked={notifyOnRun}
                onChange={(checked) => {
                  void updateAppSettings({ notifyOnMacroRun: checked })
                }}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-(--kb-bg-surface) px-5 py-5">
              <span className="text-sm font-medium text-(--kb-text-main)">
                {tx('settings.languageSelection')}
              </span>
              <div className="relative">
                <select
                  value={language}
                  onChange={(event) => {
                    void updateAppSettings({
                      language: event.target.value as Language
                    })
                  }}
                  className="h-9 min-w-27.5 appearance-none rounded bg-(--kb-bg-surface-strong) px-3 pr-8 text-[12px] font-semibold tracking-[0.08em] text-(--kb-text-main) uppercase outline-none"
                >
                  <option value="POLSKI">{tx('settings.language.polish')}</option>
                  <option value="ENGLISH">{tx('settings.language.english')}</option>
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[rgb(var(--kb-accent-rgb))]">
                  ▾
                </span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <SectionHeader title={tx('settings.macroEngineSettings')} />
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-[rgb(var(--kb-accent-rgb)/0.45)] bg-(--kb-bg-surface) px-6 py-6 shadow-[0_0_0_1px_rgba(37,79,170,0.12)]">
              <div>
                <p className="text-[30px] font-semibold text-(--kb-text-main)">
                  {tx('settings.globalMasterSwitch')}
                </p>
                <p className="mt-1 text-[11px] font-semibold tracking-[0.13em] text-(--kb-text-muted) uppercase">
                  {tx('settings.enableAllMacrosGlobally')}
                </p>
              </div>
              <ToggleSwitch
                checked={globalMaster}
                onChange={(checked) => {
                  void updateAppSettings({ globalMaster: checked })
                }}
                accent="orange"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg bg-(--kb-bg-surface) px-5 py-5">
              <span className="text-sm font-medium text-(--kb-text-main)">
                {tx('settings.defaultDelayBetweenActions')}
              </span>
              <div className="flex items-center rounded bg-(--kb-bg-surface-strong) px-2 py-1">
                <input
                  type="number"
                  min={0}
                  max={10_000}
                  value={delayDraft}
                  onChange={(event) => setDelayDraft(event.target.value.replace(/[^0-9]/g, ''))}
                  onBlur={commitDelay}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      commitDelay()
                    }
                  }}
                  className="h-7 w-12 bg-transparent text-right text-sm text-[rgb(var(--kb-accent-rgb))] outline-none"
                />
                <span className="ml-2 text-xs font-semibold text-(--kb-text-muted) uppercase">
                  {tx('common.ms')}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-(--kb-bg-surface) px-5 py-5">
              <span className="text-sm font-medium text-(--kb-text-main)">
                {tx('settings.stopExecutionOnError')}
              </span>
              <ToggleSwitch
                checked={stopOnError}
                onChange={(checked) => {
                  void updateAppSettings({ stopOnError: checked })
                }}
              />
            </div>
          </div>
        </div>

        <div>
          <SectionHeader title={tx('settings.visualAppearance')} />
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-(--kb-bg-surface) px-5 py-5">
              <span className="text-sm font-medium text-(--kb-text-main)">
                {tx('settings.environmentTheme')}
              </span>
              <div className="inline-flex rounded bg-(--kb-bg-surface-strong) p-1">
                {(['DARK', 'LIGHT'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      void updateAppSettings({ themeMode: mode })
                    }}
                    className={`h-7 min-w-14.5 rounded px-3 text-[11px] font-bold tracking-widest uppercase ${themeMode === mode ? 'bg-[rgb(var(--kb-accent-rgb))] text-white' : 'text-(--kb-text-muted) hover:text-(--kb-text-main)'}`}
                  >
                    {mode === 'DARK' ? tx('settings.theme.dark') : tx('settings.theme.light')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-(--kb-bg-surface) px-5 py-5">
              <span className="text-sm font-medium text-(--kb-text-main)">
                {tx('settings.accentPalette')}
              </span>
              <div className="flex items-center gap-4">
                {(
                  [
                    { key: 'blue', className: 'bg-[#2f79ff]' },
                    { key: 'orange', className: 'bg-[#ff821f]' },
                    { key: 'violet', className: 'bg-[#8a5bff]' },
                    { key: 'green', className: 'bg-[#1cc397]' }
                  ] as const
                ).map((item) => {
                  const isActive = accentColor === item.key

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        void updateAppSettings({ accentColor: item.key })
                      }}
                      className={`h-6 w-6 rounded-full ${item.className} ${isActive ? 'ring-2 ring-(--kb-text-main) ring-offset-2 ring-offset-(--kb-bg-surface)' : ''}`}
                      aria-label={`${tx('settings.accentLabel')} ${item.key}`}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <article className="rounded-2xl bg-(--kb-bg-panel) px-6 py-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img
                src={keybrixLogo}
                alt="KeyBrix"
                className="h-14 w-14 select-none"
                draggable={false}
              />
              <div>
                <p className="text-3xl font-bold text-(--kb-text-main)">
                  {tx('common.appVersion')}
                </p>
                <p className="mt-1 text-sm tracking-[0.12em] text-(--kb-text-muted) uppercase">
                  {tx('settings.highPerformanceAutomationSuite')}
                </p>
                <button
                  type="button"
                  className="mt-4 text-sm font-bold tracking-[0.08em] text-[rgb(var(--kb-accent-rgb))] uppercase"
                >
                  {tx('settings.checkForSystemUpdates')} ↺
                </button>
              </div>
            </div>

            <div className="text-right">
              <p className="text-[12px] font-bold tracking-[0.16em] text-(--kb-text-muted) uppercase">
                {tx('settings.enginePipeline')}
              </p>
              <span className="mt-3 inline-flex items-center rounded-full bg-[rgb(var(--kb-accent-rgb)/0.2)] px-4 py-2 text-[11px] font-bold tracking-[0.14em] text-[rgb(var(--kb-accent-rgb))] uppercase">
                • {tx('settings.optimized')}
              </span>
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}

export default SettingsScreen
