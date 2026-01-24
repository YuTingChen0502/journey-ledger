import { SyncIndicator } from './SyncIndicator';
import { Button } from './ui/button';
import { supabase } from '@/services/supabase';

interface LayoutProps {
    children: React.ReactNode;
    userEmail?: string;
}

export function Layout({ children, userEmail }: LayoutProps) {
    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-14 items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="font-bold text-lg">TripDB</h1>
                        <nav className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
                            <span>Trips</span>
                            <span className="text-foreground">Events</span>
                        </nav>
                    </div>

                    <div className="flex items-center gap-2">
                        <SyncIndicator />
                        <span className="text-sm text-muted-foreground mr-2">{userEmail}</span>
                        <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
                            Sign Out
                        </Button>
                    </div>
                </div>
            </header>
            <main className="flex-1 container py-6">
                {children}
            </main>
        </div>
    );
}
