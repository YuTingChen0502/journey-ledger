import { useState, useEffect } from 'react'
import { initDB } from './db'
import { ensureLegacyTrip } from './db/trips'
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
import { Provider } from 'rxdb-hooks'
import { Plus, LogOut, Home, BookOpen, Map } from 'lucide-react'
import { SettingsProvider } from './context/SettingsContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { useTranslation } from './hooks/useTranslation'

import { EventDetailView } from './components/Timeline/EventDetailView'

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

function AppShell() {
  const { session, loading, signOut } = useAuth()
  const [db, setDb] = useState<any>(null)

  // DB Initialization dependent on mounting, but ideally deferred until auth?
  // Actually RxDB is local, so we can init it, but replication needs auth.
  // Let's keep initDB at root for now, but replication hooks might need session.
  // The singleton fix we made ensures initDB is safe to call.
  // DB Initialization: Only start when we have a session to ensure replication has context
  useEffect(() => {
    if (session?.user?.id) {
      const ownerId = session.user.id;
      initDB().then((database) => {
        setDb(database);
        // Phase 1: ensure the legacy Nagoya 2026 trip exists so existing
        // events (trip_id = 'nagoya-2026') are not orphaned. Non-blocking.
        ensureLegacyTrip(database.trips, ownerId).catch(err => {
          console.error('Legacy trip init failed', err);
        });
      }).catch(err => {
        console.error('DB Init Failed', err);
      });
    }
  }, [session]);

  // Splash Screen Logic
  useEffect(() => {
    // If we are mostly ready (db loaded or public mode), hide splash
    // Adding a small delay for smoothness
    if (!loading && (db || !session)) {
      const timer = setTimeout(() => {
        const splash = document.getElementById('splash');
        if (splash) splash.classList.add('hidden');
      }, 500); // 500ms min show time for aesthetic
      return () => clearTimeout(timer);
    }
  }, [loading, db, session]);

  if (loading) return <LoadingSkeleton message="Authenticating..." />
  if (!session) return <Auth />
  if (!db) return <LoadingSkeleton message="Loading Database..." />

  return (
    <Provider db={db}>
      <SettingsProvider>
        <AppContent signOut={signOut} />
      </SettingsProvider>
    </Provider>
  )
}

function AppContent({ signOut }: { signOut: () => Promise<void> }) {
  const { session } = useAuth()
  const { t } = useTranslation()

  // App State
  const [mode, setMode] = useState<'dashboard' | 'overview' | 'planning'>('dashboard')
  const [planningView, setPlanningView] = useState<'timeline' | 'table'>('timeline')

  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [detailViewOpen, setDetailViewOpen] = useState(false)

  const TRIP_ID = 'nagoya-2026'

  // Handlers
  const handleCreateEvent = () => {
    setSelectedEventId(null)
    setEventModalOpen(true)
  }

  const handleEditEvent = (id: string) => {
    setSelectedEventId(id)
    setEventModalOpen(true)
  }

  const handleEventClick = (id: string) => {
    setSelectedEventId(id)
    setDetailViewOpen(true)
  }

  // Navigation Components
  const TopNavigation = (
    <>
      <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setMode('dashboard')}>
        <div className="relative w-12 h-12 rounded-full overflow-hidden transition-colors shadow-sm bg-[#4a1920]">
          <img src="/home_icon.jpg" alt="Home" className="w-full h-full object-cover opacity-95 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {mode === 'planning' && (
        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg ml-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPlanningView('timeline')}
            className={`text-xs font-medium transition-colors ${planningView === 'timeline' ? 'bg-[#923e48] text-white hover:bg-[#923e48]/90 hover:text-white' : 'text-muted-foreground hover:text-[#923e48]'}`}
          >
            {t('nav.timeline')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPlanningView('table')}
            className={`text-xs font-medium transition-colors ${planningView === 'table' ? 'bg-[#923e48] text-white hover:bg-[#923e48]/90 hover:text-white' : 'text-muted-foreground hover:text-[#923e48]'}`}
          >
            {t('nav.table')}
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
            <Plus className="w-4 h-4" /> {t('nav.create')}
          </Button>
        )}

        {mode === 'overview' && (
          <Button variant="ghost" size="sm" onClick={() => setMode('planning')}>
            {t('nav.edit_itinerary')}
          </Button>
        )}
        <ImportModal
          tripId={TRIP_ID}
          userId={"current-user"} // Handled by ImportModal internally via useAuth now, or we pass it
          onImportSuccess={() => {
            setMode('planning')
            setPlanningView('table')
          }}
        />
        <Button variant="ghost" size="icon" onClick={() => signOut()} title="Sign Out">
          <LogOut className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>
    </>
  )

  const BottomNavigation = (
    <div className="h-16 flex items-center justify-around px-6">
      <Button
        variant="ghost"
        onClick={() => setMode('dashboard')}
        className={`flex flex-col h-auto py-1 gap-1 min-w-[60px] rounded-xl transition-colors ${mode === 'dashboard' ? 'text-[#923e48]' : 'text-muted-foreground/60 hover:text-[#923e48]/80'}`}
      >
        <Home className="w-6 h-6" strokeWidth={mode === 'dashboard' ? 2.5 : 2} />
        <span className="text-[10px] font-medium tracking-wide">{t('nav.home')}</span>
      </Button>

      <Button
        variant="ghost"
        onClick={() => setMode('overview')}
        className={`flex flex-col h-auto py-1 gap-1 min-w-[60px] rounded-xl transition-colors ${mode === 'overview' ? 'text-[#923e48]' : 'text-muted-foreground/60 hover:text-[#923e48]/80'}`}
      >
        <BookOpen className="w-6 h-6" strokeWidth={mode === 'overview' ? 2.5 : 2} />
        <span className="text-[10px] font-medium tracking-wide">{t('nav.journal')}</span>
      </Button>

      <Button
        variant="ghost"
        onClick={() => setMode('planning')}
        className={`flex flex-col h-auto py-1 gap-1 min-w-[60px] rounded-xl transition-colors ${mode === 'planning' ? 'text-[#923e48]' : 'text-muted-foreground/60 hover:text-[#923e48]/80'}`}
      >
        <Map className="w-6 h-6" strokeWidth={mode === 'planning' ? 2.5 : 2} />
        <span className="text-[10px] font-medium tracking-wide">{t('nav.plan')}</span>
      </Button>
      <div className="absolute bottom-1 right-2 text-[8px] text-muted-foreground/30 pointer-events-none">v0.12.2</div>
    </div>
  )

  return (
    <>
      <Toaster />
      <ResponsiveLayout
        topNav={mode !== 'dashboard' ? TopNavigation : null}
        bottomNav={BottomNavigation}
        className={mode === 'dashboard' ? 'bg-transparent shadow-none !my-0 !max-w-none' : ''}
      >
        <div className={`h-full w-full overflow-hidden relative p-0 m-0 ${mode !== 'dashboard' ? 'bg-card' : ''}`}>
          <ErrorBoundary>
            {mode === 'dashboard' && <TripDashboard onNavigate={(view) => {
              if (view === 'planner') {
                setPlanningView('timeline')
                setMode('planning')
              } else if (view === 'table') {
                setPlanningView('table')
                setMode('planning')
              } else {
                setMode(view)
              }
            }} />}

            {mode === 'overview' && <TripViewer tripId={TRIP_ID} onEventClick={handleEventClick} />}

            {mode === 'planning' && planningView === 'timeline' && <TimelineView tripId={TRIP_ID} onEventClick={handleEventClick} />}
            {mode === 'planning' && planningView === 'table' && <TripTable onEdit={handleEditEvent} />}
          </ErrorBoundary>
        </div>
      </ResponsiveLayout>

      <EventModal
        userId={session?.user?.id || 'guest'}
        eventId={selectedEventId}
        isOpen={eventModalOpen}
        onOpenChange={setEventModalOpen}
        defaultDate={new Date()}
      />

      <EventDetailView
        eventId={selectedEventId}
        open={detailViewOpen}
        onClose={() => setDetailViewOpen(false)}
      />
    </>
  )
}

export default App
