import React, { useState, useEffect } from 'react';
import { Home } from './tabs/Home';
import { PitScouting } from './tabs/PitScouting';
import { AllianceStrategy } from './tabs/AllianceStrategy';
import { RawData } from './tabs/RawData';
import { EventMatchScouting } from './tabs/EventMatchScouting';
import { SyncIndicator } from './components/SyncIndicator';
import { SettingsModal } from './components/SettingsModal';
import { FaceIdCaptureModal } from './components/FaceIdCaptureModal';
import { ToastProvider, showToast } from './components/Toast';
import { syncManager } from './lib/sync';
import { faceid } from './lib/faceid';
import {
  getProfiles,
  getActiveProfile,
  createProfile,
  setActiveProfileId,
  hydrateProfilesFromSupabase,
} from './lib/competitionProfiles';
import { tba } from './lib/tba';
import { uploadFaceIdSnapshot } from './lib/supabase';
import { CompetitionProfile, TBAEvent } from './types';
import { Settings, ClipboardList, Target, Database, Clipboard } from 'lucide-react';

type Location = 'home' | 'event';
type EventTab = 'pit' | 'match' | 'strategy' | 'raw';
type FaceIdMode = 'train' | 'test';
type UserAuthType = 'password' | 'faceid';

type UserProfile = {
  id: string;
  name: string;
  authType: UserAuthType;
  passwordHash?: string;
  faceIdName?: string;
  createdAt: number;
};

const USER_PROFILES_KEY = 'global:userProfiles';
const ACTIVE_USER_PROFILE_ID_KEY = 'global:activeUserProfileId';
const ADMIN_PIN = 'bazinga';

const STRICT_FACE_ID_POLICY = {
  threshold: 0.27,
  minMargin: 0.06,
  minConfidence: 0.85,
  qualityFloor: 0.35,
  embeddingModel: 'face-api.js@tiny-face-detector-v1',
};

function getStoredUserProfiles(): UserProfile[] {
  try {
    const raw = localStorage.getItem(USER_PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UserProfile[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((profile) => profile && typeof profile.id === 'string' && typeof profile.name === 'string');
  } catch {
    return [];
  }
}

function saveStoredUserProfiles(profiles: UserProfile[]): void {
  localStorage.setItem(USER_PROFILES_KEY, JSON.stringify(profiles));
}

function getStoredActiveUserProfileId(): string | null {
  return localStorage.getItem(ACTIVE_USER_PROFILE_ID_KEY);
}

function setStoredActiveUserProfileId(profileId: string): void {
  localStorage.setItem(ACTIVE_USER_PROFILE_ID_KEY, profileId);
}

function clearStoredActiveUserProfileId(): void {
  localStorage.removeItem(ACTIVE_USER_PROFILE_ID_KEY);
}

async function hashPassword(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export default function App() {
  const [location, setLocation] = useState<Location>('home');
  const [activeTab, setActiveTab] = useState<EventTab>('pit');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [profiles, setProfiles] = useState<CompetitionProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<CompetitionProfile | null>(null);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  const [faceIdMode, setFaceIdMode] = useState<FaceIdMode | null>(null);
  const [isFaceIdBusy, setIsFaceIdBusy] = useState(false);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [signedInUserProfileId, setSignedInUserProfileId] = useState<string | null>(null);
  const [pendingFaceIdAction, setPendingFaceIdAction] = useState<
    | { type: 'create-faceid'; name: string; faceIdName: string }
    | { type: 'load-faceid'; profileId: string; profileName: string; faceIdName: string }
    | null
  >(null);

  useEffect(() => {
    syncManager.start();
    return () => syncManager.stop();
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadProfiles = async () => {
      const cachedProfiles = getProfiles();
      const cachedActiveProfile = getActiveProfile();

      if (!isCancelled) {
        setProfiles(cachedProfiles);
        setActiveProfile(cachedActiveProfile);
      }

      try {
        await hydrateProfilesFromSupabase();
      } catch (error) {
        console.error('Failed to hydrate profiles from Supabase:', error);
      }

      if (isCancelled) {
        return;
      }

      const loadedProfiles = getProfiles();
      const loadedActiveProfile = getActiveProfile();

      setProfiles(loadedProfiles);
      setActiveProfile(loadedActiveProfile);

      if (loadedActiveProfile) {
        // Keep legacy keys in sync so existing tabs and storage-backed flows keep working.
        setActiveProfileId(loadedActiveProfile.id);
      }

      const loadedUserProfiles = getStoredUserProfiles();
      const loadedSignedInUserProfileId = getStoredActiveUserProfileId();
      setUserProfiles(loadedUserProfiles);
      if (loadedSignedInUserProfileId && loadedUserProfiles.some((profile) => profile.id === loadedSignedInUserProfileId)) {
        setSignedInUserProfileId(loadedSignedInUserProfileId);
      } else {
        setSignedInUserProfileId(null);
        clearStoredActiveUserProfileId();
      }

      setIsLoadingProfiles(false);
    };

    void loadProfiles();

    return () => {
      isCancelled = true;
    };
  }, []);

  const refreshProfiles = () => {
    setProfiles(getProfiles());
    setActiveProfile(getActiveProfile());
  };

  const refreshUserProfiles = () => {
    const loaded = getStoredUserProfiles();
    setUserProfiles(loaded);
    if (signedInUserProfileId && !loaded.some((profile) => profile.id === signedInUserProfileId)) {
      setSignedInUserProfileId(null);
      clearStoredActiveUserProfileId();
    }
  };

  const signedInUserProfile = userProfiles.find((profile) => profile.id === signedInUserProfileId) || null;

  const handleSignOutUserProfile = () => {
    setSignedInUserProfileId(null);
    clearStoredActiveUserProfileId();
    showToast('Signed out');
  };

  const handleOpenLoadProfileFlow = async () => {
    if (isFaceIdBusy) {
      return;
    }

    const option = (window.prompt('Load Profile:\n1) New Profile\n2) Load Existing Profile\nEnter 1 or 2:', '') || '').trim();
    if (!option) {
      return;
    }

    if (option === '1') {
      const pin = window.prompt('Enter admin pin to create a profile:', '') || '';
      if (pin.trim() !== ADMIN_PIN) {
        showToast('Invalid admin pin');
        return;
      }

      const name = (window.prompt('Enter profile name:', '') || '').trim();
      if (!name) {
        return;
      }

      const exists = userProfiles.some((profile) => profile.name.toLowerCase() === name.toLowerCase());
      if (exists) {
        showToast('A profile with that name already exists');
        return;
      }

      const authChoice = (window.prompt('Choose auth type:\n1) Password\n2) Face ID\nEnter 1 or 2:', '') || '').trim();
      if (authChoice === '1') {
        const password = window.prompt('Set password for this profile:', '') || '';
        if (!password.trim()) {
          showToast('Password is required');
          return;
        }

        const passwordHash = await hashPassword(password);
        const nextProfile: UserProfile = {
          id: `user-${Date.now()}`,
          name,
          authType: 'password',
          passwordHash,
          createdAt: Date.now(),
        };
        const nextProfiles = [...userProfiles, nextProfile];
        saveStoredUserProfiles(nextProfiles);
        setStoredActiveUserProfileId(nextProfile.id);
        setUserProfiles(nextProfiles);
        setSignedInUserProfileId(nextProfile.id);
        showToast(`Created and signed into ${name}`);
        return;
      }

      if (authChoice === '2') {
        const faceIdName = (window.prompt(
          'Enter the existing enrolled Face ID name to link with this profile:',
          name
        ) || '').trim();
        if (!faceIdName) {
          return;
        }

        setPendingFaceIdAction({ type: 'create-faceid', name, faceIdName });
        setIsSettingsOpen(false);
        setFaceIdMode('test');
        return;
      }

      showToast('Invalid option');
      return;
    }

    if (option === '2') {
      if (userProfiles.length === 0) {
        showToast('No profiles available to load');
        return;
      }

      const optionsText = userProfiles
        .map((profile, index) => `${index + 1}) ${profile.name} (${profile.authType})`)
        .join('\n');
      const selection = (window.prompt(`Select profile:\n${optionsText}\nEnter number:`, '') || '').trim();
      if (!selection) {
        return;
      }

      const selectedIndex = Number.parseInt(selection, 10);
      if (!Number.isInteger(selectedIndex) || selectedIndex < 1 || selectedIndex > userProfiles.length) {
        showToast('Invalid profile selection');
        return;
      }

      const selectedProfile = userProfiles[selectedIndex - 1];
      if (selectedProfile.authType === 'password') {
        const password = window.prompt(`Enter password for ${selectedProfile.name}:`, '') || '';
        const candidateHash = await hashPassword(password);
        if (candidateHash !== selectedProfile.passwordHash) {
          showToast('Incorrect password');
          return;
        }

        setStoredActiveUserProfileId(selectedProfile.id);
        setSignedInUserProfileId(selectedProfile.id);
        showToast(`Signed into ${selectedProfile.name}`);
        return;
      }

      setPendingFaceIdAction({
        type: 'load-faceid',
        profileId: selectedProfile.id,
        profileName: selectedProfile.name,
        faceIdName: selectedProfile.faceIdName || selectedProfile.name,
      });
      setIsSettingsOpen(false);
      setFaceIdMode('test');
      return;
    }

    showToast('Invalid option');
  };

  const handleSelectProfile = (profileId: string) => {
    setActiveProfileId(profileId);
    refreshProfiles();
    setLocation('event');
    setActiveTab('pit');
  };

  const handleGoHome = () => {
    setLocation('home');
  };

  const handleCreateProfile = async () => {
    const rawEventKey = window.prompt('Enter TBA event key (example: 2026paphi):', '') || '';
    const eventKey = rawEventKey.trim().toLowerCase();

    if (!eventKey) {
      return;
    }

    setIsCreatingProfile(true);
    try {
      const [teams, eventInfo] = await Promise.all([
        tba.fetchTeams(eventKey),
        tba.fetchEvent(eventKey).catch(() => null as TBAEvent | null),
      ]);

      await createProfile({ eventKey, eventInfo, teams });
      refreshProfiles();
      setLocation('event');
      setActiveTab('pit');
      showToast(`Saved profile for ${eventInfo?.name || eventKey.toUpperCase()}`);
    } catch {
      showToast('Failed to create profile. Check event key and try again.');
    } finally {
      setIsCreatingProfile(false);
    }
  };

  const renderPage = () => {
    if (isLoadingProfiles) {
      return (
        <div className="max-w-5xl mx-auto rounded-2xl border border-slate-700 bg-slate-800/40 p-8 text-slate-300">
          Loading competition profiles...
        </div>
      );
    }

    if (location === 'home') {
      return (
        <Home
          profiles={profiles}
          activeProfile={activeProfile}
          isCreatingProfile={isCreatingProfile}
          onCreateProfile={handleCreateProfile}
          onSelectProfile={handleSelectProfile}
        />
      );
    }

    switch (activeTab) {
      case 'pit':
        return <PitScouting activeProfile={activeProfile} />;
      case 'match':
        return <EventMatchScouting activeProfile={activeProfile} />;
      case 'strategy':
        return <AllianceStrategy eventKey={activeProfile?.eventKey || ''} profileId={activeProfile?.id || null} />;
      case 'raw':
        return <RawData eventKey={activeProfile?.eventKey || ''} profileId={activeProfile?.id || null} />;
      default:
        return <PitScouting activeProfile={activeProfile} />;
    }
  };

  useEffect(() => {
    if (!activeProfile && location === 'event') {
      setLocation('home');
    }
  }, [activeProfile, location]);

  const handleFaceIdComplete = async (payload: {
    mode: FaceIdMode;
    personName: string;
    embedding: number[];
    acceptedFrames: number;
    qualityScore: number;
    snapshots: Blob[];
  }) => {
    setIsFaceIdBusy(true);
    try {
      if (payload.mode === 'train') {
        const personName = pendingFaceIdAction?.type === 'create-faceid'
          ? pendingFaceIdAction.name
          : payload.personName;
        const scopeKey = activeProfile?.eventKey || 'global';
        const snapshotBlobs = payload.snapshots.slice(0, 5);
        const uploadTasks = snapshotBlobs.map((blob, index) => {
          const file = new File([blob], `faceid-${Date.now()}-${index + 1}.jpg`, { type: 'image/jpeg' });
          return uploadFaceIdSnapshot(scopeKey, personName, file);
        });

        const uploads = await Promise.all(uploadTasks);
        const photoUrls = uploads.map((entry) => entry.publicUrl);

        const enrollment = await faceid.train({
          personName,
          embedding: payload.embedding,
          photoUrls,
          embeddingModel: 'face-api.js@tiny-face-detector-v1',
          acceptedFrames: payload.acceptedFrames,
          qualityScore: payload.qualityScore,
          eventKey: activeProfile?.eventKey || null,
          profileId: activeProfile?.id || null,
        });

        if (pendingFaceIdAction?.type === 'create-faceid') {
          const nextProfile: UserProfile = {
            id: `user-${Date.now()}`,
            name: pendingFaceIdAction.name,
            authType: 'faceid',
            createdAt: Date.now(),
          };
          const nextProfiles = [...userProfiles, nextProfile];
          saveStoredUserProfiles(nextProfiles);
          setStoredActiveUserProfileId(nextProfile.id);
          setUserProfiles(nextProfiles);
          setSignedInUserProfileId(nextProfile.id);
          showToast(`Created and signed into ${nextProfile.name}`);
        } else {
          showToast(`Face ID trained for ${enrollment.personName}`);
        }
      } else {
        const result = await faceid.verify({
          embedding: payload.embedding,
          threshold: STRICT_FACE_ID_POLICY.threshold,
          minMargin: STRICT_FACE_ID_POLICY.minMargin,
          minConfidence: STRICT_FACE_ID_POLICY.minConfidence,
          qualityFloor: STRICT_FACE_ID_POLICY.qualityFloor,
          embeddingModel: STRICT_FACE_ID_POLICY.embeddingModel,
          eventKey: activeProfile?.eventKey || null,
          profileId: activeProfile?.id || null,
        });

        if (pendingFaceIdAction?.type === 'create-faceid') {
          const expectedName = pendingFaceIdAction.faceIdName.toLowerCase();
          const matchedName = (result.name || '').toLowerCase();
          if (result.matched && matchedName === expectedName) {
            const nextProfile: UserProfile = {
              id: `user-${Date.now()}`,
              name: pendingFaceIdAction.name,
              authType: 'faceid',
              faceIdName: pendingFaceIdAction.faceIdName,
              createdAt: Date.now(),
            };
            const nextProfiles = [...userProfiles, nextProfile];
            saveStoredUserProfiles(nextProfiles);
            setStoredActiveUserProfileId(nextProfile.id);
            setUserProfiles(nextProfiles);
            setSignedInUserProfileId(nextProfile.id);
            showToast(`Created and signed into ${nextProfile.name}`);
          } else {
            showToast('Face ID did not match the profile name');
          }
        } else if (pendingFaceIdAction?.type === 'load-faceid') {
          const expectedName = pendingFaceIdAction.faceIdName.toLowerCase();
          const matchedName = (result.name || '').toLowerCase();
          if (result.matched && matchedName === expectedName) {
            setStoredActiveUserProfileId(pendingFaceIdAction.profileId);
            setSignedInUserProfileId(pendingFaceIdAction.profileId);
            showToast(`Signed into ${pendingFaceIdAction.profileName}`);
          } else {
            showToast('Face ID did not match selected profile');
          }
        } else if (result.matched && result.name) {
          showToast(`High-confidence match: ${result.name}`);
        } else if (result.decision === 'borderline') {
          if (result.decisionReason === 'too_close_to_second_best') {
            showToast('Borderline match. Too close to another enrolled face. Run test again with better lighting.');
          } else {
            showToast('Borderline match. Run test again to confirm identity.');
          }
        } else {
          showToast('No strict Face ID match found');
        }
      }
    } finally {
      setIsFaceIdBusy(false);
      setPendingFaceIdAction(null);
      setFaceIdMode(null);
      refreshUserProfiles();
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-blue-500/30">
      <nav className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-inner shadow-white/20">
              <span className="text-white font-bold font-mono text-sm">26</span>
            </div>
            <span className="font-bold text-lg hidden sm:block tracking-tight text-white">REBUILT Scout</span>
          </div>

          {location === 'event' && activeProfile ? (
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setActiveTab('pit')}
                className={`p-2 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'pit'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                <span className="hidden md:block">Pit</span>
              </button>
              <button
                onClick={() => setActiveTab('match')}
                className={`p-2 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'match'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Clipboard className="w-4 h-4" />
                <span className="hidden md:block">Match</span>
              </button>
              <button
                onClick={() => setActiveTab('strategy')}
                className={`p-2 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'strategy'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Target className="w-4 h-4" />
                <span className="hidden md:block">Strategy</span>
              </button>
              <button
                onClick={() => setActiveTab('raw')}
                className={`p-2 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'raw'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Database className="w-4 h-4" />
                <span className="hidden md:block">Raw</span>
              </button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center text-sm text-slate-400">
              <span>Create or select an event folder to start scouting.</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            {activeProfile && (
              <div className="hidden lg:flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs">
                <span className="text-slate-400">Selected:</span>
                <span className="text-white font-mono uppercase">{activeProfile.eventKey}</span>
              </div>
            )}
            <SyncIndicator />
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      <main className="p-4 sm:p-6 lg:p-8">{renderPage()}</main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeProfile={activeProfile}
        onBackToEvents={handleGoHome}
        onOpenLoadProfileFlow={() => {
          void handleOpenLoadProfileFlow();
        }}
        onSignOutUserProfile={handleSignOutUserProfile}
        signedInUserProfile={
          signedInUserProfile
            ? { name: signedInUserProfile.name, authType: signedInUserProfile.authType }
            : null
        }
        isProfileActionBusy={isFaceIdBusy}
      />

      {faceIdMode && (
        <FaceIdCaptureModal
          isOpen={Boolean(faceIdMode)}
          mode={faceIdMode}
          onClose={() => setFaceIdMode(null)}
          onComplete={handleFaceIdComplete}
        />
      )}
      <ToastProvider />
    </div>
  );
}
