import React from 'react';
import { showToast } from '../../components/Toast';
import { UserRole } from '../../types';
import { MIN_PASSWORD_LENGTH } from '../constants';
import { hashPassword, verifyPassword } from './passwordCrypto';
import { verifyAdminPin } from './pinCrypto';
import {
  clearStoredActiveUserProfileId,
  generateUserProfileId,
  normalizeProfileNameKey,
  saveStoredUserProfiles,
  setStoredActiveUserProfileId,
} from './profileStorage';
import { UserProfile } from '../types';

type ProfileStateSetters = {
  setUserProfiles: React.Dispatch<React.SetStateAction<UserProfile[]>>;
  setSignedInUserProfileId: React.Dispatch<React.SetStateAction<string | null>>;
};

export async function signOutUserProfile(params: {
  resetAuthInputs: () => void;
  setAuthMode: React.Dispatch<React.SetStateAction<'login' | 'signup'>>;
} & Pick<ProfileStateSetters, 'setSignedInUserProfileId'>): Promise<void> {
  const { setSignedInUserProfileId, resetAuthInputs, setAuthMode } = params;
  setSignedInUserProfileId(null);
  await clearStoredActiveUserProfileId();
  resetAuthInputs();
  setAuthMode('login');
  showToast('Signed out');
}

export async function createPasswordUserProfile(params: {
  role: UserRole;
  name: string;
  password: string;
  userProfiles: UserProfile[];
} & Pick<ProfileStateSetters, 'setUserProfiles' | 'setSignedInUserProfileId'> & {
    resetAuthInputs: () => void;
  }): Promise<void> {
  const {
    role,
    name: rawName,
    password,
    userProfiles,
    setUserProfiles,
    setSignedInUserProfileId,
    resetAuthInputs,
  } = params;

  if (role !== 'scout') {
    showToast('Admin accounts use the shared PIN and cannot be created here');
    return;
  }

  const name = rawName.trim();
  if (!name) {
    showToast('Name is required');
    return;
  }

  const normalizedNameKey = normalizeProfileNameKey(name);
  const exists = userProfiles.some((profile) => normalizeProfileNameKey(profile.name) === normalizedNameKey);
  if (exists) {
    showToast('A profile with that name already exists');
    return;
  }

  const trimmedPassword = password.trim();
  if (!trimmedPassword) {
    showToast('Password is required');
    return;
  }
  if (trimmedPassword.length < MIN_PASSWORD_LENGTH) {
    showToast(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    return;
  }

  const { hash, salt } = await hashPassword(trimmedPassword);
  const nextProfile: UserProfile = {
    id: generateUserProfileId(),
    name,
    role: 'scout',
    authType: 'password',
    passwordHash: hash,
    passwordSalt: salt,
    bannedAt: null,
    bannedReason: null,
    bannedByProfileId: null,
    createdAt: Date.now(),
  };

  const nextProfiles = [...userProfiles, nextProfile];
  await saveStoredUserProfiles(nextProfiles);
  await setStoredActiveUserProfileId(nextProfile.id);
  setUserProfiles(nextProfiles);
  setSignedInUserProfileId(nextProfile.id);
  resetAuthInputs();
  showToast(`Created and signed into ${name}`);
}

export async function loadUserProfile(params: {
  profileId: string;
  password?: string;
  pin?: string;
  authRole: UserRole;
  userProfiles: UserProfile[];
} & Pick<ProfileStateSetters, 'setSignedInUserProfileId'> & {
    resetAuthInputs: () => void;
  }): Promise<void> {
  const {
    profileId,
    password,
    pin,
    authRole,
    userProfiles,
    setSignedInUserProfileId,
    resetAuthInputs,
  } = params;

  if (userProfiles.length === 0) {
    showToast('No profiles available to load');
    return;
  }

  const selectedProfile = userProfiles.find((profile) => profile.id === profileId);
  if (!selectedProfile) {
    showToast('Invalid profile selection');
    return;
  }

  if (selectedProfile.role !== authRole) {
    showToast('Selected profile does not match role filter');
    return;
  }

  if (selectedProfile.role === 'scout' && selectedProfile.bannedAt) {
    showToast(selectedProfile.bannedReason || 'This scout profile is banned');
    return;
  }

  if (selectedProfile.role === 'admin') {
    const pinMatches = await verifyAdminPin(selectedProfile, (pin || '').trim());
    if (!pinMatches) {
      showToast('Incorrect admin PIN');
      return;
    }

    await setStoredActiveUserProfileId(selectedProfile.id);
    setSignedInUserProfileId(selectedProfile.id);
    resetAuthInputs();
    showToast(`Signed into ${selectedProfile.name}`);
    return;
  }

  if (selectedProfile.authType === 'password') {
    const passwordMatches = await verifyPassword(selectedProfile, password || '');
    if (!passwordMatches) {
      showToast('Incorrect password');
      return;
    }

    await setStoredActiveUserProfileId(selectedProfile.id);
    setSignedInUserProfileId(selectedProfile.id);
    resetAuthInputs();
    showToast(`Signed into ${selectedProfile.name}`);
    return;
  }

  showToast('Only scout password authentication is available');
}
