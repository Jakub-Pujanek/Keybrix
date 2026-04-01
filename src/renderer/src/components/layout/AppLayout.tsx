import type { PropsWithChildren } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'

function AppLayout({ children }: PropsWithChildren): React.JSX.Element {
  return (
    <div className="h-screen w-full overflow-hidden bg-[#090f1c] text-slate-100">
      <div className="flex h-full w-full overflow-hidden">
        <Sidebar />
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 min-w-0 overflow-hidden px-6 py-5">{children}</main>
        </div>
      </div>
    </div>
  )
}

export default AppLayout
