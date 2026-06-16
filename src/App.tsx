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
import { Provider, useRxData } from 'rxdb-hooks'
import type { TripDocType } from './db/tripSchema'
import type { GroupDocType } from './db/groupSchema'
import { SettingsProvider } from './context/SettingsContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import {
  loadSelectedTripId, saveSelectedTripId, clearSelectedTripId,
  loadSelectedWorkspaceId, saveSelectedWorkspaceId, clearSelectedWorkspaceId,
} from './lib/selectedTrip'
import {
  getPersonalWorkspace, groupWorkspace, isPersonalWorkspaceId, isTripInWorkspace, type Workspace,
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

// App flow: Auth -> WorkspaceHome -> TripLibrary(workspace) -> TripWorkspace(selectedTrip)
function AppContent({ signOut }: { signOut: () => Promise<void> }) {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  // Phase 12A/12B: a workspace is selected before All Trips. The selected
  // workspace ID is persisted; a Personal id is restored synchronously (only if
  // it matches the current user — no cross-user leak), while a group id is
  // resolved reactively from the groups collection below.
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(() => {
    const stored = loadSelectedWorkspaceId()
    if (!userId || !stored) return null
    if (isPersonalWorkspaceId(stored)) return stored === `personal:${userId}` ? stored : null
    return stored // group id — resolved reactively
  })

  // Phase 7: trip selection persisted across reloads — only restored when its
  // workspace selection was also restored above.
  const [selectedTripId, setSelectedTripId] = useState<string | null>(() => {
    const storedWs = loadSelectedWorkspaceId()
    if (!userId || !storedWs) return null
    if (isPersonalWorkspaceId(storedWs) && storedWs !== `personal:${userId}`) return null
    return loadSelectedTripId()
  })

  const wsIsPersonal = !!selectedWorkspaceId && isPersonalWorkspaceId(selectedWorkspaceId)

  // Resolve a group workspace reactively (we need the group doc for its name).
  const { result: groupDocs, isFetching: groupFetching } = useRxData<GroupDocType>('groups', collection =>
    collection.find({
      selector: {
        id: { $eq: (selectedWorkspaceId && !wsIsPersonal) ? selectedWorkspaceId : '__none__' },
        is_deleted: { $eq: false },
      }
    })
  )
  const groupDoc = (selectedWorkspaceId && !wsIsPersonal) ? (groupDocs[0] ?? null) : null

  // The active workspace object, derived (set by clicks; resolved on reload).
  const selectedWorkspace: Workspace | null =
    !selectedWorkspaceId ? null
      : wsIsPersonal ? getPersonalWorkspace(userId)
        : groupDoc ? groupWorkspace(groupDoc)
          : null
  const resolvingWorkspace = !!selectedWorkspaceId && !wsIsPersonal && !groupDoc && groupFetching

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
    saveSelectedWorkspaceId(workspace.id)
    setSelectedWorkspaceId(workspace.id)
  }

  const handleBackToWorkspaces = () => {
    clearSelectedWorkspaceId()
    clearSelectedTripId()
    setSelectedWorkspaceId(null)
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
  // state; no setState-in-effect, no infinite loading):
  //  - a persisted group workspace id that resolves to no group → forget it.
  //  - a persisted trip id that resolves to no in-workspace trip → forget it.
  useEffect(() => {
    if (selectedWorkspaceId && !wsIsPersonal && !groupFetching && !groupDoc) {
      clearSelectedWorkspaceId()
      clearSelectedTripId()
    }
  }, [selectedWorkspaceId, wsIsPersonal, groupFetching, groupDoc])

  useEffect(() => {
    if (selectedTripId && !isFetching && !selectedTrip) {
      clearSelectedTripId()
    }
  }, [selectedTripId, isFetching, selectedTrip])

  let content: ReactNode
  if (resolvingWorkspace) {
    content = <LoadingSkeleton message="Loading workspace..." />
  } else if (!selectedWorkspace) {
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
