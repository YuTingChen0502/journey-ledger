import type { ReactNode } from 'react';
// Actually shadcn usually has lib/utils. I'll assume it's there or standard clean string concat.

interface ResponsiveLayoutProps {
    children: ReactNode;
    bottomNav?: ReactNode;
    topNav?: ReactNode;
    className?: string;
}

export function ResponsiveLayout({ children, bottomNav, topNav, className }: ResponsiveLayoutProps) {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center relative font-sans selection:bg-primary/20">
            {/* Texture Overlay (Global) - handled in body CSS usually, but can be here too */}

            {/* PC: Header/TopNav Placement - Centered with content or full width? 
                User said: "Use a clean, sticky Top Navigation Bar. It should be inside the centered container"
            */}

            {/* Main Container - The "Sheet of Paper" */}
            <main className={`
                w-full 
                flex-1 
                flex flex-col 
                relative
                
                /* Mobile: Full width, no margin */
                px-0
                
                /* Tablet (iPad): Max-w-xl, padded */
                md:max-w-xl md:px-0 md:my-8 md:rounded-xl md:shadow-sm md:bg-card
                
                /* PC (Desktop): Max-w-3xl */
                lg:max-w-3xl lg:my-8 lg:rounded-xl lg:shadow-md lg:bg-card

                transition-all duration-300 ease-in-out
                ${className || ''}
            `}>

                {/* Top Nav (Visible on Mobile & Desktop now) */}
                {/* v0.10.4 Fix: Removed 'hidden md:flex' to show header on mobile */}
                <div className="flex sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-white/20 px-4 py-3 md:px-6 md:py-4 md:rounded-t-xl justify-between items-center gap-2 transition-all overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {topNav}
                </div>

                {/* Content Area */}
                {/* We need to ensure children fill the height if needed, or scroll naturally */}
                <div className="flex-1 overflow-hidden rounded-b-xl relative">
                    {children}
                </div>

                {/* Mobile Bottom Nav (Fixed at bottom of SCREEN, not container) */}
                {/* We place it outside the main container for mobile, but 'md' hides it? 
                    User said: "Mobile: Bottom Tab Bar", "PC: Top Navigation Bar".
                    So we hide this on MD+
                */}
            </main>

            {/* Mobile Bottom Nav Container - Fixed to Viewport Bottom */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t border-border pb-safe">
                {bottomNav}
            </div>
        </div>
    );
}
