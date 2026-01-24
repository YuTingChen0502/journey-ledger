import { Card } from "@/components/ui/card"
import { Plus, MapPin } from "lucide-react"

interface LandingPageProps {
    onSelectTrip: (tripId: string) => void;
    onCreateTrip: () => void;
}

export function LandingPage({ onSelectTrip, onCreateTrip }: LandingPageProps) {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 gap-12 animate-in fade-in duration-700">
            {/* Hero Section */}
            <div className="text-center space-y-4 max-w-lg">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground/90">
                    Where to next?
                </h1>
                <p className="text-muted-foreground text-lg">
                    Plan your journey with peace of mind.
                </p>
            </div>

            {/* Trip Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                {/* Demo Card 1 - Polaroid Style */}
                <div
                    className="group cursor-pointer relative transition-transform duration-300 hover:-translate-y-1 hover:rotate-1"
                    onClick={() => onSelectTrip('default-trip')}
                >
                    <div className="absolute inset-0 bg-gray-200 translate-y-2 translate-x-2 rounded-sm rotate-1 opacity-50"></div>
                    <Card className="relative border-none shadow-lg bg-white p-3 pb-8 rounded-sm rotate-0 overflow-hidden transform">
                        <div className="h-48 bg-muted rounded-sm overflow-hidden relative grayscale group-hover:grayscale-0 transition-all duration-500">
                            {/* Placeholder for image */}
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-muted-foreground/30">
                                <MapPin className="h-12 w-12" />
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-white text-xs font-medium tracking-widest uppercase">Explore</span>
                            </div>
                        </div>
                        <div className="mt-4 px-2 text-center font-handwriting">
                            <h3 className="text-2xl font-serif text-gray-800">Nagoya 2026</h3>
                            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mt-1 font-sans">
                                <span>Oct 12 - Oct 20</span>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Create New Card - Boarding Pass Stub Style */}
                <div onClick={onCreateTrip} className="group cursor-pointer hover:rotate-1 transition-transform duration-300">
                    <Card className="border-2 border-dashed border-gray-300 bg-transparent shadow-none h-full min-h-[300px] flex flex-col items-center justify-center rounded-lg hover:bg-white/50 transition-colors">
                        <div className="h-16 w-16 rounded-full bg-secondary/10 flex items-center justify-center group-hover:scale-110 transition-transform mb-4">
                            <Plus className="h-8 w-8 text-secondary" />
                        </div>
                        <span className="font-serif text-xl text-gray-600">Start New Journey</span>
                    </Card>
                </div>
            </div>
        </div>
    )
}
