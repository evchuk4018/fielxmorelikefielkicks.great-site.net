import { showToast } from '../../components/Toast';
import { createProfile, getActiveProfile, getProfileTeams, getProfiles, setActiveProfileId } from '../../lib/competitionProfiles';
import { PRESCOUTING_TEAMS } from '../../prescouting/constants';
import { tba } from '../../lib/tba';
import { TBAEvent, TBATeam } from '../../types';
import { EventTab, Location } from '../types';

type RefreshProfilesParams = {
  setProfiles: (profiles: ReturnType<typeof getProfiles>) => void;
  setActiveProfile: (profile: ReturnType<typeof getActiveProfile>) => void;
};

const HARDCODED_PROFILE_TEAMS: TBATeam[] = PRESCOUTING_TEAMS.map((row) => ({
  key: `frc${row.teamNumber}`,
  team_number: row.teamNumber,
  nickname: `Team ${row.teamNumber}`,
  name: `FRC Team ${row.teamNumber}`,
  city: '',
  state_prov: '',
  country: '',
}));

function getHardcodedProfileTeams(): TBATeam[] {
  return HARDCODED_PROFILE_TEAMS.map((team) => ({ ...team }));
}

export function refreshProfiles(params: RefreshProfilesParams) {
  const { setProfiles, setActiveProfile } = params;
  setProfiles(getProfiles());
  setActiveProfile(getActiveProfile());
}

export function selectProfile(params: {
  profileId: string;
  isAdminSignedIn: boolean;
  setLocation: (location: Location) => void;
  setActiveTab: (tab: EventTab) => void;
} & RefreshProfilesParams) {
  const { profileId, isAdminSignedIn, setLocation, setActiveTab, setProfiles, setActiveProfile } = params;

  if (!isAdminSignedIn) {
    showToast('Only admins can choose the global event');
    return;
  }
  setActiveProfileId(profileId);
  const selectedProfile = getProfiles().find((profile) => profile.id === profileId) || null;
  const selectedProfileTeams = selectedProfile ? getProfileTeams(selectedProfile.id) : [];
  const finalizeSelection = () => {
    refreshProfiles({ setProfiles, setActiveProfile });
    setLocation('event');
    setActiveTab('pit');
  };

  if (selectedProfile && selectedProfileTeams.length === 0) {
    void (async () => {
      try {
        const teams = getHardcodedProfileTeams();
        if (teams.length > 0) {
          await createProfile({
            eventKey: selectedProfile.eventKey,
            eventInfo: null,
            teams,
          });
        }
      } catch {
        // Best-effort backfill for legacy profiles with missing team caches.
      } finally {
        finalizeSelection();
      }
    })();
    return;
  }
  finalizeSelection();
}

export async function createCompetitionProfile(params: {
  isAdminSignedIn: boolean;
  setIsCreatingProfile: (isCreating: boolean) => void;
  setLocation: (location: Location) => void;
  setActiveTab: (tab: EventTab) => void;
} & RefreshProfilesParams) {
  const { isAdminSignedIn, setIsCreatingProfile, setLocation, setActiveTab, setProfiles, setActiveProfile } = params;

  if (!isAdminSignedIn) {
    showToast('Only admins can create competition profiles');
    return;
  }

  const rawEventKey = window.prompt('Enter TBA event key (example: 2026paphi):', '') || '';
  const eventKey = rawEventKey.trim().toLowerCase();
  if (!eventKey) {
    return;
  }

  setIsCreatingProfile(true);
  try {
    const teams = getHardcodedProfileTeams();
    const eventInfo = await tba.fetchEvent(eventKey).catch(() => null as TBAEvent | null);

    await createProfile({ eventKey, eventInfo, teams });
    refreshProfiles({ setProfiles, setActiveProfile });
    setLocation('event');
    setActiveTab('pit');
    showToast(`Saved profile for ${eventInfo?.name || eventKey.toUpperCase()}`);
  } catch {
    showToast('Failed to create profile. Check event key and try again.');
  } finally {
    setIsCreatingProfile(false);
  }
}
