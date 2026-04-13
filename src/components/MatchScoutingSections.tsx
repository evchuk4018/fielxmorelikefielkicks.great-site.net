import React from 'react';
import { Save } from 'lucide-react';
import { AutonPathField } from './AutonPathField';
import { MultiToggle, Toggle } from './Toggle';
import { AllianceColor, AutonPathData, AutonShotAttempt, DefenseQuality } from '../types';

export type MatchScoutingFormState = {
  autonNotes: string;
  autonPath: AutonPathData | null;
  teleopShotAttempts: AutonShotAttempt[];
  playedDefense: boolean;
  defenseQuality: DefenseQuality | '';
  defenseNotes: string;
  notes: string;
};

type MatchScoutingSectionsProps = {
  readyToScout: boolean;
  selectedMatchKey: string;
  selectedTeamNumber: number | '';
  allianceColor: AllianceColor | '';
  formState: MatchScoutingFormState;
  onFormStateChange: (next: MatchScoutingFormState) => void;
  onPersist: (overrides?: Partial<MatchScoutingFormState>) => void;
  onSave: () => void;
  saveDisabled: boolean;
  saveLabel?: string;
};

export function MatchScoutingSections(props: MatchScoutingSectionsProps) {
  const {
    readyToScout,
    selectedMatchKey,
    selectedTeamNumber,
    allianceColor,
    formState,
    onFormStateChange,
    onPersist,
    onSave,
    saveDisabled,
    saveLabel = 'Save & Next',
  } = props;

  return (
    <>
      <div
        className={`bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl space-y-6 transition-opacity ${
          readyToScout ? 'opacity-100' : 'opacity-40 pointer-events-none'
        }`}
      >
        <h2 className="text-2xl font-bold text-white">Autonomous</h2>

        <AutonPathField
          instanceId={`auton-${selectedMatchKey}-${selectedTeamNumber || 'none'}`}
          mode="record"
          allianceColor={allianceColor}
          value={formState.autonPath}
          enableTeleopShotMap
          teleopShotAttempts={formState.teleopShotAttempts}
          onTeleopShotAttemptsChange={(next) => {
            onFormStateChange({ ...formState, teleopShotAttempts: next });
            onPersist({ teleopShotAttempts: next });
          }}
          onChange={(next) => {
            onFormStateChange({ ...formState, autonPath: next });
            onPersist({ autonPath: next });
          }}
        />

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            What did they do in auto?
          </label>
          <textarea
            value={formState.autonNotes}
            onChange={(e) => {
              onFormStateChange({ ...formState, autonNotes: e.target.value });
              onPersist({ autonNotes: e.target.value });
            }}
            placeholder="Describe autonomous actions..."
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-y"
          />
        </div>
      </div>

      <div
        className={`bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl space-y-6 transition-opacity ${
          readyToScout ? 'opacity-100' : 'opacity-40 pointer-events-none'
        }`}
      >
        <h2 className="text-2xl font-bold text-white">Defense</h2>

        <Toggle
          label="Played Defense?"
          value={formState.playedDefense}
          onChange={(value) => {
            onFormStateChange({ ...formState, playedDefense: value });
            onPersist({ playedDefense: value });
          }}
        />

        {formState.playedDefense && (
          <div className="space-y-4">
            <MultiToggle<DefenseQuality>
              label="Defense Quality"
              options={['Good', 'Bad']}
              value={formState.defenseQuality}
              onChange={(value) => {
                onFormStateChange({ ...formState, defenseQuality: value });
                onPersist({ defenseQuality: value });
              }}
            />

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Describe their defense (include if it was good or bad)
              </label>
              <textarea
                value={formState.defenseNotes}
                onChange={(e) => {
                  onFormStateChange({ ...formState, defenseNotes: e.target.value });
                  onPersist({ defenseNotes: e.target.value });
                }}
                placeholder="Example: Good lane denial and smart pin timing, or bad positioning and missed assignments..."
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-y"
              />
            </div>
          </div>
        )}
      </div>

      <div
        className={`bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl space-y-6 transition-opacity ${
          readyToScout ? 'opacity-100' : 'opacity-40 pointer-events-none'
        }`}
      >
        <h2 className="text-2xl font-bold text-white">Notes</h2>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Additional notes</label>
          <textarea
            value={formState.notes}
            onChange={(e) => {
              onFormStateChange({ ...formState, notes: e.target.value });
              onPersist({ notes: e.target.value });
            }}
            placeholder="Any other observations..."
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-y"
          />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={onSave}
          disabled={saveDisabled}
          className="flex items-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors shadow-lg shadow-emerald-600/20 w-full sm:w-auto justify-center text-lg"
        >
          <Save className="w-6 h-6" />
          {saveLabel}
        </button>
      </div>
    </>
  );
}
