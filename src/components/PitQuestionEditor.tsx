import React, { useEffect, useMemo, useState } from 'react';
import { Archive, Check, Plus, RotateCcw, Save } from 'lucide-react';
import { showToast } from './Toast';
import {
  createCustomPitQuestion,
  getCachedPitQuestionDefinitions,
  hasAnyPitQuestionAnswers,
  loadPitQuestionDefinitions,
  PIT_QUESTIONS_UPDATED_EVENT,
  savePitQuestionDefinitions,
} from '../lib/pitQuestions';
import { PitQuestionDefinition, PitQuestionType } from '../types';

type PitQuestionEditorProps = {
  isAdminSignedIn: boolean;
};

const QUESTION_TYPE_LABELS: Record<PitQuestionType, string> = {
  boolean: 'True / False',
  short_text: 'Short text',
  long_text: 'Open-ended text',
  number: 'Number',
  single_choice: 'Single choice',
  multi_choice: 'Multiple choice',
};

const QUESTION_TYPES = Object.keys(QUESTION_TYPE_LABELS) as PitQuestionType[];

function cloneDefinitions(definitions: PitQuestionDefinition[]): PitQuestionDefinition[] {
  return definitions.map((definition) => ({
    ...definition,
    options: [...definition.options],
    showWhen: definition.showWhen ? { ...definition.showWhen } : undefined,
  }));
}

function parseOptions(value: string): string[] {
  return Array.from(new Set(value
    .split(/[,\n]/)
    .map((option) => option.trim())
    .filter(Boolean)));
}

function optionsText(options: string[]): string {
  return options.join('\n');
}

export function PitQuestionEditor({ isAdminSignedIn }: PitQuestionEditorProps) {
  const [definitions, setDefinitions] = useState<PitQuestionDefinition[]>(() => getCachedPitQuestionDefinitions() || []);
  const [savedDefinitions, setSavedDefinitions] = useState<PitQuestionDefinition[]>(() => getCachedPitQuestionDefinitions() || []);
  const [isLoading, setIsLoading] = useState(() => definitions.length === 0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const nextDefinitions = await loadPitQuestionDefinitions();
        if (!cancelled) {
          setDefinitions(nextDefinitions);
          setSavedDefinitions(cloneDefinitions(nextDefinitions));
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load Pit Scouting questions.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    const onQuestionnaireUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<PitQuestionDefinition[]>;
      if (!customEvent.detail) {
        return;
      }
      setDefinitions(cloneDefinitions(customEvent.detail));
      setSavedDefinitions(cloneDefinitions(customEvent.detail));
    };

    window.addEventListener(PIT_QUESTIONS_UPDATED_EVENT, onQuestionnaireUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(PIT_QUESTIONS_UPDATED_EVENT, onQuestionnaireUpdated);
    };
  }, []);

  const activeDefinitions = useMemo(() => definitions.filter((definition) => !definition.archived), [definitions]);
  const archivedDefinitions = useMemo(() => definitions.filter((definition) => definition.archived), [definitions]);

  const updateDefinition = (key: string, update: Partial<PitQuestionDefinition>) => {
    setDefinitions((current) => current.map((definition) => {
      if (definition.key !== key) {
        return definition;
      }

      const nextType = update.type || definition.type;
      return {
        ...definition,
        ...update,
        type: nextType,
        options: nextType === 'single_choice' || nextType === 'multi_choice'
          ? (update.options || definition.options)
          : [],
      };
    }));
  };

  const addQuestion = () => {
    const nextOrder = definitions.reduce((max, definition) => Math.max(max, definition.order), 0) + 10;
    setDefinitions((current) => [...current, createCustomPitQuestion('New Pit Question', nextOrder)]);
  };

  const saveChanges = async () => {
    if (!isAdminSignedIn) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      for (const definition of definitions) {
        const original = savedDefinitions.find((candidate) => candidate.key === definition.key);
        if (original && original.type !== definition.type && await hasAnyPitQuestionAnswers(definition.key)) {
          throw new Error(`The type for "${definition.label}" cannot change because it already has saved answers.`);
        }
      }

      const saved = await savePitQuestionDefinitions(definitions);
      setDefinitions(saved);
      setSavedDefinitions(cloneDefinitions(saved));
      showToast('Pit Scouting questions saved');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to save Pit Scouting questions.';
      setError(message);
      showToast(message);
    } finally {
      setIsSaving(false);
    }
  };

  const renderQuestion = (definition: PitQuestionDefinition) => {
    const canEdit = isAdminSignedIn;
    const isChoice = definition.type === 'single_choice' || definition.type === 'multi_choice';

    return (
      <div key={definition.key} className={`rounded-xl border p-4 space-y-3 ${definition.archived ? 'border-slate-700/60 bg-slate-950/40 opacity-80' : 'border-slate-700 bg-slate-900/60'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-slate-500">{definition.section}</span>
              {definition.builtIn && <span className="rounded bg-blue-500/15 px-2 py-0.5 text-[11px] text-blue-200">Built-in</span>}
              {definition.archived && <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-200">Archived</span>}
            </div>
            <input
              type="text"
              value={definition.label}
              onChange={(event) => updateDefinition(definition.key, { label: event.target.value })}
              disabled={!canEdit}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:text-slate-300"
              aria-label={`Question text for ${definition.key}`}
            />
            <p className="truncate font-mono text-[11px] text-slate-500">Key: {definition.key}</p>
          </div>

          <select
            value={definition.type}
            onChange={(event) => updateDefinition(definition.key, { type: event.target.value as PitQuestionType })}
            disabled={!canEdit}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
            aria-label={`Question type for ${definition.key}`}
          >
            {QUESTION_TYPES.map((type) => <option key={type} value={type}>{QUESTION_TYPE_LABELS[type]}</option>)}
          </select>
        </div>

        {isChoice && (
          <label className="block space-y-1">
            <span className="text-xs text-slate-400">Choices, one per line</span>
            <textarea
              value={optionsText(definition.options)}
              onChange={(event) => updateDefinition(definition.key, { options: parseOptions(event.target.value) })}
              disabled={!canEdit}
              rows={Math.min(5, Math.max(2, definition.options.length))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:text-slate-400"
              aria-label={`Choices for ${definition.key}`}
            />
          </label>
        )}

        {canEdit && (
          <button
            type="button"
            onClick={() => updateDefinition(definition.key, { archived: !definition.archived })}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
          >
            {definition.archived ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
            {definition.archived ? 'Restore question' : 'Archive question'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-800/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Pit Scouting Questions</p>
          <p className="mt-1 text-xs text-slate-400">
            This questionnaire is shared across all competition events. Team selection and photos stay fixed.
          </p>
        </div>
        {isAdminSignedIn && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addQuestion}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add question
            </button>
            <button
              type="button"
              onClick={() => void saveChanges()}
              disabled={isSaving || isLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400"
            >
              {isSaving ? <Check className="h-3.5 w-3.5 animate-pulse" /> : <Save className="h-3.5 w-3.5" />}
              {isSaving ? 'Saving...' : 'Save questions'}
            </button>
          </div>
        )}
      </div>

      {!isAdminSignedIn && <p className="rounded-lg border border-slate-700 bg-slate-950/50 p-3 text-xs text-slate-400">Only admins can change the questionnaire.</p>}
      {isLoading && <p className="text-sm text-slate-400">Loading Pit Scouting questions...</p>}
      {error && <p className="rounded-lg border border-rose-500/40 bg-rose-950/20 p-3 text-xs text-rose-200">{error}</p>}

      {!isLoading && (
        <>
          <div className="space-y-3">
            {activeDefinitions.map(renderQuestion)}
          </div>
          {archivedDefinitions.length > 0 && (
            <div className="space-y-3 border-t border-slate-700 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Archived questions</p>
              {archivedDefinitions.map(renderQuestion)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
