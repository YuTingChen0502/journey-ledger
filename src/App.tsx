import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { RxDatabase } from 'rxdb'
import { initDB } from './db'
import { ensureLegacyTrip } from './db/trips'
import { Auth } from './components/Auth'
import { Toaster } from "@/components/ui/sonner"
import { LoadingSkeleton } from './components/LoadingSkeleton'
import { TripLibrary } from './components/Trips/TripLibrary'
import { TripWorkspace } from './components/TripWorkspace'
import { Provider, useRxData } from 'rxdb-hooks'
import type { TripDocType } from './db/tripSchema'
import { SettingsProvider } from './context/SettingsContext'
import { AuthProvider, useAuth } from './context/AuthContext'

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
  // Phase 2/3: trip selection gate. Until a trip is selected, show TripLibrary.
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)

  // Resolve the selected trip object reactively. The hook must run on every
  // render (rules of hooks), so a sentinel id is used when nothing is selected.
  const { result: tripDocs } = useRxData<TripDocType>('trips', collection =>
    collection.find({
      selector: { id: { $eq: selectedTripId ?? '__none__' } }
    })
  )
  const selectedTrip = selectedTripId ? (tripDocs[0] ?? null) : null

  let content: ReactNode
  if (!selectedTripId) {
    content = <TripLibrary onSelectTrip={setSelectedTripId} signOut={signOut} />
  } else if (!selectedTrip) {
    content = <LoadingSkeleton message="Loading trip..." />
  } else {
    content = (
      <TripWorkspace
        key={selectedTrip.id}
        trip={selectedTrip}
        onBackToTrips={() => setSelectedTripId(null)}
        signOut={signOut}
      />
    )
  }

  return (
    <>
      <Toaster />
      {content}
    </>
  )
}

export default App
