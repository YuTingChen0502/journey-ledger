import React from 'react';
import { Button } from './ui/button';
import { removeRxDatabase } from 'rxdb'; // Or generic clear if not available directly

interface ErrorBoundaryProps {
    children: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    handleReset = async () => {
        if (confirm("This will DELETE ALL DATA (Trips, Events) and reload. Are you sure?")) {
            try {
                // Clear LocalStorage
                localStorage.clear();

                // Nuke IndexedDB databases
                const dbs = await window.indexedDB.databases();
                for (const db of dbs) {
                    if (db.name) window.indexedDB.deleteDatabase(db.name);
                }

                window.location.reload();
            } catch (e) {
                console.error("Reset failed", e);
                alert("Reset failed. Please manually clear site data.");
            }
        }
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-screen bg-red-50 p-8 text-center space-y-6">
                    <h1 className="text-4xl font-bold text-red-600">Application Crashed</h1>
                    <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl w-full text-left overflow-auto max-h-96">
                        <p className="font-mono text-sm text-red-500 whitespace-pre-wrap">
                            {this.state.error?.message || "Unknown Error"}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                            {this.state.error?.stack}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-gray-700">
                            The application has encountered a critical error. This is likely due to corrupted data.
                        </p>
                        <Button variant="destructive" size="lg" onClick={this.handleReset}>
                            🗑️ Nuke Data & Reset
                        </Button>
                        <br />
                        <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-2 text-gray-500">
                            Try Reloading (Might crash again)
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
