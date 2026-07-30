import React, { useState, useEffect } from 'react';
import { CompetitionProfile } from '../types';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useFieldMap } from '../app/context/FieldMapContext';
import { PitQuestionEditor } from './PitQuestionEditor';
import { showToast } from './Toast';
import { PRESCOUTING_SEASON_YEAR } from '../prescouting/constants';
import {
  parsePrescoutingTeamNumbersInput,
  PRESCOUTING_TEAM_LIST_UPDATED_EVENT,
  savePrescoutingTeamNumbers,
} from '../prescouting/teamSettingsRepository';
import { usePrescoutingTeamNumbers } from '../prescouting/hooks/usePrescoutingTeamNumbers';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProfile: CompetitionProfile | null;
  isAdminSignedIn: boolean;
  onBackToEvents: () => void;
  onSignOutUserProfile: () => void;
  signedInUserProfile: { name: string; authType: 'password' | 'faceid' | 'pin' } | null;
  isProfileActionBusy?: boolean;
}

export function SettingsModal({
  isOpen,
  onClose,
  activeProfile,
  isAdminSignedIn,
  onBackToEvents,
  onSignOutUserProfile,
  signedInUserProfile,
}: SettingsModalProps) {
  const [activeEventKey, setActiveEventKey] = useState('');
  const [selectedMapFile, setSelectedMapFile] = useState<File | null>(null);
  const [prescoutingTeamInput, setPrescoutingTeamInput] = useState('');
  const [prescoutingSaveError, setPrescoutingSaveError] = useState<string | null>(null);
  const [isPrescoutingSaving, setIsPrescoutingSaving] = useState(false);
  const { imageSrc, isLoading: isFieldMapLoading, isUploading, error: fieldMapError, uploadImage } = useFieldMap();
  const {
    teamNumbers: prescoutingTeamNumbers,
    isLoading: isPrescoutingTeamsLoading,
    error: prescoutingTeamsError,
    reload: reloadPrescoutingTeams,
  } = usePrescoutingTeamNumbers({
    seasonYear: PRESCOUTING_SEASON_YEAR,
    enabled: isOpen && isAdminSignedIn,
  });

  useEffect(() => {
    if (isOpen) {
      setActiveEventKey(activeProfile?.eventKey || 'No active profile');
      setSelectedMapFile(null);
      setPrescoutingSaveError(null);
    }
  }, [activeProfile?.eventKey, isOpen]);

  useEffect(() => {
    if (isOpen && !isPrescoutingTeamsLoading && !isPrescoutingSaving) {
      setPrescoutingTeamInput(prescoutingTeamNumbers.join('\n'));
    }
  }, [isOpen, isPrescoutingSaving, isPrescoutingTeamsLoading, prescoutingTeamNumbers]);

  const handleMapUpload = async () => {
    if (!selectedMapFile) {
      return;
    }

    const uploaded = await uploadImage(selectedMapFile);
    if (uploaded) {
      setSelectedMapFile(null);
    }
  };

  const handlePrescoutingSave = async () => {
    const parsed = parsePrescoutingTeamNumbersInput(prescoutingTeamInput);
    if (parsed.invalidTokens.length > 0) {
      setPrescoutingSaveError(`Invalid team number(s): ${parsed.invalidTokens.join(', ')}`);
      return;
    }

    setIsPrescoutingSaving(true);
    setPrescoutingSaveError(null);
    try {
      const saved = await savePrescoutingTeamNumbers({
        seasonYear: PRESCOUTING_SEASON_YEAR,
        teamNumbers: parsed.teamNumbers,
        isAdmin: isAdminSignedIn,
      });
      setPrescoutingTeamInput(saved.teamNumbers.join('\n'));
      showToast(`Saved ${saved.teamNumbers.length} Prescouting team${saved.teamNumbers.length === 1 ? '' : 's'}.`);
      window.dispatchEvent(new CustomEvent(PRESCOUTING_TEAM_LIST_UPDATED_EVENT));
      void reloadPrescoutingTeams();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to save Prescouting teams.';
      setPrescoutingSaveError(message);
      showToast(message);
    } finally {
      setIsPrescoutingSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold text-white">Settings</h2>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Active Competition Event Key</label>
                <input
                  type="text"
                  value={activeEventKey}
                  readOnly
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none transition-all font-mono text-sm uppercase"
                />
              </div>

              {activeProfile && (
                <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-sm text-slate-300 space-y-1">
                  <p className="text-white font-semibold">{activeProfile.name}</p>
                  <p>{activeProfile.location}</p>
                  <p>{activeProfile.teamCount} teams cached</p>
                </div>
              )}

              {isAdminSignedIn && (
                <div className="space-y-3 border border-slate-700 bg-slate-800/40 rounded-xl p-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Prescouting Teams ({PRESCOUTING_SEASON_YEAR})</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Enter one team number per line. Blank lines are ignored, duplicates are removed, and an empty list is allowed.
                    </p>
                  </div>

                  <textarea
                    value={prescoutingTeamInput}
                    onChange={(event) => {
                      setPrescoutingTeamInput(event.target.value);
                      setPrescoutingSaveError(null);
                    }}
                    disabled={isPrescoutingTeamsLoading || isPrescoutingSaving}
                    rows={8}
                    placeholder="341\n316\n8513"
                    className="w-full resize-y rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                  />

                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 text-xs text-slate-400">
                      {isPrescoutingTeamsLoading
                        ? 'Loading saved teams...'
                        : `${prescoutingTeamNumbers.length} team${prescoutingTeamNumbers.length === 1 ? '' : 's'} currently saved.`}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        void handlePrescoutingSave();
                      }}
                      disabled={isPrescoutingTeamsLoading || isPrescoutingSaving}
                      className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500"
                    >
                      {isPrescoutingSaving ? 'Saving...' : 'Save Teams'}
                    </button>
                  </div>

                  {prescoutingTeamsError && (
                    <div className="flex items-center justify-between gap-3 text-xs text-rose-300">
                      <span>{prescoutingTeamsError}</span>
                      <button
                        type="button"
                        onClick={() => {
                          void reloadPrescoutingTeams();
                        }}
                        className="shrink-0 rounded-lg border border-slate-600 px-2 py-1 text-slate-200 hover:border-slate-400"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  {prescoutingSaveError && <p className="text-xs text-rose-300">{prescoutingSaveError}</p>}
                </div>
              )}

              <div className="space-y-3 border border-slate-700 bg-slate-800/40 rounded-xl p-4">
                <div>
                  <p className="text-sm font-semibold text-white">Field Map</p>
                  <p className="text-xs text-slate-400 mt-1">
                    This image is shared across the app and used by all autonomous and shot maps.
                  </p>
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950/70">
                  <img src={imageSrc} alt="Current field map" className="h-32 w-full object-fill" />
                </div>

                {isAdminSignedIn ? (
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => setSelectedMapFile(event.target.files?.[0] || null)}
                      disabled={isUploading}
                      className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-100 hover:file:bg-slate-600 disabled:opacity-60"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 text-xs text-slate-400 truncate">
                        {isFieldMapLoading
                          ? 'Loading saved map...'
                          : selectedMapFile
                            ? `${selectedMapFile.name} (${Math.ceil(selectedMapFile.size / 1024)} KB)`
                            : 'Choose an image up to 8 MiB.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          void handleMapUpload();
                        }}
                        disabled={!selectedMapFile || isUploading}
                        className="shrink-0 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {isUploading ? 'Uploading...' : 'Upload Map'}
                      </button>
                    </div>
                    {fieldMapError && <p className="text-xs text-rose-300">{fieldMapError}</p>}
                  </>
                ) : (
                  <p className="text-xs text-slate-400">Only admins can change the shared field map.</p>
                )}
              </div>

              <PitQuestionEditor isAdminSignedIn={isAdminSignedIn} />

              <div className="space-y-2 border border-slate-700 bg-slate-800/40 rounded-xl p-4">
                <p className="text-sm font-semibold text-white">Signed-in User</p>
                {signedInUserProfile ? (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-white font-semibold">{signedInUserProfile.name}</p>
                      <p className="text-xs text-slate-400 capitalize">{signedInUserProfile.authType} profile</p>
                    </div>
                    <button
                      onClick={onSignOutUserProfile}
                      className="px-3 py-2 border border-slate-600 hover:border-slate-400 text-slate-200 rounded-xl text-sm transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Signed out</p>
                )}
              </div>

              <p className="text-xs text-slate-400">
                Competition profiles are managed on the Events page. Supabase, TBA, and Gemini keys are loaded from Vercel environment variables.
              </p>
            </div>
            
            <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  onBackToEvents();
                  onClose();
                }}
                className="px-4 py-2.5 border border-slate-700 hover:border-slate-500 text-slate-200 font-medium rounded-xl transition-colors"
              >
                Back to Events
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-blue-500/20"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
