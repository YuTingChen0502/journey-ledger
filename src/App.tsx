import { useEffect, useState } from 'react'
import { supabase } from './services/supabase'
import { initDB } from './db'
import { Auth } from './components/Auth'
import { Button } from './components/ui/button'
import { Toaster } from "@/components/ui/sonner"
import { LoadingSkeleton } from './components/LoadingSkeleton'
import { TripDashboard } from './components/Home/TripDashboard'
import { TripTable } from './components/TripTable'
import { TimelineView } from './components/Timeline/TimelineView'
import { ResponsiveLayout } from './components/Layout/ResponsiveLayout'
import type { Session } from '@supabase/supabase-js'
import { Provider } from 'rxdb-hooks'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [db, setDb] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    initDB().then((database) => {
      setDb(database);
    }).catch(err => {
      console.error('DB Init Failed', err);
      alert('Database initialization failed. Check console.');
    });

    return () => subscription.unsubscribe()
  }, [])

  // Mode: 'dashboard' | 'table' | 'planner'
  const [mode, setMode] = useState<'dashboard' | 'table' | 'planner'>('dashboard');
  const TRIP_ID = 'nagoya-2026';

  if (!session) return <Auth />
  if (!db) return <LoadingSkeleton />

  const TopNavigation = (
    <>
      <div className="flex items-center gap-4 cursor-pointer" onClick={() => setMode('dashboard')}>
        <h2 className="text-xl font-serif font-bold tracking-tight text-primary">Nagoya 2026</h2>
      </div>
      <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
        <Button
          variant={mode === 'table' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setMode('table')}
          className="text-xs font-medium"
        >
          Grid
        </Button>
        <Button
          variant={mode === 'planner' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setMode('planner')}
          className="text-xs font-medium"
        >
          Planner
        </Button>
      </div>
    </>
  );

  const BottomNavigation = (
    <div className="h-16 flex items-center justify-around px-6">
      <Button
        variant={mode === 'dashboard' ? 'default' : 'ghost'}
        onClick={() => setMode('dashboard')}
        className="flex flex-col h-auto py-1 gap-1 min-w-[60px] rounded-xl"
      >
        <span className="text-xl">🏠</span>
        <span className="text-[10px] font-medium tracking-wide">Home</span>
      </Button>

      <Button
        variant={mode === 'table' ? 'default' : 'ghost'}
        onClick={() => setMode('table')}
        className="flex flex-col h-auto py-1 gap-1 min-w-[60px] rounded-xl"
      >
        <span className="text-xl">📊</span>
        <span className="text-[10px] font-medium tracking-wide">Grid</span>
      </Button>

      <Button
        variant={mode === 'planner' ? 'default' : 'ghost'}
        onClick={() => setMode('planner')}
        className="flex flex-col h-auto py-1 gap-1 min-w-[60px] rounded-xl"
      >
        <span className="text-xl">✏️</span>
        <span className="text-[10px] font-medium tracking-wide">Plan</span>
      </Button>
    </div>
  );

  return (
    <Provider db={db}>
      <Toaster />
      <ResponsiveLayout
        topNav={mode !== 'dashboard' ? TopNavigation : null}
        bottomNav={BottomNavigation}
        className={mode === 'dashboard' ? 'bg-transparent shadow-none !my-0 !max-w-none' : ''}
      >
        {/* Main Content Area */}
        <div className={`h-full w-full overflow-hidden relative ${mode !== 'dashboard' ? 'bg-card' : ''}`}>
          {mode === 'dashboard' && <TripDashboard onNavigate={setMode} />}
          {mode === 'table' && <TripTable />}
          {mode === 'planner' && <TimelineView tripId={TRIP_ID} />}
        </div>
      </ResponsiveLayout>
    </Provider>
  )
}

export default App
