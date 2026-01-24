import { useEffect, useState } from 'react'
import { supabase } from './services/supabase'
import { initDB } from './db'
import { Auth } from './components/Auth'
import { Button } from './components/ui/button'
import { Toaster } from "@/components/ui/sonner"
import { LoadingSkeleton } from './components/LoadingSkeleton'
import { TripDashboard } from './components/Home/TripDashboard'
import { TripTable } from './components/TripTable'
import { TripViewer } from './components/TripViewer/TripViewer'
import { TimelineView } from './components/Timeline/TimelineView'
import { ResponsiveLayout } from './components/Layout/ResponsiveLayout'
import { ImportModal } from './components/ImportModal'
import { EventModal } from './components/EventModal'
import { ErrorBoundary } from './components/ErrorBoundary'
import type { Session } from '@supabase/supabase-js'
import { Provider } from 'rxdb-hooks'
import { Plus } from 'lucide-react'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [db, setDb] = useState<any>(null)

  // Event Modal State
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

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

  // Mode for Top Level Navigation
  const [mode, setMode] = useState<'dashboard' | 'overview' | 'planning'>('dashboard');
  // Sub-mode for Planning Section
  const [planningView, setPlanningView] = useState<'timeline' | 'table'>('timeline');

  const TRIP_ID = 'nagoya-2026';

  const handleCreateEvent = () => {
    setSelectedEventId(null);
    setEventModalOpen(true);
  };

  const handleEditEvent = (id: string) => {
    setSelectedEventId(id);
    setEventModalOpen(true);
  };

  if (!session) return <Auth />
  if (!db) return <LoadingSkeleton />

  const TopNavigation = (
    <>
      <div className="flex items-center gap-4 cursor-pointer" onClick={() => setMode('dashboard')}>
        <h2 className="text-xl font-serif font-bold tracking-tight text-primary">Nagoya 2026</h2>
      </div>

      {mode === 'planning' && (
        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg ml-4">
          <Button
            variant={planningView === 'timeline' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setPlanningView('timeline')}
            className="text-xs font-medium"
          >
            Timeline
          </Button>
          <Button
            variant={planningView === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setPlanningView('table')}
            className="text-xs font-medium"
          >
            Data Grid
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2 ml-auto">
        {mode === 'planning' && (
          <Button
            size="sm"
            variant="outline"
            className="gap-2 border-dashed"
            onClick={handleCreateEvent}
          >
            <Plus className="w-4 h-4" /> Create
          </Button>
        )}

        {mode === 'overview' && (
          <Button variant="ghost" size="sm" onClick={() => setMode('planning')}>
            Edit Itinerary
          </Button>
        )}
        <ImportModal
          tripId={TRIP_ID}
          userId={session.user.id}
          onImportSuccess={() => {
            setMode('planning');
            setPlanningView('table');
          }}
        />
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
        variant={mode === 'overview' ? 'default' : 'ghost'}
        onClick={() => setMode('overview')}
        className="flex flex-col h-auto py-1 gap-1 min-w-[60px] rounded-xl"
      >
        <span className="text-xl">📖</span>
        <span className="text-[10px] font-medium tracking-wide">Journal</span>
      </Button>

      <Button
        variant={mode === 'planning' ? 'default' : 'ghost'}
        onClick={() => setMode('planning')}
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
          <ErrorBoundary>
            {mode === 'dashboard' && <TripDashboard onNavigate={(view) => {
              if (view === 'planner') {
                setPlanningView('timeline');
                setMode('planning');
              } else if (view === 'table') {
                setPlanningView('table');
                setMode('planning');
              } else {
                setMode(view);
              }
            }} />}

            {mode === 'overview' && <TripViewer tripId={TRIP_ID} />}

            {mode === 'planning' && planningView === 'timeline' && <TimelineView tripId={TRIP_ID} />}
            {mode === 'planning' && planningView === 'table' && <TripTable onEdit={handleEditEvent} />}
          </ErrorBoundary>
        </div>
      </ResponsiveLayout>

      {/* Event Modal (Global) */}
      <EventModal
        userId={session.user.id}
        eventId={selectedEventId}
        isOpen={eventModalOpen}
        onOpenChange={setEventModalOpen}
        defaultDate={new Date()}
      />
    </Provider>
  )
}

export default App
