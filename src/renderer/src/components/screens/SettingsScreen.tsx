import { useState } from 'react'
import ToggleSwitch from '../primitives/ToggleSwitch'

type ThemeMode = 'DARK' | 'LIGHT'
type AccentColor = 'blue' | 'orange' | 'violet' | 'green'

function SectionHeader({ title }: { title: string }): React.JSX.Element {
  return (
    <h2 className="mb-4 text-[12px] font-bold tracking-[0.18em] text-slate-400 uppercase">
      {title}
    </h2>
  )
}

function SettingsScreen(): React.JSX.Element {
  const [launchAtStartup, setLaunchAtStartup] = useState(true)
  const [trayOnClose, setTrayOnClose] = useState(true)
  const [notifyOnRun, setNotifyOnRun] = useState(true)
  const [language, setLanguage] = useState('POLSKI')

  const [globalMaster, setGlobalMaster] = useState(true)
  const [delayMs, setDelayMs] = useState(50)
  const [stopOnError, setStopOnError] = useState(true)

  const [themeMode, setThemeMode] = useState<ThemeMode>('DARK')
  const [accentColor, setAccentColor] = useState<AccentColor>('blue')

  return (
    <section data-testid="settings-screen" className="h-full overflow-y-auto pb-8">
      <div className="mx-auto w-full max-w-[860px] space-y-10 pt-3">
        <div>
          <SectionHeader title="General Configuration" />
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-[#1a2039] px-5 py-5">
              <span className="text-[25x] font-medium text-slate-200">
                Launch at Windows startup
              </span>
              <ToggleSwitch checked={launchAtStartup} onChange={setLaunchAtStartup} />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#1a2039] px-5 py-5">
              <span className="text-sm font-medium text-slate-200">Minimize to tray on close</span>
              <ToggleSwitch checked={trayOnClose} onChange={setTrayOnClose} />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#1a2039] px-5 py-5">
              <span className="text-sm font-medium text-slate-200">
                Show notifications on macro run
              </span>
              <ToggleSwitch checked={notifyOnRun} onChange={setNotifyOnRun} />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#1a2039] px-5 py-5">
              <span className="text-sm font-medium text-slate-200">Language Selection</span>
              <div className="relative">
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  className="h-9 min-w-[110px] appearance-none rounded bg-[#0d1222] px-3 pr-8 text-[12px] font-semibold tracking-[0.08em] text-slate-200 uppercase outline-none"
                >
                  <option value="POLSKI">POLSKI</option>
                  <option value="ENGLISH">ENGLISH</option>
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#5e7cff]">
                  ▾
                </span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <SectionHeader title="Macro Engine Settings" />
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-[#24458f] bg-[#1a2039] px-6 py-6 shadow-[0_0_0_1px_rgba(37,79,170,0.12)]">
              <div>
                <p className="text-[30px] font-semibold text-slate-100">Global Master Switch</p>
                <p className="mt-1 text-[11px] font-semibold tracking-[0.13em] text-slate-400 uppercase">
                  Enable all macros globally
                </p>
              </div>
              <ToggleSwitch checked={globalMaster} onChange={setGlobalMaster} accent="orange" />
            </div>

            <div className="flex items-center justify-between rounded-lg bg-[#1a2039] px-5 py-5">
              <span className="text-sm font-medium text-slate-200">
                Default delay between actions
              </span>
              <div className="flex items-center rounded bg-[#0d1222] px-2 py-1">
                <input
                  type="number"
                  min={0}
                  value={delayMs}
                  onChange={(event) => setDelayMs(Number(event.target.value) || 0)}
                  className="h-7 w-12 bg-transparent text-right text-sm text-[#2f79ff] outline-none"
                />
                <span className="ml-2 text-xs font-semibold text-slate-300 uppercase">ms</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-[#1a2039] px-5 py-5">
              <span className="text-sm font-medium text-slate-200">Stop execution on error</span>
              <ToggleSwitch checked={stopOnError} onChange={setStopOnError} />
            </div>
          </div>
        </div>

        <div>
          <SectionHeader title="Visual Appearance" />
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-[#1a2039] px-5 py-5">
              <span className="text-sm font-medium text-slate-200">Environment Theme</span>
              <div className="inline-flex rounded bg-[#0d1222] p-1">
                {(['DARK', 'LIGHT'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setThemeMode(mode)}
                    className={`h-7 min-w-[58px] rounded px-3 text-[11px] font-bold tracking-[0.1em] uppercase ${themeMode === mode ? 'bg-[#2f79ff] text-white' : 'text-slate-300 hover:text-white'}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-[#1a2039] px-5 py-5">
              <span className="text-sm font-medium text-slate-200">Accent Palette</span>
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
                      onClick={() => setAccentColor(item.key)}
                      className={`h-6 w-6 rounded-full ${item.className} ${isActive ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1a2039]' : ''}`}
                      aria-label={`Accent ${item.key}`}
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
                <p className="text-3xl font-bold text-slate-100">KeyBrix v1.0.0</p>
                <p className="mt-1 text-sm tracking-[0.12em] text-slate-400 uppercase">
                  High-Performance Automation Suite
                </p>
                <button
                  type="button"
                  className="mt-4 text-sm font-bold tracking-[0.08em] text-[#ff821f] uppercase"
                >
                  Check for system updates ↺
                </button>
              </div>
            </div>

            <div className="text-right">
              <p className="text-[12px] font-bold tracking-[0.16em] text-slate-400 uppercase">
                Engine Pipeline
              </p>
              <span className="mt-3 inline-flex items-center rounded-full bg-[#0d2558] px-4 py-2 text-[11px] font-bold tracking-[0.14em] text-[#2f79ff] uppercase">
                • Optimized
              </span>
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}

export default SettingsScreen
