import { useState } from 'react'
import { Button } from './ui/button'
import { TripDashboard } from './Home/TripDashboard'
import { TripTable } from './TripTable'
import { TripViewer } from './TripViewer/TripViewer'
import { TimelineView } from './Timeline/TimelineView'
import { ResponsiveLayout } from './Layout/ResponsiveLayout'
import { ImportModal } from './ImportModal'
import { EventModal } from './EventModal'
import { EventDetailView } from './Timeline/EventDetailView'
import { ErrorBoundary } from './ErrorBoundary'
import { Plus, LogOut, Home, BookOpen, Map, ChevronLeft } from 'lucide-react'
import { parseISO, isValid } from 'date-fns'
import { useAuth } from '@/context/AuthContext'
import { useTranslation } from '@/hooks/useTranslation'
import type { TripDocType } from '@/db/tripSchema'

interface TripWorkspaceProps {
    trip: TripDocType
    onBackToTrips: () => void
    signOut: () => Promise<void>
}

type WorkspaceMode = 'dashboard' | 'overview' | 'planning'
type PlanningView = 'timeline' | 'table'

export function TripWorkspace({ trip, onBackToTrips, signOut }: TripWorkspaceProps) {
    const { session } = useAuth()
    const { t } = useTranslation()

    const [mode, setMode] = useState<WorkspaceMode>('dashboard')
    const [planningView, setPlanningView] = useState<PlanningView>('timeline')

    const [eventModalOpen, setEventModalOpen] = useState(false)
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
    const [detailViewOpen, setDetailViewOpen] = useState(false)

    // Phase 4: the workspace is now fully scoped to the selected trip via
    // `trip.id`. New events / imports default to the trip's first day.
    const tripStart = parseISO(trip.start_date)
    const defaultEventDate = isValid(tripStart) ? tripStart : new Date()

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
                className="flex items-center gap-3 cursor-pointer group"
                onClick={onBackToTrips}
                title={t('nav.all_trips')}
            >
                <div className="relative w-12 h-12 rounded-full overflow-hidden transition-colors shadow-sm bg-[#4a1920]">
                    <img src="/logo.svg" alt={t('nav.all_trips')} className="w-full h-full object-cover opacity-95 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="hidden sm:inline font-serif font-semibold text-primary tracking-tight">Journey Ledger</span>
            </div>

            {/* Back → current trip dashboard (internal to this workspace). */}
            <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground hover:text-foreground ml-1"
                onClick={() => setMode('dashboard')}
            >
                <ChevronLeft className="h-4 w-4" /> {t('nav.back')}
            </Button>

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
                    tripId={trip.id}
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
            <ResponsiveLayout
                topNav={mode !== 'dashboard' ? TopNavigation : null}
                bottomNav={BottomNavigation}
                className={mode === 'dashboard' ? 'bg-transparent shadow-none !my-0 !max-w-none' : ''}
            >
                <div className={`h-full w-full overflow-hidden relative p-0 m-0 ${mode !== 'dashboard' ? 'bg-card' : ''}`}>
                    <ErrorBoundary>
                        {mode === 'dashboard' && <TripDashboard trip={trip} onBack={onBackToTrips} onNavigate={(view) => {
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

                        {mode === 'overview' && <TripViewer trip={trip} onEventClick={handleEventClick} />}

                        {mode === 'planning' && planningView === 'timeline' && <TimelineView trip={trip} onEventClick={handleEventClick} />}
                        {mode === 'planning' && planningView === 'table' && <TripTable tripId={trip.id} onEdit={handleEditEvent} />}
                    </ErrorBoundary>
                </div>
            </ResponsiveLayout>

            <EventModal
                userId={session?.user?.id || 'guest'}
                tripId={trip.id}
                eventId={selectedEventId}
                isOpen={eventModalOpen}
                onOpenChange={setEventModalOpen}
                defaultDate={defaultEventDate}
            />

            <EventDetailView
                eventId={selectedEventId}
                open={detailViewOpen}
                onClose={() => setDetailViewOpen(false)}
            />
        </>
    )
}
