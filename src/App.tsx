import { useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { RxDatabase } from 'rxdb'
import { initDB } from './db'
import { Auth } from './components/Auth'
import { Toaster } from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"
import { LoadingSkeleton } from './components/LoadingSkeleton'
import { WorkspaceHome } from './components/Workspaces/WorkspaceHome'
import { TripLibrary } from './components/Trips/TripLibrary'
import { TripWorkspace } from './components/TripWorkspace'
import { ResetPasswordView } from './components/ResetPasswordView'
import { Provider, useRxCollection, useRxData } from 'rxdb-hooks'
import type { TripDocType } from './db/tripSchema'
import type { TripEventDocType } from './db/schema'
import { hydrateGroupWorkspaceContent } from './db/groupContentHydration'
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
import { getTripOpenRenderBranch, getTripOpenState, type TripOpenState } from './lib/tripOpenState'

// How long to wait before retrying a failed group-content backfill (Phase 12D.2).
const GROUP_HYDRATION_RETRY_MS = 5000

function debugTripOpen(event: string, payload: Record<string, unknown>) {
  if (import.meta.env.DEV) {
    console.debug('[TripOpen]', { event, ...payload })
  }
}

interface TripOpenFallbackProps {
  title: string
  tripOpenState: TripOpenState | string
  workspace: Workspace
  onBackToTrips: () => void
  onRetry?: () => void
}

function TripOpenFallback({
  title,
  tripOpenState,
  workspace,
  onBackToTrips,
  onRetry,
}: TripOpenFallbackProps) {
  const loading = tripOpenState === 'trip-loading'

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-6 py-10 text-foreground">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          {loading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          ) : (
            <span className="text-lg font-semibold text-primary">!</span>
          )}
        </div>
        <h1 className="text-2xl font-serif font-semibold text-primary">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {loading
            ? `Syncing this ${workspace.type} workspace. The trip will open as soon as it is available locally.`
            : 'This trip may still be syncing, may have been removed, or may no longer belong to this workspace.'}
        </p>
        <p className="mt-4 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          Workspace: {workspace.name}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          {onRetry && (
            <Button type="button" variant="outline" onClick={onRetry}>
              Try syncing again
            </Button>
          )}
          <Button type="button" onClick={onBackToTrips}>
            Return to trips
          </Button>
        </div>
      </div>
    </div>
  )
}

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

  const tripsCollection = useRxCollection<TripDocType>('trips')
  const eventsCollection = useRxCollection<TripEventDocType>('tripevents')
  // Phase 12D.2: group-content backfill. `hydrationNonce` re-arms hydration on
  // reconnect / retry; `firstHydrationDoneId` opens the trip-loading gate after
  // the first attempt (success OR failure) so the UI never hangs.
  const hydrationRunKeyRef = useRef<string | null>(null)
  const [hydrationNonce, setHydrationNonce] = useState(0)
  const [firstHydrationDoneId, setFirstHydrationDoneId] = useState<string | null>(null)

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

  // Re-arm the group backfill when connectivity returns (offline → online).
  useEffect(() => {
    const onOnline = () => setHydrationNonce((n) => n + 1)
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  // Group-content backfill: complements the incremental pull (whose single
  // global checkpoint can be ahead of a group's older rows). Runs on entry,
  // re-runs on reconnect, and retries on failure. Idempotent + last-write-wins
  // (it never clobbers a locally-newer unpushed offline edit).
  useEffect(() => {
    if (selectedWorkspace?.type !== 'group' || !tripsCollection || !eventsCollection) return
    const groupId = selectedWorkspace.id
    const runKey = `${groupId}:${hydrationNonce}`
    if (hydrationRunKeyRef.current === runKey) return
    hydrationRunKeyRef.current = runKey
    debugTripOpen('hydration-start', { workspaceId: groupId, runKey })

    let cancelled = false
    hydrateGroupWorkspaceContent(selectedWorkspace, tripsCollection, eventsCollection)
      .then((result) => {
        debugTripOpen('hydration-finish', {
          workspaceId: groupId,
          runKey,
          trips: result.trips,
          events: result.events,
        })
      })
      .catch((err) => {
        console.warn('Group workspace hydration failed; will retry', err)
        debugTripOpen('hydration-error', { workspaceId: groupId, runKey, error: err })
        if (!cancelled && hydrationRunKeyRef.current === runKey) {
          hydrationRunKeyRef.current = null // allow this nonce to retry
          window.setTimeout(() => setHydrationNonce((n) => n + 1), GROUP_HYDRATION_RETRY_MS)
        }
      })
      .finally(() => {
        // Open the trip-loading gate after the first settle (success or failure)
        // so the UI never hangs; background retries keep converging.
        if (!cancelled) setFirstHydrationDoneId(groupId)
      })

    return () => { cancelled = true }
  }, [selectedWorkspace, tripsCollection, eventsCollection, hydrationNonce])

  const handleSelectWorkspace = (workspace: Workspace) => {
    saveSelectedWorkspace(workspace)
    setSelectedWorkspace(workspace)
    debugTripOpen('select-workspace', {
      workspaceId: workspace.id,
      workspaceType: workspace.type,
    })
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
    debugTripOpen('select-trip', {
      tripId,
      workspaceId: selectedWorkspace?.id ?? null,
      workspaceType: selectedWorkspace?.type ?? null,
    })
  }

  const handleBackToTrips = () => {
    clearSelectedTripId()
    setSelectedTripId(null)
    debugTripOpen('back-to-trips', {
      workspaceId: selectedWorkspace?.id ?? null,
      workspaceType: selectedWorkspace?.type ?? null,
    })
  }

  const handleRetryTripResolution = () => {
    debugTripOpen('retry-trip-resolution', {
      tripId: selectedTripId,
      workspaceId: selectedWorkspace?.id ?? null,
      workspaceType: selectedWorkspace?.type ?? null,
    })
    setHydrationNonce((n) => n + 1)
  }

  // Still resolving the persisted/selected trip from the local DB.
  const groupHydrationPending =
    selectedWorkspace?.type === 'group' && firstHydrationDoneId !== selectedWorkspace.id
  const tripOpenState = getTripOpenState({
    selectedWorkspaceId: selectedWorkspace?.id ?? null,
    selectedTripId,
    hasSelectedTrip: !!selectedTrip,
    isFetching,
    groupHydrationPending,
  })
  const tripOpenRenderBranch = getTripOpenRenderBranch(selectedTripId, tripOpenState)

  // Graceful recovery (storage cleanup only — view falls through via derived
  // state; no setState-in-effect, no infinite loading): a persisted trip id that
  // resolves to no in-workspace trip → forget it. (Group workspaces are
  // reconstructed from their stored descriptor, so there is no "group not found"
  // local-resolution failure to recover from here — a revoked membership simply
  // shows an empty/own-only trip list until the user leaves the workspace.)
  useEffect(() => {
    if (tripOpenState === 'trip-unavailable') {
      clearSelectedTripId()
    }
  }, [tripOpenState])

  useEffect(() => {
    debugTripOpen('state', {
      workspaceId: selectedWorkspace?.id ?? null,
      workspaceType: selectedWorkspace?.type ?? null,
      selectedTripId,
      resolvedTripId: resolvedTrip?.id ?? null,
      tripFound: !!selectedTrip,
      isFetching,
      groupHydrationPending,
      firstHydrationDoneId,
      hydrationNonce,
      tripOpenState,
      tripOpenRenderBranch,
    })
  }, [
    selectedWorkspace?.id,
    selectedWorkspace?.type,
    selectedTripId,
    resolvedTrip?.id,
    selectedTrip,
    isFetching,
    groupHydrationPending,
    firstHydrationDoneId,
    hydrationNonce,
    tripOpenState,
    tripOpenRenderBranch,
  ])

  let content: ReactNode
  if (!selectedWorkspace) {
    content = (
      <WorkspaceHome userId={userId} onSelectWorkspace={handleSelectWorkspace} signOut={signOut} />
    )
  } else if (tripOpenRenderBranch === 'trip-ready' && selectedTrip) {
    content = (
      <TripWorkspace
        key={selectedTrip.id}
        trip={selectedTrip}
        onBackToTrips={handleBackToTrips}
        signOut={signOut}
      />
    )
  } else if (tripOpenRenderBranch === 'trip-loading' && selectedTripId) {
    content = (
      <TripOpenFallback
        title="Loading trip..."
        tripOpenState={tripOpenState}
        workspace={selectedWorkspace}
        onBackToTrips={handleBackToTrips}
        onRetry={selectedWorkspace.type === 'group' ? handleRetryTripResolution : undefined}
      />
    )
  } else if (tripOpenRenderBranch === 'trip-unavailable' && selectedTripId) {
    content = (
      <TripOpenFallback
        title="Trip not available yet."
        tripOpenState={tripOpenState}
        workspace={selectedWorkspace}
        onBackToTrips={handleBackToTrips}
        onRetry={selectedWorkspace.type === 'group' ? handleRetryTripResolution : undefined}
      />
    )
  } else if (tripOpenRenderBranch === 'trip-unknown' && selectedTripId) {
    content = (
      <TripOpenFallback
        title="Unknown trip open state."
        tripOpenState={tripOpenState}
        workspace={selectedWorkspace}
        onBackToTrips={handleBackToTrips}
        onRetry={selectedWorkspace.type === 'group' ? handleRetryTripResolution : undefined}
      />
    )
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
