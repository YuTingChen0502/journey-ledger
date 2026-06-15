import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { RxDatabase } from 'rxdb'
import { initDB } from './db'
import { Auth } from './components/Auth'
import { Toaster } from "@/components/ui/sonner"
import { LoadingSkeleton } from './components/LoadingSkeleton'
import { TripLibrary } from './components/Trips/TripLibrary'
import { TripWorkspace } from './components/TripWorkspace'
import { Provider, useRxData } from 'rxdb-hooks'
import type { TripDocType } from './db/tripSchema'
import { SettingsProvider } from './context/SettingsContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { loadSelectedTripId, saveSelectedTripId, clearSelectedTripId } from './lib/selectedTrip'

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

function AppShell() {
  const { session, loading, signOut } = useAuth()
  const [db, setDb] = useState<RxDatabase | null>(null)

  // DB Initialization: Only start when we have a session to ensure replication has context.
  // The singleton in initDB makes this safe to call repeatedly.
  useEffect(() => {
    if (session?.user?.id) {
      initDB().then((database) => {
        setDb(database);
        // Phase 11: no auto-seeding. New users start with an empty TripLibrary;
        // existing users keep their trips via Supabase replication. The legacy
        // `ensureLegacyTrip` helper remains in src/db/trips.ts for manual/dev
        // migration only — it is intentionally NOT called here.
      }).catch(err => {
        console.error('DB Init Failed', err);
      });
    }
  }, [session]);

  // Splash Screen Logic
  useEffect(() => {
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

// App flow: Auth -> TripLibrary -> TripWorkspace(selectedTrip)
function AppContent({ signOut }: { signOut: () => Promise<void> }) {
  // Phase 7: trip selection is persisted across reloads (id only).
  const [selectedTripId, setSelectedTripId] = useState<string | null>(() => loadSelectedTripId())

  // Resolve the selected trip object reactively. The hook must run on every
  // render (rules of hooks), so a sentinel id is used when nothing is selected.
  // Deleted trips are excluded so a soft-deleted selection falls back to library.
  const { result: tripDocs, isFetching } = useRxData<TripDocType>('trips', collection =>
    collection.find({
      selector: { id: { $eq: selectedTripId ?? '__none__' }, is_deleted: { $eq: false } }
    })
  )
  const selectedTrip = selectedTripId ? (tripDocs[0] ?? null) : null

  const handleSelectTrip = (tripId: string) => {
    saveSelectedTripId(tripId)
    setSelectedTripId(tripId)
  }

  const handleBackToTrips = () => {
    clearSelectedTripId()
    setSelectedTripId(null)
  }

  // Still resolving the persisted/selected trip from the local DB.
  const resolvingTrip = !!selectedTripId && isFetching && !selectedTrip

  // Graceful recovery: a persisted/selected trip id that resolves to no
  // non-deleted document (deleted or removed externally) is dropped from
  // storage so a future reload starts at TripLibrary. We only clear the
  // persisted id here (a side effect); the view falls through to the library
  // below via derived state, avoiding both infinite loading and setState-in-effect.
  useEffect(() => {
    if (selectedTripId && !isFetching && !selectedTrip) {
      clearSelectedTripId()
    }
  }, [selectedTripId, isFetching, selectedTrip])

  let content: ReactNode
  if (selectedTrip) {
    content = (
      <TripWorkspace
        key={selectedTrip.id}
        trip={selectedTrip}
        onBackToTrips={handleBackToTrips}
        signOut={signOut}
      />
    )
  } else if (resolvingTrip) {
    content = <LoadingSkeleton message="Loading trip..." />
  } else {
    content = <TripLibrary onSelectTrip={handleSelectTrip} signOut={signOut} />
  }

  return (
    <>
      <Toaster />
      {content}
    </>
  )
}

export default App
