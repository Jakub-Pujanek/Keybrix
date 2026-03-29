function App(): React.JSX.Element {
  return (
    <main className="text-center">
      <div className="rounded-2xl border border-slate-800/70 bg-slate-900/70 p-8 shadow-[0_0_30px_-10px_rgba(15,23,42,0.8)] backdrop-blur">
        <h1 className="text-3xl font-bold tracking-tight text-cyan-300">
          Keybrix (Tailwind Ready)
        </h1>
        <p className="mt-2 text-slate-300">
          Hooks, IPC i architektura backend/frontend są w miejscu startowym.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <span className="rounded-lg bg-slate-800 px-3 py-1 text-sm text-slate-100">Dev mode</span>
          <span className="rounded-lg bg-cyan-500 px-3 py-1 text-sm text-slate-950">
            Styles via Tailwind
          </span>
        </div>
      </div>
    </main>
  )
}

export default App
