import { storage } from './storage';
import { tba } from './tba';
import { CompetitionProfile } from '../types';

const COMPETITION_PROFILES_KEY = 'competitionProfiles';
const ACTIVE_COMPETITION_PROFILE_ID_KEY = 'activeCompetitionProfileId';

function getProfiles(): CompetitionProfile[] {
  return storage.get<CompetitionProfile[]>(COMPETITION_PROFILES_KEY) || [];
}

function setProfiles(profiles: CompetitionProfile[]) {
  storage.set(COMPETITION_PROFILES_KEY, profiles);
}

export const competition = {
  getProfiles,

  getActiveProfileId(): string | null {
    return storage.get<string>(ACTIVE_COMPETITION_PROFILE_ID_KEY) || null;
  },

  getActiveProfile(): CompetitionProfile | null {
    const activeId = this.getActiveProfileId();
    if (!activeId) return null;
    return getProfiles().find((profile) => profile.id === activeId) || null;
  },

  setActiveProfile(id: string) {
    storage.set(ACTIVE_COMPETITION_PROFILE_ID_KEY, id);
    const profile = getProfiles().find((entry) => entry.id === id);
    if (profile) {
      storage.set('eventKey', profile.eventKey);
      storage.set('tbaTeams', profile.teams);
      storage.set('tbaMatches', profile.matches);
      window.dispatchEvent(new CustomEvent('active-competition-changed', { detail: profile }));
    }
  },

  async createProfile(eventKey: string): Promise<CompetitionProfile> {
    const normalizedEventKey = eventKey.trim().toLowerCase();
    if (!normalizedEventKey) {
      throw new Error('Event key is required');
    }

    const existing = getProfiles().find((profile) => profile.eventKey === normalizedEventKey);
    if (existing) {
      this.setActiveProfile(existing.id);
      return existing;
    }

    const [event, teams, matches] = await Promise.all([
      tba.fetchEvent(normalizedEventKey),
      tba.fetchTeams(normalizedEventKey),
      tba.fetchMatches(normalizedEventKey),
    ]);

    const profile: CompetitionProfile = {
      id: `${normalizedEventKey}-${Date.now()}`,
      eventKey: normalizedEventKey,
      name: event?.name || event?.short_name || normalizedEventKey.toUpperCase(),
      info: [event?.year, event?.event_type_string, event?.city, event?.state_prov || event?.country]
        .filter(Boolean)
        .join(' • ') || 'Competition profile',
      teams,
      matches,
      createdAt: Date.now(),
    };

    const updatedProfiles = [profile, ...getProfiles()];
    setProfiles(updatedProfiles);
    this.setActiveProfile(profile.id);
    window.dispatchEvent(new CustomEvent('competition-profiles-changed'));
    return profile;
  },
};
