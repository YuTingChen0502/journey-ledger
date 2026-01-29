import { useState } from 'react'
import { supabase } from '@/services/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

import { removeRxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';

export function Auth() {
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    // Clean Room Protocol:
    // Wipes the local database to ensure no Ghost Data persists from previous "guest" sessions
    // or from other users on the same device.
    const cleanRoom = async () => {
        try {
            console.log('🧹 Clean Room Protocol Initiated...');
            // We use the same storage instance or a fresh one. 
            // Since initDB uses a singleton storage, we should try to match it or get a fresh one.
            const storage = getRxStorageDexie();
            await removeRxDatabase('tripdb', storage);
            console.log('✨ Clean Room Complete: Local DB Wiped.');
        } catch (err) {
            console.warn('Clean Room Warning (Safe to ignore if DB was empty):', err);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        // 1. Authenticate with Supabase first
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            alert(error.message)
        } else {
            // 2. SUCCESS! Before the AuthContext sees the session (or before we redirect), 
            // WE NUKE THE LOCAL DB.
            // Note: AuthContext subscription fires almost instantly. 
            // However, wiping NOW ensures that when the App mounts (which happens after session is set),
            // it starts with a fresh empty DB.
            await cleanRoom();
        }
        setLoading(false)
    }

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const { error } = await supabase.auth.signUp({
            email,
            password,
        })

        if (error) {
            alert(error.message)
        } else {
            alert('Check your email for the login link!')
        }
        setLoading(false)
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <Card className="w-[350px]">
                <CardHeader>
                    <CardTitle>Trip Database</CardTitle>
                    <CardDescription>Login or create an account</CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="grid w-full items-center gap-4">
                        <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" placeholder="Email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} />
                        </div>
                        <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="password">Password</Label>
                            <Input id="password" type="password" placeholder="Password" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} />
                        </div>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button variant="outline" onClick={handleSignUp} disabled={loading}>Sign Up</Button>
                    <Button onClick={handleLogin} disabled={loading}>Login</Button>
                </CardFooter>
            </Card>
        </div>
    )
}
