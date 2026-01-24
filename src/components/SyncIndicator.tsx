import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { initDB } from '@/db';
import type { ReplicationState } from '@/db/replication';

export function SyncIndicator() {
    const [status, setStatus] = useState<'online' | 'offline' | 'syncing'>('online');
    const [replicationState, setReplicationState] = useState<ReplicationState | null>(null);

    useEffect(() => {
        initDB().then((db: any) => {
            if (db.replicationState) {
                setReplicationState(db.replicationState);
            }
        });
    }, []);

    useEffect(() => {
        if (!replicationState) return;

        const subActive = replicationState.active?.subscribe ? replicationState.active.subscribe((active) => {
            setStatus(active ? 'syncing' : 'online');
        }) : null;

        const subError = replicationState.error?.subscribe ? replicationState.error.subscribe(() => {
            setStatus('offline');
        }) : null;

        return () => {
            subActive?.unsubscribe();
            subError?.unsubscribe();
        };
    }, [replicationState]);

    // Also listen to window online/offline
    useEffect(() => {
        const handleOnline = () => setStatus('online');
        const handleOffline = () => setStatus('offline');

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        if (!navigator.onLine) setStatus('offline');

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        }
    }, []);

    if (status === 'syncing') {
        return <Badge variant="outline" className="gap-1 bg-amber-100 text-amber-800 border-amber-200"><RefreshCw className="h-3 w-3 animate-spin" /> Syncing</Badge>;
    }

    if (status === 'offline') {
        return <Badge variant="secondary" className="gap-1 bg-gray-100 text-gray-500"><WifiOff className="h-3 w-3" /> Offline</Badge>;
    }

    return <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 border-green-200"><Wifi className="h-3 w-3" /> Synced</Badge>;
}
