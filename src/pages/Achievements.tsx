import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAchievements } from '@/hooks/useAchievements';
import { useAchievementsContext } from '@/hooks/useAchievementsContext';
import AchievementsCard from '@/components/game/AchievementsCard';
import PageHeader from '@/components/PageHeader';
import { useLanguage } from '@/i18n/LanguageContext';

const Achievements: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const isGuest = !!profile?.is_guest;
  const { context, loading: ctxLoading } = useAchievementsContext(user?.id, isGuest);
  const { unlockedAt, claim } = useAchievements({
    userId: user?.id,
    isGuest,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-muted-foreground">…</p>
      </div>
    );
  }

  if (!user || isGuest) {
    return (
      <div className="h-screen flex flex-col items-center px-4 overflow-hidden">
        <PageHeader />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <p className="font-mono text-muted-foreground max-w-sm">
            {isGuest ? t('createAccountToTrack') : t('statsRequireAccount')}
          </p>
          <button
            onClick={() => navigate('/auth')}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-mono text-sm glow-primary"
          >
            {isGuest ? t('createAccount') : t('signIn')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col items-center px-4 py-2 overflow-hidden">
      <PageHeader center={profile?.display_name ?? undefined} />
      <div className="w-full max-w-md text-center mb-3 shrink-0">
        <h1 className="font-mono text-2xl font-bold text-primary text-glow-primary">
          🏆 Achievements
        </h1>
        <p className="font-mono text-[11px] text-muted-foreground mt-1">
          Hacking badges earned across the network
        </p>
      </div>
      <div className="w-full max-w-md flex-1 min-h-0 overflow-y-auto pb-4">
        {ctxLoading ? (
          <p className="font-mono text-xs text-muted-foreground text-center py-6">…</p>
        ) : (
          <AchievementsCard unlockedAt={unlockedAt} context={context} />
        )}
      </div>
    </div>
  );
};

export default Achievements;
