import { Card } from "@/components/ui/card"
import { TableProperties, Map } from "lucide-react"

interface TripDashboardProps {
    onNavigate: (view: 'table' | 'planner') => void;
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

            {/* Navigation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
                {/* Planner Card */}
                <Card
                    className="group cursor-pointer hover:shadow-lg transition-all duration-300 border-none bg-white p-8 flex flex-col items-center justify-center gap-4 min-h-[220px]"
                    onClick={() => onNavigate('planner')}
                >
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <Map className="h-8 w-8 text-primary" />
                    </div>
                    <div className="text-center space-y-1">
                        <h3 className="text-xl font-serif font-semibold text-foreground">Itinerary Planner</h3>
                        <p className="text-sm text-muted-foreground">Drag & Drop Schedule</p>
                    </div>
                </Card>

                {/* Data Grid Card */}
                <Card
                    className="group cursor-pointer hover:shadow-lg transition-all duration-300 border-none bg-white p-8 flex flex-col items-center justify-center gap-4 min-h-[220px]"
                    onClick={() => onNavigate('table')}
                >
                    <div className="h-16 w-16 rounded-full bg-secondary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <TableProperties className="h-8 w-8 text-secondary" />
                    </div>
                    <div className="text-center space-y-1">
                        <h3 className="text-xl font-serif font-semibold text-foreground">Data Grid</h3>
                        <p className="text-sm text-muted-foreground">Spreadsheet View</p>
                    </div>
                </Card>
            </div>

            <p className="text-xs text-muted-foreground/50 absolute bottom-6">
                Single Trip Mode • v1.0
            </p>
        </div>
    )
}
