import { showToast } from '../../components/Toast';
import { UserRole } from '../../types';
import { UserProfile } from '../types';

export async function loginSubmit(params: {
  authRole: UserRole;
  adminProfile: UserProfile | null;
  authPin: string;
  selectedLoginProfileId: string;
  selectedLoginProfile: UserProfile | null;
  authPassword: string;
  onLoadUserProfile: (params: { profileId: string; password?: string; pin?: string }) => Promise<void>;
}) {
  const {
    authRole,
    adminProfile,
    authPin,
    selectedLoginProfileId,
    selectedLoginProfile,
    authPassword,
    onLoadUserProfile,
  } = params;

  if (authRole === 'admin') {
    if (!adminProfile) {
      showToast('Admin profile is unavailable');
      return;
    }

    await onLoadUserProfile({ profileId: adminProfile.id, pin: authPin });
    return;
  }

  if (!selectedLoginProfileId) {
    showToast('Choose a profile first');
    return;
  }

  if (selectedLoginProfile?.authType === 'faceid') {
    await onLoadUserProfile({ profileId: selectedLoginProfileId });
    return;
  }

  await onLoadUserProfile({ profileId: selectedLoginProfileId, password: authPassword });
}

export async function signupSubmit(params: {
  authRole: UserRole;
  authName: string;
  authPassword: string;
  onCreatePasswordUserProfile: (params: {
    role: UserRole;
    name: string;
    password: string;
  }) => Promise<void>;
}) {
  const {
    authRole,
    authName,
    authPassword,
    onCreatePasswordUserProfile,
  } = params;

  if (authRole === 'admin') {
    showToast('Admin accounts use the shared PIN and cannot be created here');
    return;
  }

  await onCreatePasswordUserProfile({
    role: authRole,
    name: authName,
    password: authPassword,
  });
}
