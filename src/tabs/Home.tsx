import React, { useEffect, useMemo, useState } from 'react';
import { competition } from '../lib/competition';
import { CompetitionProfile } from '../types';
import { showToast } from '../components/Toast';
import { Plus } from 'lucide-react';

interface HomeProps {
  onOpenPit: () => void;
}

export function Home({ onOpenPit }: HomeProps) {
  const [profiles, setProfiles] = useState<CompetitionProfile[]>(competition.getProfiles());
  const [activeProfileId, setActiveProfileId] = useState<string | null>(competition.getActiveProfileId());
  const [isCreating, setIsCreating] = useState(false);

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId) || null,
    [profiles, activeProfileId]
  );

  useEffect(() => {
    const refresh = () => {
      setProfiles(competition.getProfiles());
      setActiveProfileId(competition.getActiveProfileId());
    };
    window.addEventListener('competition-profiles-changed', refresh);
    window.addEventListener('active-competition-changed', refresh);
    return () => {
      window.removeEventListener('competition-profiles-changed', refresh);
      window.removeEventListener('active-competition-changed', refresh);
    };
  }, []);

  const handleCreateProfile = async () => {
    const input = window.prompt('Enter TBA event key (example: 2026paphi)');
    if (!input) return;
    setIsCreating(true);
    try {
      const profile = await competition.createProfile(input);
      setProfiles(competition.getProfiles());
      setActiveProfileId(profile.id);
      showToast(`Saved profile ${profile.eventKey.toUpperCase()} with ${profile.teams.length} teams`);
    } catch (error) {
      showToast('Failed to create competition profile');
    } finally {
      setIsCreating(false);
    }
  };

  const handleActivate = (profileId: string) => {
    competition.setActiveProfile(profileId);
    setActiveProfileId(profileId);
    showToast('Active competition updated');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 px-4">
      <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Competition Profiles</h2>
            <p className="text-slate-400 mt-1">
              Save event profiles and set the active context for scouting, stats, and review.
            </p>
          </div>
          <button
            onClick={handleCreateProfile}
            disabled={isCreating}
            className="inline-flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            {isCreating ? 'Creating...' : 'Add Profile'}
          </button>
        </div>
      </div>

      {profiles.length === 0 ? (
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl text-slate-300">
          No saved competition profiles yet. Use the + button to add one from a TBA event key.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {profiles.map((profile) => {
            const isActive = profile.id === activeProfileId;
            return (
              <div
                key={profile.id}
                className={`p-5 rounded-2xl border shadow-xl ${
                  isActive ? 'bg-blue-900/20 border-blue-500/60' : 'bg-slate-800/50 border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{profile.name}</h3>
                    <p className="font-mono text-sm text-blue-300">{profile.eventKey.toUpperCase()}</p>
                    <p className="text-sm text-slate-400 mt-1">{profile.info}</p>
                  </div>
                  {isActive && <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300">Active</span>}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-300">
                  <span>Teams: {profile.teams.length}</span>
                  <span>Matches: {profile.matches.length}</span>
                </div>
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => handleActivate(profile.id)}
                    className="px-3 py-2 bg-slate-900 hover:bg-slate-700 border border-slate-600 text-white rounded-xl text-sm transition-colors"
                  >
                    Set Active
                  </button>
                  <button
                    onClick={onOpenPit}
                    className="px-3 py-2 bg-emerald-700/70 hover:bg-emerald-600 text-white rounded-xl text-sm transition-colors"
                  >
                    Open Pit Scouting
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeProfile && (
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <h3 className="text-lg font-semibold text-white">Active Competition Context</h3>
          <p className="text-slate-300 mt-2">
            {activeProfile.name} ({activeProfile.eventKey.toUpperCase()})
          </p>
          <p className="text-slate-400 text-sm mt-1">
            Team and match data for this event are loaded and available throughout the app.
          </p>
        </div>
      )}
    </div>
  );
}
