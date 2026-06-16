import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { RxDatabase } from 'rxdb'
import { initDB } from './db'
import { Auth } from './components/Auth'
import { Toaster } from "@/components/ui/sonner"
import { LoadingSkeleton } from './components/LoadingSkeleton'
import { WorkspaceHome } from './components/Workspaces/WorkspaceHome'
import { TripLibrary } from './components/Trips/TripLibrary'
import { TripWorkspace } from './components/TripWorkspace'
import { ResetPasswordView } from './components/ResetPasswordView'
import { Provider, useRxData } from 'rxdb-hooks'
import type { TripDocType } from './db/tripSchema'
import { SettingsProvider } from './context/SettingsContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PASSWORD_RESET_PATH } from './lib/authRecovery'
import {
  loadSelectedTripId, saveSelectedTripId, clearSelectedTripId,
  loadSelectedWorkspace, saveSelectedWorkspace, clearSelectedWorkspace,
} from './lib/selectedTrip'
import {
  getPersonalWorkspace, isTripInWorkspace, type Workspace,
} from './lib/workspace'

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
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const handleBackToLogin = () => {
    window.history.replaceState(null, '', '/')
    setPathname(window.location.pathname)
  }

  // DB Initialization: Only start when we have a session to ensure replication has context.
  // The singleton in initDB makes this safe to call repeatedly.
  useEffect(() => {
    if (session?.user?.id && pathname !== PASSWORD_RESET_PATH) {
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
  }, [session, pathname]);

  // Splash Screen Logic
  useEffect(() => {
    if (!loading && (db || !session || pathname === PASSWORD_RESET_PATH)) {
      const timer = setTimeout(() => {
        const splash = document.getElementById('splash');
        if (splash) splash.classList.add('hidden');
      }, 500); // 500ms min show time for aesthetic
      return () => clearTimeout(timer);
    }
  }, [loading, db, session, pathname]);

  if (loading) return <LoadingSkeleton message="Authenticating..." />
  if (pathname === PASSWORD_RESET_PATH) {
    return <ResetPasswordView canUpdatePassword={!!session} onBackToLogin={handleBackToLogin} />
  }
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

// App flow: Auth -> WorkspaceHome -> TripLibrary(workspace) -> TripWorkspace(selectedTrip)
function AppContent({ signOut }: { signOut: () => Promise<void> }) {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  // Phase 12A/12B/12C: a workspace is selected before All Trips. We persist the
  // full workspace descriptor (id + name + type) and reconstruct the active
  // workspace synchronously on reload. A Personal id is only restored if it
  // matches the current user (no cross-user leak). A group workspace is
  // reconstructed from the stored descriptor — important because a JOINED group
  // is owner-scoped out of local RxDB and has no local doc to resolve from.
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(() => {
    const stored = loadSelectedWorkspace()
    if (!userId || !stored) return null
    if (stored.type === 'personal') {
      return stored.id === `personal:${userId}` ? getPersonalWorkspace(userId) : null
    }
    return { type: 'group', id: stored.id, name: stored.name }
  })

  // Phase 7: trip selection persisted across reloads — only restored when its
  // workspace selection was also restored above.
  const [selectedTripId, setSelectedTripId] = useState<string | null>(() => {
    const storedWs = loadSelectedWorkspace()
    if (!userId || !storedWs) return null
    if (storedWs.type === 'personal' && storedWs.id !== `personal:${userId}`) return null
    return loadSelectedTripId()
  })

  // Resolve the selected trip object reactively. The hook must run on every
  // render (rules of hooks), so a sentinel id is used when nothing is selected.
  // Deleted trips are excluded so a soft-deleted selection falls back to library.
  const { result: tripDocs, isFetching } = useRxData<TripDocType>('trips', collection =>
    collection.find({
      selector: { id: { $eq: selectedTripId ?? '__none__' }, is_deleted: { $eq: false } }
    })
  )
  const resolvedTrip = selectedTripId ? (tripDocs[0] ?? null) : null
  // Only accept the trip if it belongs to the selected workspace — a persisted
  // trip id from another workspace must not leak into this one.
  const selectedTrip =
    resolvedTrip && selectedWorkspace && isTripInWorkspace(resolvedTrip, selectedWorkspace, userId)
      ? resolvedTrip
      : null

  const handleSelectWorkspace = (workspace: Workspace) => {
    saveSelectedWorkspace(workspace)
    setSelectedWorkspace(workspace)
  }

  const handleBackToWorkspaces = () => {
    clearSelectedWorkspace()
    clearSelectedTripId()
    setSelectedWorkspace(null)
    setSelectedTripId(null)
  }

  const handleSelectTrip = (tripId: string) => {
    saveSelectedTripId(tripId)
    setSelectedTripId(tripId)
  }

  const handleBackToTrips = () => {
    clearSelectedTripId()
    setSelectedTripId(null)
  }

  // Still resolving the persisted/selected trip from the local DB.
  const resolvingTrip = !!selectedTripId && !!selectedWorkspace && isFetching && !selectedTrip

  // Graceful recovery (storage cleanup only — view falls through via derived
  // state; no setState-in-effect, no infinite loading): a persisted trip id that
  // resolves to no in-workspace trip → forget it. (Group workspaces are
  // reconstructed from their stored descriptor, so there is no "group not found"
  // local-resolution failure to recover from here — a revoked membership simply
  // shows an empty/own-only trip list until the user leaves the workspace.)
  useEffect(() => {
    if (selectedTripId && !isFetching && !selectedTrip) {
      clearSelectedTripId()
    }
  }, [selectedTripId, isFetching, selectedTrip])

  let content: ReactNode
  if (!selectedWorkspace) {
    content = (
      <WorkspaceHome userId={userId} onSelectWorkspace={handleSelectWorkspace} signOut={signOut} />
    )
  } else if (selectedTrip) {
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
    content = (
      <TripLibrary
        workspace={selectedWorkspace}
        onSelectTrip={handleSelectTrip}
        onBackToWorkspaces={handleBackToWorkspaces}
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
