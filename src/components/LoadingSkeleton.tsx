import { Skeleton } from "@/components/ui/skeleton"

export function LoadingSkeleton() {
    return (
        <div className="flex flex-col h-screen w-full bg-background p-4 gap-4">
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
