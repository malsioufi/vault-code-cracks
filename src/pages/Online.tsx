import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';

type Mode = 'turn_based' | 'simultaneous' | 'battle_royale';
type Tab = 'create' | 'join' | 'quick' | 'br';

const Online: React.FC = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { user, profile, loading, signInAsGuest, signOut } = useAuth();

  const [tab, setTab] = useState<Tab>('create');
  const [nickname, setNickname] = useState('');
  const [joinCode, setJoinCode] = useState('');

  // shared room config
  const [codeLength, setCodeLength] = useState(4);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [mode, setMode] = useState<Mode>('turn_based');
  const [maxTries, setMaxTries] = useState<number | null>(10);
  const [minPlayers, setMinPlayers] = useState(2);
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    if (profile?.display_name && !nickname) setNickname(profile.display_name);
  }, [profile]);

  // Quick-match: subscribe to realtime room creation + fallback poll
  useEffect(() => {
    if (!queued || !user) return;
    let cancelled = false;

    const checkRoom = async () => {
      const { data } = await supabase
        .from('rooms')
        .select('code')
        .eq('is_quick_match', true)
        .or(`host_id.eq.${user.id},guest_id.eq.${user.id}`)
        .in('status', ['setting_secrets', 'playing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data?.code) return;
      setQueued(false);
      navigate(`/room/${data.code}`);
    };

    // Realtime: notify the moment the room row appears with us as host or guest
    const channel = supabase
      .channel(`quick-match:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rooms', filter: `guest_id=eq.${user.id}` },
        () => checkRoom(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rooms', filter: `host_id=eq.${user.id}` },
        () => checkRoom(),
      )
      .subscribe();

    // Fallback poll in case realtime is delayed
    const interval = setInterval(checkRoom, 2000);
    // Immediate check (covers race where room was created before subscription)
    checkRoom();

    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [queued, user, navigate]);

  const ensureSession = async (): Promise<boolean> => {
    if (user) return true;
    const name = nickname.trim() || `Breaker_${Math.random().toString(36).slice(2, 6)}`;
    try {
      await signInAsGuest(name);
      return true;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Sign-in failed');
      return false;
    }
  };

  const handleCreate = async () => {
    if (busy) return;
    setBusy(true);
    if (!(await ensureSession())) { setBusy(false); return; }
    const isBR = tab === 'br';
    const { data, error } = await supabase.functions.invoke('create-room', {
      body: {
        codeLength,
        allowDuplicates,
        maxTries: isBR ? (maxTries ?? 12) : maxTries,
        mode: isBR ? 'battle_royale' : mode,
        minPlayers: isBR ? minPlayers : undefined,
      },
    });
    setBusy(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || 'Failed to create room');
      return;
    }
    navigate(`/room/${data.room.code}`);
  };

  const handleJoin = async () => {
    if (busy) return;
    const code = joinCode.toUpperCase().trim();
    if (!/^[A-Z2-9]{6}$/.test(code)) {
      toast.error(t('invalidCode'));
      return;
    }
    setBusy(true);
    if (!(await ensureSession())) { setBusy(false); return; }
    const { data, error } = await supabase.functions.invoke('join-room', {
      body: { code },
    });
    setBusy(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || 'Failed to join');
      return;
    }
    navigate(`/room/${data.room.code}`);
  };

  const handleQuickMatch = async () => {
    if (busy) return;
    setBusy(true);
    if (!(await ensureSession())) { setBusy(false); return; }
    const { data, error } = await supabase.functions.invoke('quick-match', {
      body: { action: 'join', codeLength, allowDuplicates, maxTries, mode },
    });
    setBusy(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || 'Failed to queue');
      return;
    }
    if (data.matched && data.room) {
      navigate(`/room/${data.room.code}`);
    } else {
      setQueued(true);
    }
  };

  const cancelQueue = async () => {
    await supabase.functions.invoke('quick-match', { body: { action: 'leave' } });
    setQueued(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-muted-foreground">...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col items-center px-4 py-2 overflow-hidden">
      <PageHeader
        right={
          user && (
            <button
              onClick={signOut}
              className="font-mono text-[11px] text-muted-foreground hover:text-destructive transition-colors px-1.5"
            >
              {t('signOut')}
            </button>
          )
        }
        center={user ? profile?.display_name : undefined}
      />

      <div className="text-center mb-3 shrink-0">
        <h1 className="text-2xl font-mono font-bold text-primary text-glow-primary">
          {t('onlineMode')}
        </h1>
        <p className="text-muted-foreground font-mono text-[11px]">{t('onlineSubtitle')}</p>
      </div>

      <div className="w-full max-w-md flex-1 min-h-0 overflow-y-auto flex flex-col">
        {!user && (
        <div className="w-full mb-3 p-4 rounded-lg bg-card cyber-border space-y-3">

          <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider block">
            {t('nickname')}
          </label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            placeholder={t('nicknamePlaceholder')}
            className="w-full px-3 py-2 rounded bg-muted text-foreground font-mono text-sm cyber-border outline-none focus:border-primary"
          />
          <button
            onClick={() => navigate('/auth')}
            className="w-full text-xs text-secondary font-mono hover:underline"
          >
            {t('orSignIn')}
          </button>
        </div>
      )}

      {queued ? (
        <div className="w-full max-w-md p-6 rounded-lg bg-card cyber-border scanline text-center space-y-4">
          <div className="font-mono text-secondary text-glow-secondary text-lg animate-pulse">
            {t('searchingOpponent')}
          </div>
          <p className="font-mono text-xs text-muted-foreground">{t('searchingHint')}</p>
          <button
            onClick={cancelQueue}
            className="px-4 py-2 rounded bg-destructive/10 text-destructive font-mono text-sm hover:bg-destructive/20 transition-colors cyber-border"
          >
            {t('cancel')}
          </button>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="w-full max-w-md flex gap-2 mb-4">
            {(['create', 'join', 'quick'] as Tab[]).map((tk) => (
              <button
                key={tk}
                onClick={() => setTab(tk)}
                className={`flex-1 py-2 rounded font-mono text-xs uppercase tracking-wider transition-all ${
                  tab === tk
                    ? 'bg-primary text-primary-foreground glow-primary'
                    : 'bg-card text-muted-foreground cyber-border hover:text-foreground'
                }`}
              >
                {tk === 'create' ? t('createRoom') : tk === 'join' ? t('joinRoom') : t('quickMatch')}
              </button>
            ))}
          </div>

          {tab === 'join' ? (
            <div className="w-full max-w-md p-5 rounded-lg bg-card cyber-border space-y-4">
              <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider block">
                {t('roomCode')}
              </label>
              <input
                dir="ltr"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="ABC234"
                className="w-full px-3 py-3 rounded bg-muted text-center text-foreground font-mono text-2xl tracking-[0.5em] cyber-border outline-none focus:border-primary"
              />
              <button
                onClick={handleJoin}
                disabled={busy}
                className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-mono font-bold glow-primary hover:opacity-90 transition-all disabled:opacity-50"
              >
                {busy ? '...' : t('joinRoom')}
              </button>
            </div>
          ) : (
            <div className="w-full max-w-md p-5 rounded-lg bg-card cyber-border space-y-4">
              {/* Code length */}
              <div>
                <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                  {t('codeLength')}
                </label>
                <div className="flex gap-2 mt-2">
                  {[3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      onClick={() => setCodeLength(n)}
                      className={`flex-1 py-2 rounded font-mono text-sm transition-all ${
                        codeLength === n
                          ? 'bg-primary text-primary-foreground glow-primary'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duplicates */}
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                  {t('allowDuplicates')}
                </label>
                <button
                  onClick={() => setAllowDuplicates(!allowDuplicates)}
                  className={`px-4 py-1.5 rounded font-mono text-xs ${
                    allowDuplicates
                      ? 'bg-primary text-primary-foreground glow-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {allowDuplicates ? t('on') : t('off')}
                </button>
              </div>

              {/* Mode */}
              <div>
                <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                  {t('matchMode')}
                </label>
                <div className="flex gap-2 mt-2">
                  {(['turn_based', 'simultaneous'] as Mode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`flex-1 py-2 rounded font-mono text-xs transition-all ${
                        mode === m
                          ? 'bg-secondary text-secondary-foreground glow-secondary'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {m === 'turn_based' ? t('turnBased') : t('simultaneous')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Max tries */}
              <div>
                <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                  {t('maxTries')}
                </label>
                <div className="flex gap-2 mt-2">
                  {[6, 8, 10, 12].map((n) => (
                    <button
                      key={n}
                      onClick={() => setMaxTries(n)}
                      className={`flex-1 py-2 rounded font-mono text-xs transition-all ${
                        maxTries === n
                          ? 'bg-secondary text-secondary-foreground glow-secondary'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => setMaxTries(null)}
                    className={`flex-1 py-2 rounded font-mono text-xs ${
                      maxTries === null
                        ? 'bg-secondary text-secondary-foreground glow-secondary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    ∞
                  </button>
                </div>
              </div>

              <button
                onClick={tab === 'create' ? handleCreate : handleQuickMatch}
                disabled={busy}
                className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-mono font-bold glow-primary hover:opacity-90 transition-all disabled:opacity-50"
              >
                {busy ? '...' : tab === 'create' ? t('createRoom') : t('findMatch')}
              </button>
            </div>
          )}
        </>
      )}
      </div>
    </div>

  );
};

export default Online;
