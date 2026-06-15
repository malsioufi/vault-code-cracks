import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import PageHeader from '@/components/PageHeader';
import { toast } from '@/hooks/use-toast';
import { LogOut } from 'lucide-react';

const Account: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, loading, signOut } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [loading, user, navigate]);

  useEffect(() => {
    if (profile) setDisplayName(profile.display_name || '');
    if (user) setEmail(user.email || '');
  }, [profile, user]);

  const saveName = async () => {
    const name = displayName.trim();
    if (name.length < 2 || name.length > 24) {
      toast({ title: 'Username must be 2-24 characters', variant: 'destructive' });
      return;
    }
    if (!/^[A-Za-z0-9_\-]+$/.test(name)) {
      toast({ title: 'Only letters, numbers, _ and - allowed', variant: 'destructive' });
      return;
    }
    setSavingName(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name })
      .eq('id', user!.id);
    setSavingName(false);
    if (error) {
      const msg = error.code === '23505' || /unique|duplicate/i.test(error.message)
        ? 'Username already taken'
        : error.message;
      toast({ title: msg, variant: 'destructive' });
      return;
    }
    toast({ title: 'Username updated' });
  };

  const saveEmail = async () => {
    const e = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(e)) {
      toast({ title: 'Invalid email', variant: 'destructive' });
      return;
    }
    if (e === user?.email) return;
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser(
      { email: e },
      { emailRedirectTo: `${window.location.origin}/account` },
    );
    setSavingEmail(false);
    if (error) {
      toast({ title: error.message, variant: 'destructive' });
      return;
    }
    toast({
      title: 'Confirmation email sent',
      description: 'Check both your old and new inboxes to confirm the change.',
    });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }

  const isGuest = profile?.is_guest;

  return (
    <div className="min-h-screen flex flex-col">
      <PageHeader center="ACCOUNT" />
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-4 space-y-6">
        <section className="space-y-2">
          <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Username
          </label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={isGuest}
            maxLength={24}
            className="w-full px-3 py-2 rounded-md bg-card/40 border border-primary/30 font-mono text-sm text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
            placeholder="your_unique_handle"
          />
          <p className="font-mono text-[10px] text-muted-foreground">
            {isGuest
              ? 'Guests cannot set a unique username. Create an account to claim one.'
              : '2-24 chars. Letters, numbers, _ and - only. Must be unique.'}
          </p>
          <button
            onClick={saveName}
            disabled={savingName || isGuest || displayName.trim() === (profile?.display_name || '')}
            className="w-full py-2 rounded-md border-2 border-primary/60 text-primary font-mono text-sm font-bold tracking-wider uppercase hover:bg-primary/10 transition disabled:opacity-40"
          >
            {savingName ? 'Saving...' : 'Save Username'}
          </button>
        </section>

        <section className="space-y-2">
          <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isGuest}
            className="w-full px-3 py-2 rounded-md bg-card/40 border border-secondary/30 font-mono text-sm text-foreground focus:outline-none focus:border-secondary disabled:opacity-50"
            placeholder="you@example.com"
          />
          <p className="font-mono text-[10px] text-muted-foreground">
            {isGuest
              ? 'Guests have no email on file.'
              : 'A confirmation link will be sent to verify the new address.'}
          </p>
          <button
            onClick={saveEmail}
            disabled={savingEmail || isGuest || email.trim() === (user.email || '')}
            className="w-full py-2 rounded-md border-2 border-secondary/60 text-secondary font-mono text-sm font-bold tracking-wider uppercase hover:bg-secondary/10 transition disabled:opacity-40"
          >
            {savingEmail ? 'Saving...' : 'Update Email'}
          </button>
        </section>

        <section className="pt-4 border-t border-primary/10">
          <button
            onClick={handleSignOut}
            className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-md border border-destructive/50 text-destructive font-mono text-sm font-bold tracking-wider uppercase hover:bg-destructive/10 transition"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </section>
      </main>
    </div>
  );
};

export default Account;
