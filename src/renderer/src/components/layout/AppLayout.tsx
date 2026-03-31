import type { PropsWithChildren } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'

function AppLayout({ children }: PropsWithChildren): React.JSX.Element {
  return (
    <div className="min-h-screen bg-[#090f1c] text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <Header />
          <main className="flex-1 px-6 py-5">{children}</main>
        </div>
      </div>
    </div>
  )
}

export default AppLayout
