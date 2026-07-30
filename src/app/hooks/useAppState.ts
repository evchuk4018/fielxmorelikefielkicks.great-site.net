import { useCallback, useState } from 'react';
import { CompetitionProfile, UserRole } from '../../types';
import { EventTab, Location, UserProfile } from '../types';

export function useAppState() {
  const [location, setLocation] = useState<Location>('home');
  const [activeTab, setActiveTab] = useState<EventTab>('pit');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [profiles, setProfiles] = useState<CompetitionProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<CompetitionProfile | null>(null);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [signedInUserProfileId, setSignedInUserProfileId] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authRole, setAuthRole] = useState<UserRole>('scout');
  const [authName, setAuthName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPin, setAuthPin] = useState('');
  const [selectedLoginProfileId, setSelectedLoginProfileId] = useState<string>('');

  const resetAuthInputs = useCallback(() => {
    setAuthName('');
    setAuthPassword('');
    setAuthPin('');
  }, []);

  return {
    location,
    setLocation,
    activeTab,
    setActiveTab,
    isSettingsOpen,
    setIsSettingsOpen,
    profiles,
    setProfiles,
    activeProfile,
    setActiveProfile,
    isCreatingProfile,
    setIsCreatingProfile,
    isLoadingProfiles,
    setIsLoadingProfiles,
    userProfiles,
    setUserProfiles,
    signedInUserProfileId,
    setSignedInUserProfileId,
    authMode,
    setAuthMode,
    authRole,
    setAuthRole,
    authName,
    setAuthName,
    authPassword,
    setAuthPassword,
    authPin,
    setAuthPin,
    selectedLoginProfileId,
    setSelectedLoginProfileId,
    resetAuthInputs,
  };
}
