import { Skeleton } from "@/components/ui/skeleton"

export function LoadingSkeleton({ message }: { message?: string }) {
    return (
        <div className="flex flex-col h-screen w-full bg-background p-4 gap-4 relative">
            {message && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                    <div className="bg-card border border-border px-6 py-4 rounded-lg shadow-lg flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                        <p className="text-sm font-medium text-muted-foreground animate-pulse">{message}</p>
                    </div>
                </div>
            )}
            {/* Header Skeleton */}
            <div className="flex justify-between items-center h-14 border-b pb-4">
                <Skeleton className="h-8 w-32" />
                <div className="flex gap-2">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-20" />
                </div>
            </div>

            {/* Content Skeleton */}
            <div className="flex-1 flex gap-4 overflow-hidden">
                {/* Sidebar Skeleton (Hidden on Mobile usually, but shown here for generic) */}
                <div className="hidden md:flex w-64 flex-col gap-4">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>

                {/* Main Grid Skeleton */}
                <div className="flex-1 flex gap-4 overflow-x-auto">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="min-w-[280px] flex flex-col gap-4">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-32 w-full" />
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-24 w-full" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
