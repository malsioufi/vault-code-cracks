import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { lovable } from '@/integrations/lovable/index';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';

const Auth: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        toast.success(t('signedIn'));
      } else {
        await signUp(email, password, displayName.trim() || email.split('@')[0]);
        toast.success(t('accountCreated'));
      }
      navigate('/online');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Auth failed');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });

      if (result.error) {
        toast.error(result.error instanceof Error ? result.error.message : 'Google sign-in failed');
        setBusy(false);
        return;
      }

      if (result.redirected) {
        // Browser will redirect to Google
        return;
      }

      // Session set successfully
      toast.success(t('signedIn'));
      navigate('/online');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error('Enter your email first');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('Recovery link sent. Check your inbox.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Reset request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center px-4 py-2 overflow-hidden">
      <PageHeader />

      <div className="flex-1 min-h-0 w-full max-w-md overflow-y-auto flex items-start justify-center">


      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md p-6 rounded-lg bg-card cyber-border scanline space-y-4"
      >
        <h1 className="font-mono text-xl font-bold text-primary text-glow-primary text-center">
          {mode === 'signin' ? t('signIn') : t('signUp')}
        </h1>

        {mode === 'signup' && (
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t('nickname')}
            maxLength={20}
            className="w-full px-3 py-2 rounded bg-muted text-foreground font-mono text-sm cyber-border outline-none focus:border-primary"
          />
        )}

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          required
          className="w-full px-3 py-2 rounded bg-muted text-foreground font-mono text-sm cyber-border outline-none focus:border-primary"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('password')}
          required
          minLength={6}
          className="w-full px-3 py-2 rounded bg-muted text-foreground font-mono text-sm cyber-border outline-none focus:border-primary"
        />

        <button
          type="submit"
          disabled={busy}
          className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-mono font-bold glow-primary hover:opacity-90 transition-all disabled:opacity-50"
        >
          {busy ? '...' : mode === 'signin' ? t('signIn') : t('createAccount')}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="w-full text-xs text-secondary font-mono hover:underline"
        >
          {mode === 'signin' ? t('noAccount') : t('haveAccount')}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground font-mono">{t('orSignInWith')}</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Google Sign In */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={busy}
          className="w-full py-3 rounded-lg bg-muted text-foreground font-mono font-bold hover:bg-accent transition-all disabled:opacity-50 flex items-center justify-center gap-2 cyber-border"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          {t('signInWithGoogle')}
        </button>

        <button
          type="button"
          onClick={() => navigate('/online')}
          className="w-full text-xs text-muted-foreground font-mono hover:text-foreground"
        >
          {t('continueAsGuest')}
        </button>
      </form>
      </div>
    </div>
  );
};

export default Auth;
