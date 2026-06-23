import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useRoom } from '@/hooks/useRoom';
// presence intentionally not surfaced as a banner; opponent disconnects don't interrupt the match
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import DigitInput from '@/components/game/DigitInput';
import GuessHistory from '@/components/game/GuessHistory';
import DigitTracker from '@/components/game/DigitTracker';
import BattleRoyaleLobby from '@/components/game/BattleRoyaleLobby';
import BattleRoyaleBoard from '@/components/game/BattleRoyaleBoard';
import BattleRoyaleResults from '@/components/game/BattleRoyaleResults';
import RelayLobby from '@/components/game/RelayLobby';
import RelaySetting from '@/components/game/RelaySetting';
import RelayBoard from '@/components/game/RelayBoard';
import RelayResults from '@/components/game/RelayResults';
import { GuessEntry } from '@/game/engine';
import { useBottomPanelSpacing } from '@/hooks/useBottomPanelSpacing';
import { DigitMarksProvider } from '@/contexts/DigitMarksContext';
import { sfx } from '@/lib/sfx';

const TURN_TIME = 30;

const Room: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, profile, loading: authLoading } = useAuth();

  const { room, guesses, mySecret, setMySecret, profiles, participants, teams, teamSecrets, rematchInvite, clearRematchInvite, loading, error } = useRoom(code, user?.id);
  const isPlaying = room?.status === 'playing';
  // Opponent presence is tracked server-side but no longer surfaced in the UI.

  const [submitting, setSubmitting] = useState(false);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, number[]>>({});
  const [timer, setTimer] = useState(TURN_TIME);
  const [rematchPending, setRematchPending] = useState(false);

  const isHost = room?.host_id === user?.id;
  const opponentId = room ? (isHost ? room.guest_id : room.host_id) : null;
  const isMyTurn = room?.mode === 'simultaneous' || room?.current_turn === user?.id;
  const gameOver = room?.status === 'finished' || room?.status === 'abandoned';
  const inputActive = Boolean(isPlaying && !gameOver);
  const bottomPanel = useBottomPanelSpacing({ active: inputActive });

  // Server-anchored timer
  useEffect(() => {
    if (!room || !isPlaying || !room.turn_started_at) return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - new Date(room.turn_started_at!).getTime()) / 1000);
      setTimer(Math.max(0, TURN_TIME - elapsed));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [room?.turn_started_at, isPlaying]);

  // (Opponent reconnect countdown removed — game continues normally regardless of connectivity.)

  // Reveal secrets when game ends
  useEffect(() => {
    if (!gameOver || !room) return;
    supabase.functions.invoke('reveal-secrets', { body: { roomId: room.id } }).then(({ data }) => {
      if (data?.secrets) {
        const map: Record<string, number[]> = {};
        for (const s of data.secrets) map[s.player_id] = s.secret;
        setRevealedSecrets(map);
      }
    });
  }, [gameOver, room?.id]);

  const handleSetSecret = useCallback(
    async (digits: number[]) => {
      if (!room || submitting) return;
      setSubmitting(true);
      const { data, error: e } = await supabase.functions.invoke('set-secret', {
        body: { roomId: room.id, secret: digits },
      });
      setSubmitting(false);
      if (e || data?.error) {
        toast.error(data?.error || e?.message || 'Failed');
        return;
      }
      setMySecret(digits);
    },
    [room, submitting, setMySecret],
  );

  const handleGuess = useCallback(
    async (digits: number[]) => {
      if (!room || submitting) return;
      setSubmitting(true);
      const { data, error: e } = await supabase.functions.invoke('submit-guess', {
        body: { roomId: room.id, guess: digits },
      });
      setSubmitting(false);
      if (e || data?.error) {
        toast.error(data?.error || e?.message || 'Failed');
      }
    },
    [room, submitting],
  );

  const handleForfeit = async () => {
    if (!room) return;
    if (!confirm(t('forfeitConfirm'))) return;
    await supabase.functions.invoke('forfeit', { body: { roomId: room.id } });
  };

  const handleRematch = useCallback(async () => {
    if (!room || rematchPending) return;
    setRematchPending(true);
    const { data, error: e } = await supabase.functions.invoke('rematch', {
      body: { previousRoomId: room.id },
    });
    if (e || data?.error) {
      setRematchPending(false);
      toast.error(data?.error || e?.message || 'Rematch failed');
      return;
    }
    if (data?.room?.code) {
      navigate(`/room/${data.room.code}`);
    } else {
      setRematchPending(false);
    }
  }, [room, rematchPending, navigate]);

  const handleAcceptRematch = useCallback(() => {
    if (!rematchInvite) return;
    const code = rematchInvite.newRoomCode;
    clearRematchInvite();
    navigate(`/room/${code}`);
  }, [rematchInvite, clearRematchInvite, navigate]);

  const copyShare = () => {
    if (!room) return;
    const url = `${window.location.origin}/room/${room.code}`;
    navigator.clipboard.writeText(url);
    toast.success(t('copied'));
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-muted-foreground">...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-4">
        <p className="font-mono text-muted-foreground">{t('mustSignIn')}</p>
        <button
          onClick={() => navigate('/online')}
          className="px-4 py-2 rounded bg-primary text-primary-foreground font-mono"
        >
          {t('backToMenu')}
        </button>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-4">
        <p className="font-mono text-destructive">{error || t('roomNotFound')}</p>
        <button
          onClick={() => navigate('/online')}
          className="px-4 py-2 rounded bg-primary text-primary-foreground font-mono"
        >
          {t('backToMenu')}
        </button>
      </div>
    );
  }

  // ===== BATTLE ROYALE =====
  if (room.mode === 'battle_royale') {
    const guessCounts: Record<string, number> = {};
    const guessesByPlayer: Record<string, GuessEntry[]> = {};
    for (const g of guesses) {
      guessCounts[g.player_id] = (guessCounts[g.player_id] || 0) + 1;
      if (!guessesByPlayer[g.player_id]) guessesByPlayer[g.player_id] = [];
      guessesByPlayer[g.player_id].push({
        guess: g.guess,
        feedback: { matches: g.matches, shifts: g.shifts, glitches: g.glitches },
      });
    }
    const me = participants.find((p) => p.user_id === user.id);
    const amIDone = !!(me && (me.cracked || me.gave_up_at || me.finished_at)) || gameOver;
    const myBrGuesses = guessesByPlayer[user.id] ?? [];
    const sharedSecret = Object.values(revealedSecrets)[0];

    if (room.status === 'waiting') {
      return (
        <BattleRoyaleLobby
          roomCode={room.code}
          roomId={room.id}
          isHost={isHost}
          participants={participants}
          profiles={profiles}
          minPlayers={room.min_players ?? 2}
          codeLength={room.code_length}
          allowDuplicates={room.allow_duplicates}
          maxTries={room.max_tries}
          onLeave={() => navigate('/online')}
        />
      );
    }

    if (gameOver) {
      return (
        <div className="min-h-screen overflow-y-auto py-4">
          <BattleRoyaleResults
            winnerId={room.winner_id}
            myId={user.id}
            secret={sharedSecret}
            participants={participants}
            guessesByPlayer={guessesByPlayer}
            profiles={profiles}
            codeLength={room.code_length}
            onBack={() => navigate('/online')}
            onRematch={handleRematch}
            rematchPending={rematchPending}
          />
          {rematchInvite && rematchInvite.newRoomCode !== room.code && (
            <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
              <div className="w-full max-w-md p-4 rounded-lg bg-card cyber-border glow-secondary text-center space-y-3">
                <p className="font-mono text-sm text-secondary text-glow-secondary">
                  🔁 {t('rematchInviteTitle')}
                </p>
                <p className="font-mono text-xs text-muted-foreground">{t('rematchInviteBody')}</p>
                <div className="flex gap-2">
                  <button
                    onClick={clearRematchInvite}
                    className="flex-1 py-2 rounded bg-muted text-muted-foreground font-mono text-xs"
                  >
                    {t('decline')}
                  </button>
                  <button
                    onClick={handleAcceptRematch}
                    className="flex-1 py-2 rounded bg-primary text-primary-foreground font-mono text-xs font-bold glow-primary"
                  >
                    {t('accept')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // playing
    return (
      <div className="h-screen flex flex-col items-center px-4 pt-3 pb-2 overflow-hidden">
        <div className="w-full max-w-md flex items-center justify-between mb-2 shrink-0">
          <button
            onClick={() => navigate('/online')}
            className="text-muted-foreground font-mono text-sm hover:text-foreground transition-colors"
          >
            ←
          </button>
          <div dir="ltr" className="font-mono text-xs text-muted-foreground">
            #{room.code} · {t('battleRoyale')}
          </div>
        </div>
        <BattleRoyaleBoard
          codeLength={room.code_length}
          allowDuplicates={room.allow_duplicates}
          maxTries={room.max_tries}
          myId={user.id}
          myGuesses={myBrGuesses}
          participants={participants}
          guessCounts={guessCounts}
          profiles={profiles}
          onGuess={handleGuess}
          onGiveUp={async () => {
            if (!confirm(t('giveUpConfirm'))) return;
            await supabase.functions.invoke('give-up-br', { body: { roomId: room.id } });
          }}
          submitting={submitting}
          amIDone={amIDone}
        />
      </div>
    );
  }

  // ===== RELAY RACE =====
  if (room.mode === 'relay_race') {
    const me = participants.find((p) => p.user_id === user.id);
    const myTeam = (me?.team as 'A' | 'B' | null) ?? null;
    const minPerTeam = room.min_players ?? 2;

    if (room.status === 'waiting') {
      return (
        <RelayLobby
          roomCode={room.code}
          roomId={room.id}
          isHost={isHost}
          myId={user.id}
          participants={participants}
          profiles={profiles}
          minPlayersPerTeam={minPerTeam}
          codeLength={room.code_length}
          allowDuplicates={room.allow_duplicates}
          maxTries={room.max_tries}
          onLeave={() => navigate('/online')}
        />
      );
    }

    const typedTeams = teams as unknown as import('@/components/game/RelaySetting').TeamRow[];

    if (room.status === 'setting_secrets') {
      const myTeamRow = typedTeams.find((t) => t.team === myTeam);
      const mySetterSecret = myTeamRow?.setter_id ? teamSecrets[myTeamRow.setter_id] ?? null : null;
      return (
        <RelaySetting
          roomId={room.id}
          myId={user.id}
          myTeam={myTeam}
          teams={typedTeams}
          participants={participants}
          profiles={profiles}
          codeLength={room.code_length}
          allowDuplicates={room.allow_duplicates}
          mySecret={mySetterSecret}
        />
      );
    }

    // Build per-team guesses
    const guessesByTeam: Record<'A' | 'B', { guess: number[]; feedback: GuessEntry['feedback']; player_id: string }[]> = { A: [], B: [] };
    for (const g of guesses) {
      const tag = (g as unknown as { team?: 'A' | 'B' }).team;
      if (tag === 'A' || tag === 'B') {
        guessesByTeam[tag].push({
          guess: g.guess,
          feedback: { matches: g.matches, shifts: g.shifts, glitches: g.glitches },
          player_id: g.player_id,
        });
      }
    }

    const teamSecretsByLetter: Record<'A' | 'B', number[] | undefined> = {
      A: typedTeams.find((t) => t.team === 'A')?.setter_id ? teamSecrets[typedTeams.find((t) => t.team === 'A')!.setter_id!] : undefined,
      B: typedTeams.find((t) => t.team === 'B')?.setter_id ? teamSecrets[typedTeams.find((t) => t.team === 'B')!.setter_id!] : undefined,
    };

    if (gameOver) {
      return (
        <div className="min-h-screen overflow-y-auto py-4">
          <RelayResults
            winnerTeam={room.winner_team}
            myTeam={myTeam}
            teams={typedTeams}
            teamSecrets={teamSecretsByLetter}
            guessesByTeam={guessesByTeam}
            participants={participants}
            profiles={profiles}
            codeLength={room.code_length}
            onBack={() => navigate('/online')}
            onRematch={handleRematch}
            rematchPending={rematchPending}
          />
          {rematchInvite && rematchInvite.newRoomCode !== room.code && (
            <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
              <div className="w-full max-w-md p-4 rounded-lg bg-card cyber-border glow-secondary text-center space-y-3">
                <p className="font-mono text-sm text-secondary text-glow-secondary">
                  🔁 {t('rematchInviteTitle')}
                </p>
                <p className="font-mono text-xs text-muted-foreground">{t('rematchInviteBody')}</p>
                <div className="flex gap-2">
                  <button
                    onClick={clearRematchInvite}
                    className="flex-1 py-2 rounded bg-muted text-muted-foreground font-mono text-xs"
                  >
                    {t('decline')}
                  </button>
                  <button
                    onClick={handleAcceptRematch}
                    className="flex-1 py-2 rounded bg-primary text-primary-foreground font-mono text-xs font-bold glow-primary"
                  >
                    {t('accept')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    const myTeamGuesses = myTeam ? guessesByTeam[myTeam] : [];

    return (
      <div className="h-screen flex flex-col items-center px-4 pt-3 pb-2 overflow-hidden">
        <div className="w-full max-w-md flex items-center justify-between mb-2 shrink-0">
          <button
            onClick={() => navigate('/online')}
            className="text-muted-foreground font-mono text-sm hover:text-foreground transition-colors"
          >
            ←
          </button>
          <div dir="ltr" className="font-mono text-xs text-muted-foreground">
            #{room.code} · {t('relayRace')}
          </div>
        </div>
        <RelayBoard
          roomId={room.id}
          codeLength={room.code_length}
          allowDuplicates={room.allow_duplicates}
          maxTries={room.max_tries}
          myId={user.id}
          myTeam={myTeam}
          teams={typedTeams}
          teamTurn={room.team_turn}
          turnDeadline={room.turn_deadline}
          myTeamGuesses={myTeamGuesses}
          participants={participants}
          profiles={profiles}
          onGuess={handleGuess}
          submitting={submitting}
        />
      </div>
    );
  }

  const myGuesses: GuessEntry[] = guesses
    .filter((g) => g.player_id === user.id)
    .map((g) => ({ guess: g.guess, feedback: { matches: g.matches, shifts: g.shifts, glitches: g.glitches } }));

  const oppGuesses: GuessEntry[] = guesses
    .filter((g) => g.player_id === opponentId)
    .map((g) => ({ guess: g.guess, feedback: { matches: g.matches, shifts: g.shifts, glitches: g.glitches } }));

  const triesLeft = room.max_tries !== null ? room.max_tries - myGuesses.length : null;
  const opponentSecret = opponentId ? revealedSecrets[opponentId] : undefined;
  const mySecretRevealed = revealedSecrets[user.id] || mySecret || undefined;

  // ---- WAITING (host alone) ----
  if (room.status === 'waiting') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-6">
        <div className="w-full max-w-md p-6 rounded-lg bg-card cyber-border scanline text-center space-y-4">
          <h2 className="font-mono text-secondary text-glow-secondary uppercase tracking-widest text-sm">
            {t('waitingForOpponent')}
          </h2>
          <div className="py-4">
            <p className="font-mono text-xs text-muted-foreground mb-2">{t('roomCode')}</p>
            <div dir="ltr" className="font-mono text-4xl text-primary text-glow-primary tracking-[0.5em] font-bold">
              {room.code}
            </div>
          </div>
          <button
            onClick={copyShare}
            className="w-full py-2 rounded bg-primary/10 text-primary font-mono text-sm hover:bg-primary/20 transition-colors cyber-border"
          >
            {t('copyLink')}
          </button>
          <p className="font-mono text-xs text-muted-foreground">{t('shareCodeHint')}</p>
          <button
            onClick={() => navigate('/online')}
            className="text-muted-foreground font-mono text-xs hover:text-foreground transition-colors"
          >
            ← {t('cancel')}
          </button>
        </div>
      </div>
    );
  }

  // ---- SETTING SECRETS ----
  if (room.status === 'setting_secrets') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-6">
        <div className="w-full max-w-md p-6 rounded-lg bg-card cyber-border scanline text-center space-y-4">
          <h2 className="font-mono text-secondary text-glow-secondary uppercase tracking-widest text-sm">
            {t('setYourSecret')}
          </h2>
          {mySecret ? (
            <>
              <p className="font-mono text-primary text-glow-primary">✓ {t('vaultLocked')}</p>
              <p className="font-mono text-xs text-muted-foreground animate-pulse">
                {t('waitingOpponentSecret')}
              </p>
            </>
          ) : (
            <>
              <p className="font-mono text-xs text-muted-foreground mb-3">{t('setSecretHint')}</p>
              <DigitInput
                codeLength={room.code_length}
                allowDuplicates={room.allow_duplicates}
                onSubmit={handleSetSecret}
                disabled={submitting}
                submitLabel={t('confirmSecret')}
              />
            </>
          )}
          <button
            onClick={() => navigate('/online')}
            className="text-muted-foreground font-mono text-xs hover:text-foreground transition-colors"
          >
            ← {t('backToMenu')}
          </button>
        </div>
      </div>
    );
  }

  // ---- PLAYING / FINISHED ----
  const timerPercent = (timer / TURN_TIME) * 100;
  const timerColor = timer <= 10 ? 'bg-destructive' : timer <= 20 ? 'bg-warning' : 'bg-primary';

  const myName = profile?.display_name ?? t('you');
  const opponentName = opponentId ? (profiles[opponentId] ?? t('opponentLabel')) : t('opponentLabel');

  return (
    <DigitMarksProvider resetKey={room.code}>
    <div className="h-screen flex flex-col items-center px-4 pt-3 pb-2 overflow-hidden">
      {/* Header */}
      <div className="w-full max-w-md flex items-center justify-between mb-2 shrink-0">
        <button
          onClick={() => navigate('/online')}
          className="text-muted-foreground font-mono text-sm hover:text-foreground transition-colors"
          aria-label={t('backToMenu')}
        >
          ←
        </button>
        <div dir="ltr" className="font-mono text-xs text-muted-foreground">
          #{room.code}
        </div>
      </div>

      {/* Players */}
      <div className="w-full max-w-md flex items-center justify-between mb-2 font-mono text-[11px] shrink-0">
        <span className="text-primary truncate max-w-[45%]">👤 {myName}</span>
        <span className="text-muted-foreground">vs</span>
        <span className="text-secondary truncate max-w-[45%] text-right">{opponentName} 👤</span>
      </div>

      {/* Status / Turn / Timer */}
      {isPlaying && (
        <div className="w-full max-w-md mb-2 shrink-0">
          <div className="flex justify-between items-center mb-1">
            <span className="font-mono text-xs text-muted-foreground">
              {room.mode === 'turn_based'
                ? isMyTurn ? t('yourTurn') : t('opponentTurn')
                : t('simultaneousRound')}
            </span>
            <span className={`font-mono text-sm ${timer <= 10 ? 'text-destructive' : 'text-primary'}`}>
              {timer}s
            </span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${timerColor} transition-all duration-500 ease-linear rounded-full`}
              style={{ width: `${timerPercent}%` }}
            />
          </div>
          {triesLeft !== null && (
            <div className="mt-1 text-end font-mono text-xs text-warning">
              {triesLeft} {t('turnsLeft')}
            </div>
          )}
        </div>
      )}


      {/* Scrollable history area */}
      <div
        ref={bottomPanel.scrollAreaRef}
        className="w-full max-w-md flex-1 min-h-0 overflow-y-auto"
        style={{ paddingBottom: inputActive ? `${bottomPanel.paddingBottom}px` : undefined }}
      >
        {gameOver && (
          <div className="w-full mb-4 p-6 rounded-lg bg-card cyber-border text-center scanline">
            {(() => {
              const iWon = room.winner_id === user.id;
              const isDraw = !room.winner_id && room.status === 'finished';
              const winnerName = room.winner_id
                ? (profiles[room.winner_id] || (room.winner_id === user.id ? myName : opponentName))
                : null;
              const headlineKey = iWon
                ? t('youWin')
                : isDraw
                ? t('drawTitle')
                : room.status === 'abandoned'
                ? t('opponentForfeited')
                : t('opponentWins');
              return (
                <>
                  <h2
                    className={`font-mono text-2xl font-bold mb-1 ${
                      iWon ? 'text-primary text-glow-primary' : isDraw ? 'text-warning' : 'text-destructive'
                    }`}
                  >
                    {headlineKey}
                  </h2>
                  {winnerName && !isDraw && (
                    <p className="font-mono text-sm text-muted-foreground mb-3">
                      🏆 {t('winnerIs')}:{' '}
                      <span className={iWon ? 'text-primary text-glow-primary' : 'text-foreground'}>
                        {winnerName}
                      </span>
                    </p>
                  )}
                </>
              );
            })()}
            {opponentSecret && (
              <>
                <p className="font-mono text-sm text-muted-foreground mb-1">{t('opponentSecret')}</p>
                <div dir="ltr" className="flex gap-2 justify-center mb-4">
                  {opponentSecret.map((d, i) => (
                    <span
                      key={i}
                      className="w-10 h-10 flex items-center justify-center rounded bg-primary text-primary-foreground font-mono text-lg font-bold"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </>
            )}
            <div className="flex flex-col gap-2 items-stretch">
              <button
                onClick={handleRematch}
                disabled={rematchPending}
                className="w-full px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground font-mono text-sm font-bold glow-secondary hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {rematchPending ? t('rematchSent') : `🔁 ${t('rematch')}`}
              </button>
              <button
                onClick={() => navigate('/online')}
                className="w-full px-4 py-2 rounded-lg bg-muted text-muted-foreground font-mono text-sm hover:text-foreground transition-colors"
              >
                {t('backToMenu')}
              </button>
            </div>
          </div>
        )}

        <GuessHistory
          history={myGuesses}
          codeLength={room.code_length}
          secret={opponentSecret}
          gameOver={gameOver}
        />

        {oppGuesses.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <h3 className="font-mono text-xs text-warning uppercase tracking-widest mb-2">
              {opponentName} — {t('opponentGuesses')}
            </h3>
            <GuessHistory
              history={oppGuesses}
              codeLength={room.code_length}
              secret={mySecretRevealed}
              gameOver={gameOver}
            />
          </div>
        )}
      </div>

      {/* Incoming Rematch Invite */}
      {rematchInvite && rematchInvite.newRoomCode !== room.code && (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div className="w-full max-w-md p-4 rounded-lg bg-card cyber-border glow-secondary text-center space-y-3">
            <p className="font-mono text-sm text-secondary text-glow-secondary">
              🔁 {t('rematchInviteTitle')}
            </p>
            <p className="font-mono text-xs text-muted-foreground">{t('rematchInviteBody')}</p>
            <div className="flex gap-2">
              <button
                onClick={clearRematchInvite}
                className="flex-1 py-2 rounded bg-muted text-muted-foreground font-mono text-xs"
              >
                {t('decline')}
              </button>
              <button
                onClick={handleAcceptRematch}
                className="flex-1 py-2 rounded bg-primary text-primary-foreground font-mono text-xs font-bold glow-primary"
              >
                {t('accept')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed bottom input */}
      {isPlaying && !gameOver && (
        <div
          ref={bottomPanel.panelRef}
          className="fixed inset-x-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border px-4 pt-2 pb-3"
          style={{ bottom: `${bottomPanel.bottomOffset}px` }}
        >
          <div className="w-full max-w-md mx-auto space-y-2">
            <DigitTracker history={myGuesses} resetKey={room.code} />
            <DigitInput
              codeLength={room.code_length}
              allowDuplicates={room.allow_duplicates}
              onSubmit={handleGuess}
              disabled={!isMyTurn || submitting}
            />
            <button
              onClick={handleForfeit}
              className="w-full py-1.5 rounded-lg bg-destructive/10 text-destructive font-mono text-xs hover:bg-destructive/20 transition-colors cyber-border"
            >
              {t('forfeit')}
            </button>
          </div>
        </div>
      )}
    </div>
    </DigitMarksProvider>
  );
};

export default Room;
