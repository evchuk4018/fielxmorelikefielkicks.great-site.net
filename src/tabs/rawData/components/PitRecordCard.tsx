import React, { useEffect, useMemo, useState } from 'react';
import { MatchNoteSummary } from '../../../lib/gemini';
import {
  getCachedPitQuestionDefinitions,
  getPitAnswer,
  hasPitAnswerValue,
  loadPitQuestionDefinitions,
  PIT_QUESTIONS_UPDATED_EVENT,
} from '../../../lib/pitQuestions';
import { PitQuestionDefinition } from '../../../types';
import { MatchNotesBundle, RawEntry } from '../types';
import { asPitPayload, displayPhotoUrls, displayText } from '../utils';
import { BoolRow, SectionCard, ValueRow } from './RawDataPrimitives';

type PitRecordCardProps = {
  entry: RawEntry;
  selectedTeamMatchNotes: MatchNotesBundle;
  noteSummary: MatchNoteSummary | null;
  isLoadingNoteSummary: boolean;
  noteSummaryError: string | null;
};

export const PitRecordCard = React.memo(function PitRecordCard({
  entry,
  selectedTeamMatchNotes,
  noteSummary,
  isLoadingNoteSummary,
  noteSummaryError,
}: PitRecordCardProps) {
  const pit = asPitPayload(entry.payload);
  const [definitions, setDefinitions] = useState<PitQuestionDefinition[]>(() => getCachedPitQuestionDefinitions() || []);

  useEffect(() => {
    let cancelled = false;
    void loadPitQuestionDefinitions().then((nextDefinitions) => {
      if (!cancelled) {
        setDefinitions(nextDefinitions);
      }
    });

    const onQuestionnaireUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<PitQuestionDefinition[]>;
      if (customEvent.detail) {
        setDefinitions(customEvent.detail);
      }
    };

    window.addEventListener(PIT_QUESTIONS_UPDATED_EVENT, onQuestionnaireUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(PIT_QUESTIONS_UPDATED_EVENT, onQuestionnaireUpdated);
    };
  }, []);

  const reportDefinitions = useMemo(() => {
    if (!pit) {
      return [];
    }

    return definitions.filter((definition) => !definition.archived || hasPitAnswerValue(getPitAnswer(pit, definition.key)));
  }, [definitions, pit]);

  const sections = useMemo(() => {
    const orderedSections: PitQuestionDefinition['section'][] = ['Robot Details', 'Game Mechanisms', 'Strategy & Notes', 'Custom Questions'];
    return orderedSections
      .map((section) => ({ section, questions: reportDefinitions.filter((definition) => definition.section === section) }))
      .filter((group) => group.questions.length > 0);
  }, [reportDefinitions]);

  const renderQuestion = (definition: PitQuestionDefinition) => {
    const value = getPitAnswer(pit, definition.key);
    if (definition.type === 'boolean') {
      return <BoolRow key={definition.key} label={definition.label} value={value} />;
    }

    return (
      <ValueRow
        key={definition.key}
        label={definition.label}
        value={displayText(value)}
        mono={definition.type === 'number'}
      />
    );
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-slate-700 px-2 py-1 uppercase text-slate-200">pit</span>
        <span className="text-slate-500">Source: {entry.source}</span>
        <span className="text-slate-500">Updated: {entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : 'Unknown'}</span>
      </div>

      {!pit && <div className="text-sm text-slate-400">This record could not be rendered.</div>}

      {pit && (
        <div className="space-y-4">
          {sections.map(({ section, questions }) => (
            <SectionCard key={section} title={section}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {section === 'Robot Details' && <ValueRow label="Team Number" value={displayText(pit.teamNumber, 'Unknown')} mono />}
                {questions.map(renderQuestion)}
              </div>
            </SectionCard>
          ))}

          <SectionCard title="Match Strategy Notes">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-slate-800 px-2 py-1 uppercase text-slate-200">match strategy notes</span>
                <span className="text-slate-500">From {selectedTeamMatchNotes.totalMatches} saved match records</span>
              </div>

              {isLoadingNoteSummary && <p className="text-sm text-slate-400">Summarizing cumulative autonomous and defense strategies...</p>}
              {!isLoadingNoteSummary && noteSummaryError && <p className="text-sm text-rose-300">{noteSummaryError}</p>}
              {!isLoadingNoteSummary && !noteSummaryError && noteSummary && (
                <div className="space-y-3">
                  <div className="space-y-1 rounded-lg border border-slate-700 bg-slate-950/40 p-3"><p className="text-xs uppercase tracking-wide text-slate-400">Cumulative Auton Strategy</p><p className="whitespace-pre-line text-sm text-slate-100">{noteSummary.autonStrategy}</p></div>
                  <div className="space-y-1 rounded-lg border border-slate-700 bg-slate-950/40 p-3"><p className="text-xs uppercase tracking-wide text-slate-400">Cumulative Defense Strategy</p><p className="whitespace-pre-line text-sm text-slate-100">{noteSummary.defenseStrategy}</p></div>
                  <div className="space-y-1 rounded-lg border border-slate-700 bg-slate-950/40 p-3"><p className="text-xs uppercase tracking-wide text-slate-400">Overall Match Notes</p><p className="whitespace-pre-line text-sm text-slate-100">{noteSummary.overallSummary}</p></div>
                </div>
              )}
            </div>
          </SectionCard>

          {displayPhotoUrls(pit.photoUrls).length > 0 && (
            <SectionCard title="Photos">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {displayPhotoUrls(pit.photoUrls).map((photoUrl, index) => (
                  <div key={`${photoUrl}-${index}`} className="rounded-xl border border-slate-700 bg-slate-950/40 p-2">
                    <img src={photoUrl} alt={`Pit photo ${index + 1}`} className="h-32 w-full rounded-lg border border-slate-700 object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
});

PitRecordCard.displayName = 'PitRecordCard';
