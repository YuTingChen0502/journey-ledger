import { useState } from 'react';
import { supabase } from '@/services/supabase';
import { validateResetPassword } from '@/lib/authRecovery';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ResetPasswordViewProps {
    canUpdatePassword: boolean;
    onBackToLogin: () => void;
}

function friendlyUpdateError(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('expired') || lower.includes('invalid')) {
        return 'This reset link is invalid or expired. Please request a new one.';
    }
    if (lower.includes('weak') || lower.includes('password')) {
        return message;
    }
    return 'Could not update your password. Check your connection and try again.';
}

export function ResetPasswordView({ canUpdatePassword, onBackToLogin }: ResetPasswordViewProps) {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleBackToLogin = async () => {
        if (canUpdatePassword) {
            await supabase.auth.signOut();
        }
        onBackToLogin();
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (isSaving) return;

        const validation = validateResetPassword(password, confirmPassword);
        if (!validation.ok) {
            setError(validation.message);
            return;
        }

        setError(null);
        setIsSaving(true);
        try {
            const { error: updateError } = await supabase.auth.updateUser({ password });
            if (updateError) {
                setError(friendlyUpdateError(updateError.message));
                return;
            }

            // Password recovery creates a temporary authenticated session. Sign
            // it out after updating so the next normal login still runs the
            // existing clean-room local DB flow in Auth.tsx.
            await supabase.auth.signOut();
            setSuccess(true);
            setPassword('');
            setConfirmPassword('');
        } catch {
            setError('Could not update your password. Check your connection and try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const invalidLink = !canUpdatePassword && !success;

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
            <Card className="w-full max-w-[380px]">
                <CardHeader>
                    <CardTitle>Reset password</CardTitle>
                    <CardDescription>Choose a new Aurea password.</CardDescription>
                </CardHeader>
                {success ? (
                    <>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Your password has been updated. Sign in with your new password to continue.
                            </p>
                        </CardContent>
                        <CardFooter>
                            <Button type="button" className="w-full" onClick={handleBackToLogin}>
                                Back to login
                            </Button>
                        </CardFooter>
                    </>
                ) : invalidLink ? (
                    <>
                        <CardContent>
                            <p className="text-sm text-destructive">
                                This reset link is invalid or expired. Please request a new password reset email.
                            </p>
                        </CardContent>
                        <CardFooter>
                            <Button type="button" className="w-full" onClick={handleBackToLogin}>
                                Back to login
                            </Button>
                        </CardFooter>
                    </>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <CardContent className="space-y-4">
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="new-password">New password</Label>
                                <Input
                                    id="new-password"
                                    type="password"
                                    autoComplete="new-password"
                                    value={password}
                                    onChange={(event) => {
                                        setPassword(event.target.value);
                                        if (error) setError(null);
                                    }}
                                    disabled={isSaving}
                                />
                            </div>
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="confirm-password">Confirm password</Label>
                                <Input
                                    id="confirm-password"
                                    type="password"
                                    autoComplete="new-password"
                                    value={confirmPassword}
                                    onChange={(event) => {
                                        setConfirmPassword(event.target.value);
                                        if (error) setError(null);
                                    }}
                                    disabled={isSaving}
                                />
                            </div>
                            {error && <p className="text-sm text-destructive">{error}</p>}
                        </CardContent>
                        <CardFooter className="flex justify-between gap-3">
                            <Button type="button" variant="outline" onClick={handleBackToLogin} disabled={isSaving}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? 'Updating...' : 'Update password'}
                            </Button>
                        </CardFooter>
                    </form>
                )}
            </Card>
        </div>
    );
}
