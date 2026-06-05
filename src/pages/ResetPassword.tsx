import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery token from the URL hash automatically and
    // emits a PASSWORD_RECOVERY auth event. We trust the session it creates.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
    });
    // If user landed here already authenticated (e.g. clicked link), allow it.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Password updated. Vault secured.');
      navigate('/');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center px-4 py-2 overflow-hidden">
      <PageHeader />
      <div className="flex-1 w-full max-w-md flex items-start justify-center">
        <form
          onSubmit={handleSubmit}
          className="w-full p-6 rounded-lg bg-card cyber-border scanline space-y-4"
        >
          <h1 className="font-mono text-xl font-bold text-primary text-glow-primary text-center">
            Reset Master Key
          </h1>
          <p className="font-mono text-xs text-muted-foreground text-center">
            {ready
              ? 'Set a new passcode for your vault.'
              : 'Verifying recovery link...'}
          </p>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            required
            minLength={6}
            disabled={!ready}
            className="w-full px-3 py-2 rounded bg-muted text-foreground font-mono text-sm cyber-border outline-none focus:border-primary disabled:opacity-50"
          />

          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm password"
            required
            minLength={6}
            disabled={!ready}
            className="w-full px-3 py-2 rounded bg-muted text-foreground font-mono text-sm cyber-border outline-none focus:border-primary disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={!ready || busy}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-mono font-bold glow-primary hover:opacity-90 transition-all disabled:opacity-50"
          >
            {busy ? '...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
