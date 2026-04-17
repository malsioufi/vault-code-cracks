import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-6">
      <button
        onClick={() => navigate('/')}
        className="self-start max-w-md w-full text-muted-foreground font-mono text-sm hover:text-foreground transition-colors mb-4"
      >
        ← {t('backToMenu')}
      </button>

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

        <button
          type="button"
          onClick={() => navigate('/online')}
          className="w-full text-xs text-muted-foreground font-mono hover:text-foreground"
        >
          {t('continueAsGuest')}
        </button>
      </form>
    </div>
  );
};

export default Auth;
