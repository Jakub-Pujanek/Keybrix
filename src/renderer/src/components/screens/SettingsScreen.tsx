import { useEffect, useState } from 'react'
import ToggleSwitch from '../primitives/ToggleSwitch'
import { useSettingsStore } from '../../store/settings.store'
import { t } from '../../lib/i18n'
import type { Language } from '../../../../shared/i18n'

function SectionHeader({ title }: { title: string }): React.JSX.Element {
  return (
    <h2 className="mb-4 text-[12px] font-bold tracking-[0.18em] text-slate-400 uppercase">
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
  const delayMs = appSettings?.delayMs ?? 50
  const stopOnError = appSettings?.stopOnError ?? true
  const themeMode = appSettings?.themeMode ?? 'DARK'
  const accentColor = appSettings?.accentColor ?? 'blue'

  const [delayDraft, setDelayDraft] = useState(String(delayMs))

  useEffect(() => {
    setDelayDraft(String(delayMs))
  }, [delayMs])

  const commitDelay = (): void => {
    const parsed = Number(delayDraft)
    const safeDelay = Number.isFinite(parsed) ? Math.min(10_000, Math.max(0, Math.round(parsed))) : delayMs
    setDelayDraft(String(safeDelay))
    void updateAppSettings({ delayMs: safeDelay })
  }

  const tx = (key: Parameters<typeof t>[1]): string => t(language, key)

  return (
    <section data-testid="settings-screen" className="h-full overflow-y-auto pb-8">
      <div className="mx-auto w-full max-w-[860px] space-y-10 pt-3">
        <div>
          <SectionHeader title={tx('settings.generalConfiguration')} />
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-[#1a2039] px-5 py-5">
              <span className="text-[25x] font-medium text-slate-200">{tx('settings.launchAtStartup')}</span>
              <ToggleSwitch
                checked={launchAtStartup}
                onChange={(checked) => {
                  void updateAppSettings({ launchAtStartup: checked })
                }}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#1a2039] px-5 py-5">
              <span className="text-sm font-medium text-slate-200">
                {tx('settings.minimizeToTrayOnClose')}
              </span>
              <ToggleSwitch
                checked={trayOnClose}
                onChange={(checked) => {
                  void updateAppSettings({ minimizeToTrayOnClose: checked })
                }}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#1a2039] px-5 py-5">
              <span className="text-sm font-medium text-slate-200">{tx('settings.showNotificationsOnMacroRun')}</span>
              <ToggleSwitch
                checked={notifyOnRun}
                onChange={(checked) => {
                  void updateAppSettings({ notifyOnMacroRun: checked })
                }}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#1a2039] px-5 py-5">
              <span className="text-sm font-medium text-slate-200">{tx('settings.languageSelection')}</span>
              <div className="relative">
                <select
                  value={language}
                  onChange={(event) => {
                    void updateAppSettings({
                      language: event.target.value as Language
                    })
                  }}
                  className="h-9 min-w-[110px] appearance-none rounded bg-[#0d1222] px-3 pr-8 text-[12px] font-semibold tracking-[0.08em] text-slate-200 uppercase outline-none"
                >
                  <option value="POLSKI">{tx('settings.language.polish')}</option>
                  <option value="ENGLISH">{tx('settings.language.english')}</option>
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#5e7cff]">
                  ▾
                </span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <SectionHeader title={tx('settings.macroEngineSettings')} />
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-[#24458f] bg-[#1a2039] px-6 py-6 shadow-[0_0_0_1px_rgba(37,79,170,0.12)]">
              <div>
                <p className="text-[30px] font-semibold text-slate-100">{tx('settings.globalMasterSwitch')}</p>
                <p className="mt-1 text-[11px] font-semibold tracking-[0.13em] text-slate-400 uppercase">
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

            <div className="flex items-center justify-between rounded-lg bg-[#1a2039] px-5 py-5">
              <span className="text-sm font-medium text-slate-200">
                {tx('settings.defaultDelayBetweenActions')}
              </span>
              <div className="flex items-center rounded bg-[#0d1222] px-2 py-1">
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
                  className="h-7 w-12 bg-transparent text-right text-sm text-[#2f79ff] outline-none"
                />
                <span className="ml-2 text-xs font-semibold text-slate-300 uppercase">{tx('common.ms')}</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-[#1a2039] px-5 py-5">
              <span className="text-sm font-medium text-slate-200">{tx('settings.stopExecutionOnError')}</span>
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
            <div className="flex items-center justify-between rounded-lg bg-[#1a2039] px-5 py-5">
              <span className="text-sm font-medium text-slate-200">{tx('settings.environmentTheme')}</span>
              <div className="inline-flex rounded bg-[#0d1222] p-1">
                {(['DARK', 'LIGHT'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      void updateAppSettings({ themeMode: mode })
                    }}
                    className={`h-7 min-w-[58px] rounded px-3 text-[11px] font-bold tracking-[0.1em] uppercase ${themeMode === mode ? 'bg-[#2f79ff] text-white' : 'text-slate-300 hover:text-white'}`}
                  >
                    {mode === 'DARK' ? tx('settings.theme.dark') : tx('settings.theme.light')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-[#1a2039] px-5 py-5">
              <span className="text-sm font-medium text-slate-200">{tx('settings.accentPalette')}</span>
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
                      className={`h-6 w-6 rounded-full ${item.className} ${isActive ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1a2039]' : ''}`}
                      aria-label={`${tx('settings.accentLabel')} ${item.key}`}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <article className="rounded-2xl bg-[#11182b]/70 px-6 py-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-[#172244] text-[40px] font-bold text-[#2f79ff]">
                KB
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-100">{tx('common.appVersion')}</p>
                <p className="mt-1 text-sm tracking-[0.12em] text-slate-400 uppercase">
                  {tx('settings.highPerformanceAutomationSuite')}
                </p>
                <button
                  type="button"
                  className="mt-4 text-sm font-bold tracking-[0.08em] text-[#ff821f] uppercase"
                >
                  {tx('settings.checkForSystemUpdates')} ↺
                </button>
              </div>
            </div>

            <div className="text-right">
              <p className="text-[12px] font-bold tracking-[0.16em] text-slate-400 uppercase">
                {tx('settings.enginePipeline')}
              </p>
              <span className="mt-3 inline-flex items-center rounded-full bg-[#0d2558] px-4 py-2 text-[11px] font-bold tracking-[0.14em] text-[#2f79ff] uppercase">
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
