import { useState } from 'react'
import { supabase } from '@/services/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { getPasswordResetRedirectUrl, isValidEmailAddress } from '@/lib/authRecovery'

import { removeRxDatabase } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'

type PendingAction = 'login' | 'signup' | null

export function Auth() {
    const [pending, setPending] = useState<PendingAction>(null)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [forgotOpen, setForgotOpen] = useState(false)
    const [forgotEmail, setForgotEmail] = useState('')
    const [forgotPending, setForgotPending] = useState(false)
    const [forgotError, setForgotError] = useState<string | null>(null)
    const [forgotSuccess, setForgotSuccess] = useState<string | null>(null)

    const busy = pending !== null

    // Clean Room Protocol:
    // Wipes the local database to ensure no Ghost Data persists from previous "guest" sessions
    // or from other users on the same device.
    const cleanRoom = async () => {
        try {
            console.log('Clean Room Protocol Initiated...')
            const storage = getRxStorageDexie()
            await removeRxDatabase('tripdb', storage)
            console.log('Clean Room Complete: Local DB Wiped.')
        } catch (err) {
            console.warn('Clean Room Warning (Safe to ignore if DB was empty):', err)
        }
    }

    const handleLogin = async (e: React.MouseEvent | React.FormEvent) => {
        e.preventDefault()
        if (busy) return // guard against double-submit
        setPending('login')
        try {
            // 1. Authenticate with Supabase first
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) {
                alert(error.message)
            } else {
                // 2. SUCCESS! Wipe the local DB now so the app mounts with a fresh
                // empty DB and replication repopulates only this user's data.
                await cleanRoom()
            }
        } finally {
            setPending(null)
        }
    }

    const handleSignUp = async (e: React.MouseEvent | React.FormEvent) => {
        e.preventDefault()
        if (busy) return // guard against double-submit / repeated signup
        setPending('signup')
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            })

            if (error) {
                alert(error.message)
            } else if (data.user && data.user.identities && data.user.identities.length === 0) {
                // Supabase returns a user with no identities when the email is
                // already registered (to avoid leaking which emails exist).
                alert('This email is already registered. Please log in instead.')
            } else {
                alert('Check your email for the confirmation link!')
            }
        } finally {
            setPending(null)
        }
    }

    const openForgotPassword = () => {
        setForgotEmail(email)
        setForgotError(null)
        setForgotSuccess(null)
        setForgotOpen(true)
    }

    const handleSendResetEmail = async (e: React.FormEvent) => {
        e.preventDefault()
        if (forgotPending) return

        const trimmedEmail = forgotEmail.trim()
        if (!isValidEmailAddress(trimmedEmail)) {
            setForgotError('Enter a valid email address.')
            setForgotSuccess(null)
            return
        }

        setForgotPending(true)
        setForgotError(null)
        setForgotSuccess(null)
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
                redirectTo: getPasswordResetRedirectUrl(window.location.origin),
            })

            if (error) {
                setForgotError(error.message || 'Could not send a reset email. Please try again.')
                return
            }

            setForgotSuccess('Check your email for a password reset link.')
        } catch {
            setForgotError('Could not send a reset email. Check your connection and try again.')
        } finally {
            setForgotPending(false)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <Card className="w-[350px]">
                <CardHeader>
                    <CardTitle>Journey Ledger</CardTitle>
                    <CardDescription>Log in or create an account</CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="grid w-full items-center gap-4">
                        <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                            />
                        </div>
                        <Button
                            type="button"
                            variant="link"
                            className="h-auto justify-start p-0 text-sm"
                            onClick={openForgotPassword}
                            disabled={busy}
                        >
                            Forgot password?
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button type="button" variant="outline" onClick={handleSignUp} disabled={busy}>
                        {pending === 'signup' ? 'Signing up...' : 'Sign Up'}
                    </Button>
                    <Button type="submit" onClick={handleLogin} disabled={busy}>
                        {pending === 'login' ? 'Logging in...' : 'Login'}
                    </Button>
                </CardFooter>
            </Card>
            <Dialog
                open={forgotOpen}
                onOpenChange={(next) => {
                    setForgotOpen(next)
                    if (!next) {
                        setForgotError(null)
                        setForgotSuccess(null)
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Forgot password?</DialogTitle>
                        <DialogDescription>
                            Enter your account email and Journey Ledger will send a password reset link.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSendResetEmail} className="space-y-4" noValidate>
                        <div className="space-y-2">
                            <Label htmlFor="forgot-email">Email</Label>
                            <Input
                                id="forgot-email"
                                type="email"
                                autoComplete="email"
                                placeholder="Email"
                                value={forgotEmail}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setForgotEmail(e.target.value)
                                    if (forgotError) setForgotError(null)
                                }}
                                disabled={forgotPending}
                            />
                            {forgotError && <p className="text-sm text-destructive">{forgotError}</p>}
                            {forgotSuccess && <p className="text-sm text-muted-foreground">{forgotSuccess}</p>}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setForgotOpen(false)} disabled={forgotPending}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={forgotPending || !forgotEmail.trim()}>
                                {forgotPending ? 'Sending...' : 'Send reset link'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
