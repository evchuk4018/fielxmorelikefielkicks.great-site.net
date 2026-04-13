import { useEffect } from 'react';
import { CompetitionProfile } from '../../types';
import { EventTab, Location, UserProfile } from '../types';

type UseRouteGuardsParams = {
  activeProfile: CompetitionProfile | null;
  location: Location;
  setLocation: (location: Location) => void;
  signedInUserProfile: UserProfile | null;
  isScoutSignedIn: boolean;
  activeTab: EventTab;
  setActiveTab: (tab: EventTab) => void;
};

export function useRouteGuards(params: UseRouteGuardsParams) {
  const {
    activeProfile,
    location,
    setLocation,
    signedInUserProfile,
    isScoutSignedIn,
    activeTab,
    setActiveTab,
  } = params;

  useEffect(() => {
    if (!activeProfile && location === 'event') {
      setLocation('home');
    }
  }, [activeProfile, location, setLocation]);

  useEffect(() => {
    if (!signedInUserProfile && activeTab === 'admin') {
      setActiveTab('pit');
    }
    if (!signedInUserProfile && activeTab === 'coverage') {
      setActiveTab('pit');
    }
    if (isScoutSignedIn && activeTab === 'admin') {
      setActiveTab('match');
    }
    if (isScoutSignedIn && activeTab === 'coverage') {
      setActiveTab('match');
    }
    if (isScoutSignedIn && activeTab === 'pit') {
      setActiveTab('match');
    }

    if (location === 'prescouting' && activeTab !== 'prescouting-match' && activeTab !== 'prescouting-coverage') {
      setActiveTab('prescouting-match');
    }

    if (location === 'event' && (activeTab === 'prescouting-match' || activeTab === 'prescouting-coverage')) {
      setActiveTab(isScoutSignedIn ? 'match' : 'pit');
    }
  }, [signedInUserProfile, isScoutSignedIn, activeTab, setActiveTab, location]);
}
