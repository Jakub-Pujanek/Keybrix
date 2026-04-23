import type { PropsWithChildren } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import SessionStatusBanner from '../composites/system/SessionStatusBanner'
import UpdateReadyToast from '../composites/system/UpdateReadyToast'
import { useAppStore } from '../../store'

function AppLayout({ children }: PropsWithChildren): React.JSX.Element {
  const activeScreen = useAppStore((state) => state.activeScreen)
  const isEditorScreen = activeScreen === 'editor'

  return (
    <div className="h-screen w-full overflow-hidden bg-(--kb-bg-main) text-(--kb-text-main)">
      <div className="flex h-full w-full overflow-hidden">
        <Sidebar />
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <Header />
          <main
            className={`flex-1 min-w-0 px-6 py-5 ${isEditorScreen ? 'min-h-0 overflow-hidden' : 'overflow-y-auto overflow-x-hidden'}`}
          >
            {children}
          </main>
        </div>
      </div>
      <SessionStatusBanner />
      <UpdateReadyToast />
    </div>
  )
}

export default AppLayout
