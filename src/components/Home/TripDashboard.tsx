import { Card } from "@/components/ui/card"
import { CalendarDays, Map } from "lucide-react"

interface TripDashboardProps {
    onNavigate: (view: 'overview' | 'table' | 'planner') => void;
}

export function TripDashboard({ onNavigate }: TripDashboardProps) {
    return (
        <div className="h-full flex flex-col items-center justify-center p-6 space-y-12 animate-in fade-in duration-500">
            {/* Header */}
            <div className="text-center space-y-4">
                <h1 className="text-5xl md:text-6xl font-serif font-bold text-primary tracking-tight">
                    Nagoya 2026
                </h1>
                <div className="flex items-center justify-center gap-3">
                    <div className="h-px w-12 bg-border"></div>
                    <p className="text-muted-foreground text-lg font-medium uppercase tracking-widest">
                        Jan 31 — Feb 07
                    </p>
                    <div className="h-px w-12 bg-border"></div>
                </div>
            </div>

            {/* Main Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl px-4">

                {/* 1. Overview Section */}
                <Card
                    className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-none bg-white/80 p-8 flex flex-col items-center justify-center gap-6 min-h-[280px]"
                    onClick={() => onNavigate('overview')}
                >
                    <div className="h-20 w-20 rounded-full bg-indigo-50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <CalendarDays className="h-10 w-10 text-indigo-600" />
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-serif font-semibold text-foreground">Overview</h3>
                        <p className="text-sm text-muted-foreground max-w-[200px] leading-relaxed">
                            View your travel journal and itinerary in a read-only format.
                        </p>
                    </div>
                </Card>

                {/* 2. Planning Section */}
                <Card
                    className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-none bg-white/80 p-8 flex flex-col items-center justify-center gap-6 min-h-[280px]"
                    onClick={() => onNavigate('planner')}
                >
                    <div className="h-20 w-20 rounded-full bg-rose-50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <Map className="h-10 w-10 text-rose-600" />
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-serif font-semibold text-foreground">Planning</h3>
                        <p className="text-sm text-muted-foreground max-w-[200px] leading-relaxed">
                            Edit schedule, manage data grid, and organize events.
                        </p>
                    </div>
                </Card>
            </div>

            <p className="text-xs text-muted-foreground/50 absolute bottom-6">
                Single Trip Mode • v1.0
            </p>
        </div>
    )
}
