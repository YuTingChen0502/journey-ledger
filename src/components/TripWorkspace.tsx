import { Component, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from './ui/button'
import { TripDashboard } from './Home/TripDashboard'
import { TripTable } from './TripTable'
import { TripViewer } from './TripViewer/TripViewer'
import { TimelineView } from './Timeline/TimelineView'
import { ImportModal } from './ImportModal'
import { EventModal } from './EventModal'
import { EventDetailView } from './Timeline/EventDetailView'
import { Plus, LogOut, Home, BookOpen, Map, ChevronLeft } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTranslation } from '@/hooks/useTranslation'
import type { TripDocType } from '@/db/tripSchema'
import { getWorkspaceTagForTrip } from '@/lib/workspace'
import { getTripAvailabilityIssue } from '@/lib/tripAvailability'
import { safeParseISO } from '@/lib/dateUtils'
import { getWorkspaceContentBranch, normalizeWorkspaceMode } from '@/lib/workspaceViewState'

interface TripWorkspaceProps {
    trip: TripDocType
    onBackToTrips: () => void
    signOut: () => Promise<void>
}

type WorkspaceMode = 'dashboard' | 'overview' | 'planning' | 'home' | 'journal' | 'plan'
type PlanningView = 'timeline' | 'table'

interface WorkspaceContentUnavailableProps {
    rawMode: string
    normalizedMode: string | null
    contentBranch: string
    tripId: string
    tripTitle: string
    onReturnHome?: () => void
}

function WorkspaceContentUnavailable({
    rawMode,
    normalizedMode,
    contentBranch,
    tripId,
    tripTitle,
    onReturnHome,
}: WorkspaceContentUnavailableProps) {
    return (
        <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center gap-4 bg-card p-8 text-center">
            <div className="space-y-2">
                <h1 className="text-2xl font-serif font-semibold text-primary">Workspace content unavailable.</h1>
                <p className="max-w-md text-sm text-muted-foreground">
                    The trip opened, but this workspace view could not be rendered.
                </p>
            </div>
            {import.meta.env.DEV && (
                <div className="rounded-md bg-muted px-4 py-3 text-left text-xs text-muted-foreground">
                    <div>rawMode: {rawMode}</div>
                    <div>normalizedMode: {normalizedMode ?? '(unknown)'}</div>
                    <div>contentBranch: {contentBranch}</div>
                    <div>trip id: {tripId}</div>
                    <div>trip title: {tripTitle}</div>
                </div>
            )}
            {onReturnHome && (
                <Button type="button" onClick={onReturnHome}>
                    Return to trip home
                </Button>
            )}
        </div>
    )
}

interface WorkspaceContentBoundaryProps extends WorkspaceContentUnavailableProps {
    children: ReactNode
}

class WorkspaceContentBoundary extends Component<
    WorkspaceContentBoundaryProps,
    { hasError: boolean }
> {
    constructor(props: WorkspaceContentBoundaryProps) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError() {
        return { hasError: true }
    }

    componentDidCatch(error: Error) {
        console.error('Workspace content failed to render', error)
    }

    render() {
        if (this.state.hasError) {
            return <WorkspaceContentUnavailable {...this.props} />
        }
        return this.props.children
    }
}

export function TripWorkspace({ trip, onBackToTrips, signOut }: TripWorkspaceProps) {
    const { session } = useAuth()
    const { t } = useTranslation()

    const [mode, setMode] = useState<WorkspaceMode>('dashboard')
    const [planningView, setPlanningView] = useState<PlanningView>('timeline')

    const [eventModalOpen, setEventModalOpen] = useState(false)
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
    const [detailViewOpen, setDetailViewOpen] = useState(false)

    const tripAvailabilityIssue = getTripAvailabilityIssue(trip)

    if (tripAvailabilityIssue) {
        return (
            <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
                <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-4 bg-card p-8 text-center">
                    <div className="space-y-2">
                        <h1 className="text-2xl font-serif font-semibold text-primary">Trip not available yet.</h1>
                        <p className="max-w-md text-sm text-muted-foreground">
                            This trip record is missing required workspace data. Return to the trip list and try again after sync finishes.
                        </p>
                    </div>
                    <Button type="button" variant="outline" onClick={onBackToTrips}>
                        Return to trips
                    </Button>
                </div>
            </div>
        )
    }

    // Phase 4: the workspace is now fully scoped to the selected trip via
    // `trip.id`. New events / imports default to the trip's first day.
    const tripStart = safeParseISO(trip.start_date)
    const defaultEventDate = tripStart ?? new Date()
    const eventWorkspaceTag = getWorkspaceTagForTrip(trip)
    const activeMode = normalizeWorkspaceMode(mode)
    const contentBranch = getWorkspaceContentBranch(mode, planningView)

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

    const TopNavigation = (
        <>
            {/* Logo + app title → All Trips (TripLibrary). */}
            <div
                className="flex items-center gap-3 cursor-pointer group shrink-0"
                onClick={onBackToTrips}
                title={t('nav.all_trips')}
            >
                <div className="relative w-12 h-12 rounded-full overflow-hidden transition-colors shadow-sm bg-[#40171A]">
                    <img src="/aurea-mark.png" alt={t('nav.all_trips')} className="w-full h-full object-contain" />
                </div>
                <span className="hidden sm:inline font-serif font-semibold text-primary tracking-tight">Aurea</span>
            </div>

            {/* Back → current trip dashboard (internal to this workspace). */}
            <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground hover:text-foreground ml-1 shrink-0"
                onClick={() => setMode('dashboard')}
            >
                <ChevronLeft className="h-4 w-4" /> {t('nav.back')}
            </Button>

            {activeMode === 'planning' && (
                <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg ml-4 shrink-0">
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

            <div className="flex items-center gap-2 ml-auto shrink-0">
                {activeMode === 'planning' && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 border-dashed"
                        onClick={handleCreateEvent}
                    >
                        <Plus className="w-4 h-4" /> {t('nav.create')}
                    </Button>
                )}

                {activeMode === 'overview' && (
                    <Button variant="ghost" size="sm" onClick={() => setMode('planning')}>
                        {t('nav.edit_itinerary')}
                    </Button>
                )}
                <ImportModal
                    tripId={trip.id}
                    workspaceType={eventWorkspaceTag.workspace_type}
                    workspaceId={eventWorkspaceTag.workspace_id}
                    tripStartDate={trip.start_date}
                    tripEndDate={trip.end_date}
                    defaultDate={defaultEventDate}
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
                className={`flex flex-col h-auto py-1 gap-1 min-w-[60px] rounded-xl transition-colors ${activeMode === 'dashboard' ? 'text-[#923e48]' : 'text-muted-foreground/60 hover:text-[#923e48]/80'}`}
            >
                <Home className="w-6 h-6" strokeWidth={activeMode === 'dashboard' ? 2.5 : 2} />
                <span className="text-[10px] font-medium tracking-wide">{t('nav.home')}</span>
            </Button>

            <Button
                variant="ghost"
                onClick={() => setMode('overview')}
                className={`flex flex-col h-auto py-1 gap-1 min-w-[60px] rounded-xl transition-colors ${activeMode === 'overview' ? 'text-[#923e48]' : 'text-muted-foreground/60 hover:text-[#923e48]/80'}`}
            >
                <BookOpen className="w-6 h-6" strokeWidth={activeMode === 'overview' ? 2.5 : 2} />
                <span className="text-[10px] font-medium tracking-wide">{t('nav.journal')}</span>
            </Button>

            <Button
                variant="ghost"
                onClick={() => setMode('planning')}
                className={`flex flex-col h-auto py-1 gap-1 min-w-[60px] rounded-xl transition-colors ${activeMode === 'planning' ? 'text-[#923e48]' : 'text-muted-foreground/60 hover:text-[#923e48]/80'}`}
            >
                <Map className="w-6 h-6" strokeWidth={activeMode === 'planning' ? 2.5 : 2} />
                <span className="text-[10px] font-medium tracking-wide">{t('nav.plan')}</span>
            </Button>
            <div className="absolute bottom-1 right-2 text-[8px] text-muted-foreground/30 pointer-events-none">v0.12.2</div>
        </div>
    )

    const mainContent: ReactNode =
        contentBranch === 'dashboard' ? (
            <TripDashboard trip={trip} onBack={onBackToTrips} onNavigate={(view) => {
                if (view === 'planner') {
                    setPlanningView('timeline')
                    setMode('planning')
                } else if (view === 'table') {
                    setPlanningView('table')
                    setMode('planning')
                } else {
                    setMode(view)
                }
            }} />
        ) : contentBranch === 'overview' ? (
            <TripViewer trip={trip} onEventClick={handleEventClick} />
        ) : contentBranch === 'planning:timeline' ? (
            <TimelineView trip={trip} onEventClick={handleEventClick} />
        ) : contentBranch === 'planning:table' ? (
            <TripTable tripId={trip.id} onEdit={handleEditEvent} />
        ) : (
            <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center gap-4 bg-card p-8 text-center">
                <h1 className="text-2xl font-serif font-semibold text-primary">Unknown workspace view.</h1>
                <WorkspaceContentUnavailable
                    rawMode={String(mode)}
                    normalizedMode={activeMode}
                    contentBranch={contentBranch}
                    tripId={trip.id}
                    tripTitle={trip.title}
                    onReturnHome={() => setMode('dashboard')}
                />
            </div>
        )

    const shellSectionLabel =
        contentBranch === 'dashboard'
            ? 'Workspace'
            : contentBranch === 'overview'
                ? 'Journal'
                : contentBranch === 'planning:timeline' || contentBranch === 'planning:table'
                    ? 'Planning'
                    : 'Unknown workspace view.'

    return (
        <>
            <section
                data-testid="trip-workspace-ready-heading"
                className="relative z-10 shrink-0 border-b border-border/60 bg-background/95 px-6 py-4"
            >
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    {shellSectionLabel}
                </p>
                <h1 className="mt-1 text-2xl font-serif font-semibold text-primary">
                    {trip.title}
                </h1>
            </section>
            <div className="flex min-h-screen w-full flex-col bg-background text-foreground font-sans selection:bg-primary/20">
                {activeMode !== 'dashboard' && (
                    <header className="sticky top-0 z-50 flex shrink-0 items-center justify-between gap-2 overflow-x-auto border-b border-white/20 bg-card/80 px-4 py-3 backdrop-blur-md transition-all [scrollbar-width:none] md:px-6 md:py-4 [&::-webkit-scrollbar]:hidden">
                        {TopNavigation}
                    </header>
                )}

                <main className={`relative flex-1 min-h-[calc(100vh-4rem)] overflow-auto pb-24 ${activeMode !== 'dashboard' ? 'bg-card' : ''}`}>
                    <WorkspaceContentBoundary
                        rawMode={String(mode)}
                        normalizedMode={activeMode}
                        contentBranch={contentBranch}
                        tripId={trip.id}
                        tripTitle={trip.title}
                        onReturnHome={() => setMode('dashboard')}
                    >
                        {mainContent}
                    </WorkspaceContentBoundary>
                </main>

                <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur pb-safe">
                    {BottomNavigation}
                </nav>
            </div>

            {eventModalOpen && (
                <EventModal
                    userId={session?.user?.id || 'guest'}
                    tripId={trip.id}
                    workspaceType={eventWorkspaceTag.workspace_type}
                    workspaceId={eventWorkspaceTag.workspace_id}
                    eventId={selectedEventId}
                    isOpen={eventModalOpen}
                    onOpenChange={setEventModalOpen}
                    defaultDate={defaultEventDate}
                />
            )}

            {detailViewOpen && selectedEventId && (
                <EventDetailView
                    eventId={selectedEventId}
                    open={detailViewOpen}
                    onClose={() => setDetailViewOpen(false)}
                />
            )}
        </>
    )
}
