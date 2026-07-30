import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronDown, ImagePlus, Save, Trash2 } from 'lucide-react';
import { Toggle, MultiToggle } from '../components/Toggle';
import { showToast } from '../components/Toast';
import { deletePitScoutPhotoByUrl, uploadPitScoutPhoto } from '../lib/supabase';
import {
  getCachedPitQuestionDefinitions,
  getDefaultPitAnswer,
  getPitAnswer,
  isPitQuestionVisible,
  loadPitQuestionDefinitions,
  PIT_QUESTIONS_UPDATED_EVENT,
} from '../lib/pitQuestions';
import { storage } from '../lib/storage';
import { CompetitionProfile, PitAnswer, PitQuestionDefinition, PitQuestionType, PitScoutData, TBATeam } from '../types';
import { getProfileTeams } from '../lib/competitionProfiles';

const MAX_PIT_PHOTOS = 3;
const MAX_PIT_PHOTO_BYTES = 8 * 1024 * 1024;
const LEGACY_PIT_KEY_REGEX = /^pitScout:\d+$/;
const SYNC_QUEUE_KEY = 'syncQueue';

type PitScoutingProps = {
  activeProfile: CompetitionProfile | null;
};

function getScopedPitKey(profileId: string, teamNumber: number): string {
  return `pitScout:${profileId}:${teamNumber}`;
}

function normalizePhotoUrls(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((url): url is string => typeof url === 'string')
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
}

const INITIAL_STATE: PitScoutData = {
  teamNumber: '',
  photoUrls: [],
  answers: {},
  canClimbTower: false,
  fuelHopperCapacity: '',
  chassisWidth: '',
  chassisLength: '',
  driveTrainType: '',
  driveMotors: [],
  canDriveOverBump: false,
  canDriveUnderTrench: false,
  intakePosition: '',
  looksGood: '',
  autoDescription: '',
  visionSetup: '',
  shooterType: '',
  hasTurret: false,
  canPlayDefense: false,
  notes: '',
};

const PIT_LEGACY_KEYS = new Set(Object.keys(INITIAL_STATE));

function questionValue(data: PitScoutData, definition: PitQuestionDefinition): PitAnswer {
  return getPitAnswer(data, definition.key) ?? getDefaultPitAnswer(definition.type);
}

function normalizeLegacyValue(definition: PitQuestionDefinition, value: PitAnswer): unknown {
  if (!PIT_LEGACY_KEYS.has(definition.key)) {
    return undefined;
  }

  if (definition.type === 'number') {
    return typeof value === 'number' && Number.isFinite(value) ? value : '';
  }
  if (definition.type === 'boolean') {
    return value === true;
  }
  if (definition.type === 'multi_choice') {
    return Array.isArray(value) ? value : [];
  }
  return typeof value === 'string' ? value : '';
}

function getAnswerFromInput(type: PitQuestionType, value: string): PitAnswer {
  if (type === 'number') {
    return value.trim() ? Number(value) : null;
  }
  return value;
}

function questionTypeSupportsChoices(type: PitQuestionType): boolean {
  return type === 'single_choice' || type === 'multi_choice';
}

export function PitScouting({ activeProfile }: PitScoutingProps) {
  const [data, setData] = useState<PitScoutData>(INITIAL_STATE);
  const [questions, setQuestions] = useState<PitQuestionDefinition[]>(() => getCachedPitQuestionDefinitions() || []);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [deletingPhotoUrl, setDeletingPhotoUrl] = useState<string | null>(null);
  const [profileTeams, setProfileTeams] = useState<TBATeam[]>([]);
  const [teamSearch, setTeamSearch] = useState('');
  const [isTeamPickerOpen, setIsTeamPickerOpen] = useState(false);
  const [hasExistingRecord, setHasExistingRecord] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const definitions = await loadPitQuestionDefinitions();
      if (!cancelled) {
        setQuestions(definitions);
      }
    };

    void load();

    const onQuestionnaireUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<PitQuestionDefinition[]>;
      if (customEvent.detail) {
        setQuestions(customEvent.detail);
      }
    };

    window.addEventListener(PIT_QUESTIONS_UPDATED_EVENT, onQuestionnaireUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(PIT_QUESTIONS_UPDATED_EVENT, onQuestionnaireUpdated);
    };
  }, []);

  useEffect(() => {
    const legacyKeys = storage.getAllKeys().filter((key) => LEGACY_PIT_KEY_REGEX.test(key));
    legacyKeys.forEach((key) => localStorage.removeItem(key));

    const queue = storage.getSyncQueue();
    const nextQueue = queue.filter((record) => {
      if (record.type !== 'pitScout') {
        return true;
      }

      const payload = (record.data || {}) as Partial<PitScoutData>;
      return Boolean(payload.eventKey && payload.profileId);
    });

    if (nextQueue.length !== queue.length) {
      storage.set(SYNC_QUEUE_KEY, nextQueue);
    }
  }, []);

  useEffect(() => {
    if (!activeProfile?.id) {
      setProfileTeams([]);
      setTeamSearch('');
      setIsTeamPickerOpen(false);
      setHasExistingRecord(false);
      setData(INITIAL_STATE);
      return;
    }

    setProfileTeams(getProfileTeams(activeProfile.id));
    setTeamSearch('');
    setIsTeamPickerOpen(false);
    setHasExistingRecord(false);
    setData(INITIAL_STATE);
  }, [activeProfile?.id]);

  useEffect(() => {
    if (!activeProfile?.id || !data.teamNumber) {
      setHasExistingRecord(false);
      return;
    }

    const scopedKey = getScopedPitKey(activeProfile.id, data.teamNumber);
    const saved = storage.get<{ data?: Partial<PitScoutData> }>(scopedKey);
    if (saved?.data) {
      setHasExistingRecord(true);
      setData({
        ...INITIAL_STATE,
        ...saved.data,
        answers: saved.data.answers || {},
        eventKey: activeProfile.eventKey,
        profileId: activeProfile.id,
        photoUrls: normalizePhotoUrls(saved.data.photoUrls),
      });
      return;
    }

    setHasExistingRecord(false);
  }, [activeProfile?.eventKey, activeProfile?.id, data.teamNumber]);

  const scoutedTeamNumbers = useMemo(() => {
    if (!activeProfile?.id) {
      return new Set<number>();
    }

    const scopedPrefix = `pitScout:${activeProfile.id}:`;
    const scopedKeys = storage.getAllKeys().filter((key) => key.startsWith(scopedPrefix));
    return scopedKeys.reduce((acc, key) => {
      const teamNumber = Number(key.split(':')[2]);
      if (Number.isFinite(teamNumber) && teamNumber > 0) {
        acc.add(teamNumber);
      }
      return acc;
    }, new Set<number>());
  }, [activeProfile?.id, data]);

  const unscoutedTeams = useMemo(() => profileTeams
    .filter((team) => !scoutedTeamNumbers.has(team.team_number))
    .sort((a, b) => a.team_number - b.team_number), [profileTeams, scoutedTeamNumbers]);

  const filteredUnscoutedTeams = useMemo(() => {
    const needle = teamSearch.trim().toLowerCase();
    if (!needle) {
      return unscoutedTeams;
    }

    return unscoutedTeams.filter((team) => {
      const numberText = String(team.team_number);
      const nickname = (team.nickname || '').toLowerCase();
      const name = (team.name || '').toLowerCase();
      return numberText.includes(needle) || nickname.includes(needle) || name.includes(needle);
    });
  }, [teamSearch, unscoutedTeams]);

  const selectedTeam = useMemo(() => {
    if (!data.teamNumber) {
      return null;
    }
    return profileTeams.find((team) => team.team_number === data.teamNumber) || null;
  }, [data.teamNumber, profileTeams]);

  const activeQuestions = useMemo(() => questions.filter((question) => !question.archived), [questions]);
  const sections = useMemo(() => {
    const orderedSections: PitQuestionDefinition['section'][] = ['Robot Details', 'Game Mechanisms', 'Strategy & Notes', 'Custom Questions'];
    return orderedSections
      .map((section) => ({ section, questions: activeQuestions.filter((question) => question.section === section) }))
      .filter((group) => group.questions.length > 0);
  }, [activeQuestions]);

  const selectTeam = (team: TBATeam) => {
    if (!activeProfile?.id) {
      return;
    }

    const scopedKey = getScopedPitKey(activeProfile.id, team.team_number);
    const saved = storage.get<{ data?: Partial<PitScoutData> }>(scopedKey);
    setHasExistingRecord(Boolean(saved?.data));
    setData({
      ...INITIAL_STATE,
      teamNumber: team.team_number,
      eventKey: activeProfile.eventKey,
      profileId: activeProfile.id,
    });
    setTeamSearch('');
    setIsTeamPickerOpen(false);
  };

  const saveData = (nextData: PitScoutData) => {
    setData(nextData);
    if (activeProfile?.id && nextData.teamNumber) {
      storage.saveRecord('pitScout', getScopedPitKey(activeProfile.id, Number(nextData.teamNumber)), nextData);
    }
  };

  const updateField = <K extends keyof PitScoutData>(field: K, value: PitScoutData[K]) => {
    const nextData = {
      ...data,
      [field]: value,
      eventKey: activeProfile?.eventKey,
      profileId: activeProfile?.id || undefined,
    };
    saveData(nextData);
  };

  const updateQuestion = (definition: PitQuestionDefinition, value: PitAnswer) => {
    const nextAnswers = {
      ...(data.answers || {}),
      [definition.key]: value,
    };
    const nextData = {
      ...data,
      answers: nextAnswers,
      eventKey: activeProfile?.eventKey,
      profileId: activeProfile?.id || undefined,
    } as PitScoutData & Record<string, unknown>;
    const legacyValue = normalizeLegacyValue(definition, value);
    if (legacyValue !== undefined) {
      nextData[definition.key] = legacyValue;
    }
    saveData(nextData as PitScoutData);
  };

  const renderQuestion = (definition: PitQuestionDefinition) => {
    if (!isPitQuestionVisible(data, definition)) {
      return null;
    }

    const value = questionValue(data, definition);
    const inputClass = 'w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white focus:ring-2 focus:ring-blue-500';

    if (definition.type === 'boolean') {
      return (
        <Toggle
          key={definition.key}
          label={definition.label}
          value={value === true}
          onChange={(nextValue) => updateQuestion(definition, nextValue)}
        />
      );
    }

    if (definition.type === 'single_choice') {
      return (
        <MultiToggle
          key={definition.key}
          label={definition.label}
          options={definition.options}
          value={typeof value === 'string' ? value : ''}
          onChange={(nextValue) => updateQuestion(definition, nextValue)}
        />
      );
    }

    if (definition.type === 'multi_choice') {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div key={definition.key} className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">{definition.label}</label>
          <div className="grid grid-cols-2 gap-2">
            {definition.options.map((option) => {
              const isSelected = selected.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => updateQuestion(definition, isSelected ? selected.filter((item) => item !== option) : [...selected, option])}
                  className={`rounded-xl border p-3 text-sm font-medium transition-colors ${isSelected ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (definition.type === 'number') {
      return (
        <div key={definition.key} className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">{definition.label}</label>
          <input
            type="number"
            value={typeof value === 'number' ? value : ''}
            onChange={(event) => updateQuestion(definition, getAnswerFromInput(definition.type, event.target.value))}
            className={inputClass}
          />
        </div>
      );
    }

    return (
      <div key={definition.key} className="space-y-2">
        <label className="block text-sm font-medium text-slate-300">{definition.label}</label>
        {definition.type === 'long_text' ? (
          <textarea
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => updateQuestion(definition, event.target.value)}
            className={`${inputClass} min-h-[100px]`}
          />
        ) : (
          <input
            type="text"
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => updateQuestion(definition, event.target.value)}
            className={inputClass}
          />
        )}
      </div>
    );
  };

  const handleSave = () => {
    if (!activeProfile?.id) {
      showToast('Select a competition profile before scouting pits');
      return;
    }
    if (!data.teamNumber) {
      showToast('Please select a team from the dropdown');
      return;
    }

    setData(INITIAL_STATE);
    setHasExistingRecord(false);
    showToast(`Saved pit scouting for team ${data.teamNumber}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePhotoFile = async (file: File | null) => {
    if (!file) {
      return;
    }
    if (!data.teamNumber) {
      showToast('Select a team before uploading photos');
      return;
    }
    if (!activeProfile?.eventKey) {
      showToast('Select a competition profile before uploading photos');
      return;
    }

    const existingUrls = normalizePhotoUrls(data.photoUrls);
    if (existingUrls.length >= MAX_PIT_PHOTOS) {
      showToast(`You can upload up to ${MAX_PIT_PHOTOS} photos.`);
      return;
    }
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file.');
      return;
    }
    if (file.size > MAX_PIT_PHOTO_BYTES) {
      showToast('Image too large. Max file size is 8MB.');
      return;
    }

    try {
      setIsUploadingPhoto(true);
      const result = await uploadPitScoutPhoto(activeProfile.eventKey, Number(data.teamNumber), file);
      updateField('photoUrls', [...existingUrls, result.publicUrl]);
      showToast('Photo uploaded');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Photo upload failed');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePhotoInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    void handlePhotoFile(file);
  };

  const handleRemovePhoto = async (url: string) => {
    const nextUrls = normalizePhotoUrls(data.photoUrls).filter((currentUrl) => currentUrl !== url);
    updateField('photoUrls', nextUrls);

    try {
      setDeletingPhotoUrl(url);
      await deletePitScoutPhotoByUrl(url);
      showToast('Photo removed');
    } catch (error) {
      showToast(error instanceof Error ? `Photo removed locally. ${error.message}` : 'Photo removed locally. Failed to delete remote file.');
    } finally {
      setDeletingPhotoUrl(null);
    }
  };

  const photoUrls = normalizePhotoUrls(data.photoUrls);
  const canAddMorePhotos = photoUrls.length < MAX_PIT_PHOTOS;

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-24">
      <div className="space-y-6 rounded-2xl border border-slate-700 bg-slate-800/50 p-6 shadow-xl">
        <h2 className="mb-4 text-2xl font-bold text-white">Pit Scouting</h2>

        {!activeProfile && <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">Select a competition profile to save pit scouting data.</p>}

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Team</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsTeamPickerOpen((previous) => !previous)}
              disabled={!activeProfile}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-left text-white transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className={selectedTeam ? 'font-mono text-xl' : 'text-slate-400'}>
                {selectedTeam ? `${selectedTeam.team_number} - ${selectedTeam.nickname || selectedTeam.name || 'Unknown team'}` : 'Select an unscouted team'}
              </span>
              <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${isTeamPickerOpen ? 'rotate-180' : ''}`} />
            </button>

            {isTeamPickerOpen && (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl">
                <div className="border-b border-slate-800 p-3">
                  <input
                    type="text"
                    value={teamSearch}
                    onChange={(event) => setTeamSearch(event.target.value)}
                    placeholder="Search by team # or nickname"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="max-h-72 space-y-1 overflow-y-auto p-2">
                  {!activeProfile ? <p className="px-3 py-2 text-sm text-slate-400">Select a competition profile first.</p>
                    : profileTeams.length === 0 ? <p className="px-3 py-2 text-sm text-slate-400">No event teams found for this profile.</p>
                      : unscoutedTeams.length === 0 ? <p className="px-3 py-2 text-sm text-emerald-300">All teams are already pit scouted.</p>
                        : filteredUnscoutedTeams.length === 0 ? <p className="px-3 py-2 text-sm text-slate-400">No teams match your search.</p>
                          : filteredUnscoutedTeams.map((team) => (
                            <button key={team.key} type="button" onClick={() => selectTeam(team)} className="w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-left transition-colors hover:bg-slate-800">
                              <p className="font-mono text-base text-white">{team.team_number}</p>
                              <p className="truncate text-sm text-slate-300">{team.nickname || team.name || 'Unknown team'}</p>
                            </button>
                          ))}
                </div>
              </div>
            )}
          </div>
          {!data.teamNumber && <p className="text-xs text-slate-400">Pick a team from the unscouted list before filling out details.</p>}
          {hasExistingRecord && data.teamNumber && <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">Existing pit scouting data was found for this team and loaded for editing.</p>}
        </div>
      </div>

      {sections.map(({ section, questions: sectionQuestions }) => (
        <div key={section} className="space-y-6 rounded-2xl border border-slate-700 bg-slate-800/50 p-6 shadow-xl">
          <h2 className="mb-4 text-2xl font-bold text-white">{section}</h2>
          {sectionQuestions.map(renderQuestion)}
        </div>
      ))}

      <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-800/50 p-6 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <label className="block text-sm font-medium text-slate-300">Photos ({photoUrls.length}/{MAX_PIT_PHOTOS})</label>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!canAddMorePhotos || isUploadingPhoto} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><ImagePlus className="h-4 w-4" />Add Photo</button>
            <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={!canAddMorePhotos || isUploadingPhoto} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><Camera className="h-4 w-4" />Camera</button>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoInputChange} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoInputChange} />
        {isUploadingPhoto && <p className="text-xs text-slate-400">Uploading photo...</p>}
        {photoUrls.length === 0 ? <p className="text-xs text-slate-500">No photos added yet.</p> : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {photoUrls.map((url, index) => (
              <div key={`${url}-${index}`} className="space-y-2 rounded-xl border border-slate-700 bg-slate-900/80 p-2">
                <img src={url} alt={`Pit scouting photo ${index + 1}`} className="h-28 w-full rounded-lg border border-slate-700 object-cover" loading="lazy" />
                <button type="button" onClick={() => void handleRemovePhoto(url)} disabled={deletingPhotoUrl === url} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-rose-500/40 px-2 py-1.5 text-xs text-rose-200 hover:bg-rose-900/30 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />{deletingPhotoUrl === url ? 'Removing...' : 'Remove'}</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4">
        <button onClick={handleSave} disabled={!activeProfile?.id || !data.teamNumber} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-emerald-600/20 transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300 disabled:shadow-none sm:w-auto"><Save className="h-6 w-6" />Save &amp; Next</button>
      </div>
    </div>
  );
}
