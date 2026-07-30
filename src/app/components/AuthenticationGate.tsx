import React from 'react';
import { UserRole } from '../../types';
import { UserProfile } from '../types';

type AuthenticationGateProps = {
  authMode: 'login' | 'signup';
  setAuthMode: React.Dispatch<React.SetStateAction<'login' | 'signup'>>;
  authRole: UserRole;
  setAuthRole: React.Dispatch<React.SetStateAction<UserRole>>;
  authName: string;
  setAuthName: React.Dispatch<React.SetStateAction<string>>;
  authPassword: string;
  setAuthPassword: React.Dispatch<React.SetStateAction<string>>;
  authPin: string;
  setAuthPin: React.Dispatch<React.SetStateAction<string>>;
  selectedLoginProfileId: string;
  setSelectedLoginProfileId: React.Dispatch<React.SetStateAction<string>>;
  loginProfiles: UserProfile[];
  selectedLoginProfile: UserProfile | null;
  onLoginSubmit: () => Promise<void>;
  onSignupSubmit: () => Promise<void>;
};

export function AuthenticationGate(props: AuthenticationGateProps) {
  const {
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
    loginProfiles,
    selectedLoginProfile,
    onLoginSubmit,
    onSignupSubmit,
  } = props;

  const isAdminLogin = authMode === 'login' && authRole === 'admin';

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-800/50 p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Sign in to Scout</h1>
          <p className="text-sm text-slate-300">
            Scouts use a profile name and password. Admins sign in with the shared PIN.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-700 p-1 bg-slate-900/60">
          <button
            onClick={() => {
              setAuthMode('login');
              setAuthPassword('');
              setAuthPin('');
            }}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              authMode === 'login' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => {
              setAuthMode('signup');
              setAuthPassword('');
              setAuthRole('scout');
              setAuthPin('');
            }}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              authMode === 'signup' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Sign Up
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-700 p-1 bg-slate-900/60">
          <button
            onClick={() => {
              setAuthRole('scout');
            }}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              authRole === 'scout' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Scout
          </button>
          <button
            onClick={() => {
              if (authMode === 'signup') {
                return;
              }
              setAuthRole('admin');
            }}
            disabled={authMode === 'signup'}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              authRole === 'admin' ? 'bg-amber-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            Admin
          </button>
        </div>

        {authMode === 'signup' && (
          <p className="text-xs text-amber-300">
            Admin accounts are seeded and use the shared PIN. Only scout accounts can be created here.
          </p>
        )}

        {authMode === 'login' ? (
          <div className="space-y-3">
            {!isAdminLogin && (
              <label className="block text-sm font-medium text-slate-300">
                Profile
                <select
                  value={selectedLoginProfileId}
                  onChange={(event) => setSelectedLoginProfileId(event.target.value)}
                  className="mt-1 w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none"
                >
                  <option value="">Select profile...</option>
                  {loginProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name} ({profile.authType})
                    </option>
                  ))}
                </select>
              </label>
            )}

            {isAdminLogin ? (
              <label className="block text-sm font-medium text-slate-300">
                Admin PIN
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  value={authPin}
                  onChange={(event) => setAuthPin(event.target.value)}
                  className="mt-1 w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none"
                />
              </label>
            ) : selectedLoginProfile?.authType === 'password' && (
              <label className="block text-sm font-medium text-slate-300">
                Password
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  className="mt-1 w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none"
                />
              </label>
            )}

            <button
              onClick={() => {
                void onLoginSubmit();
              }}
              className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAdminLogin ? 'Sign in as Admin' : 'Login'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-300">
              Name
              <input
                type="text"
                value={authName}
                onChange={(event) => setAuthName(event.target.value)}
                className="mt-1 w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none"
              />
            </label>

            <label className="block text-sm font-medium text-slate-300">
              Password
              <input
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                className="mt-1 w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none"
              />
            </label>

            <button
              onClick={() => {
                void onSignupSubmit();
              }}
              className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Scout Account
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
