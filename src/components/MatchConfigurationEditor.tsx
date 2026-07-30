import React from 'react';
import { Archive, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { AllianceFilterDefinition, AnalyticsMetricDefinition, MatchQuestionDefinition, MatchQuestionType, ScoringRuleDefinition, SeasonConfiguration } from '../types';
import { createCustomMatchQuestion } from '../lib/seasonConfigurationEditor';

type Props = {
  configuration: SeasonConfiguration;
  isAdminSignedIn: boolean;
  onChange: (next: SeasonConfiguration) => void;
};

const QUESTION_TYPE_LABELS: Record<MatchQuestionType, string> = {
  boolean: 'True / False',
  short_text: 'Short text',
  long_text: 'Open-ended text',
  number: 'Number',
  single_choice: 'Single choice',
  multi_choice: 'Multiple choice',
};

const QUESTION_TYPES = Object.keys(QUESTION_TYPE_LABELS) as MatchQuestionType[];

function parseOptions(value: string): string[] {
  return Array.from(new Set(value.split(/[\n,]/).map((option) => option.trim()).filter(Boolean)));
}

function updateQuestion(configuration: SeasonConfiguration, key: string, update: Partial<MatchQuestionDefinition>): SeasonConfiguration {
  return {
    ...configuration,
    matchQuestions: configuration.matchQuestions.map((question) => question.key === key ? {
      ...question,
      ...update,
      options: update.type && update.type !== 'single_choice' && update.type !== 'multi_choice'
        ? []
        : (update.options || question.options),
    } : question),
  };
}

function parseConditionValue(value: string, reference?: MatchQuestionDefinition): boolean | number | string {
  if (reference?.type === 'boolean') {
    return value === 'true';
  }
  if (reference?.type === 'number' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return value;
}

function valuesText(rule: ScoringRuleDefinition): string {
  return Object.entries(rule.values).map(([key, value]) => `${key}=${value}`).join('\n');
}

function parseValues(value: string): Record<string, number> {
  const output: Record<string, number> = {};
  value.split('\n').forEach((line) => {
    const [rawKey, rawValue] = line.split('=').map((part) => part.trim());
    const parsed = Number(rawValue);
    if (rawKey && Number.isFinite(parsed)) {
      output[rawKey] = parsed;
    }
  });
  return output;
}

export function MatchConfigurationEditor({ configuration, isAdminSignedIn, onChange }: Props) {
  const canEdit = isAdminSignedIn;
  const activeQuestions = configuration.matchQuestions.filter((question) => !question.archived);
  const archivedQuestions = configuration.matchQuestions.filter((question) => question.archived);
  const questionByKey = new Map(configuration.matchQuestions.map((question) => [question.key, question]));

  const renderQuestion = (question: MatchQuestionDefinition) => {
    const isChoice = question.type === 'single_choice' || question.type === 'multi_choice';
    const conditionReference = question.showWhen ? questionByKey.get(question.showWhen.questionKey) : undefined;

    return (
      <div key={question.key} className={`space-y-3 rounded-xl border p-4 ${question.archived ? 'border-slate-700/60 bg-slate-950/40 opacity-80' : 'border-slate-700 bg-slate-900/60'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-slate-500">{question.section}</span>
              {question.archived && <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-200">Archived</span>}
            </div>
            <input
              type="text"
              value={question.label}
              disabled={!canEdit}
              onChange={(event) => onChange(updateQuestion(configuration, question.key, { label: event.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white disabled:text-slate-400"
              aria-label={`Match question text for ${question.key}`}
            />
            <p className="font-mono text-[11px] text-slate-500">Key: {question.key}</p>
          </div>
          <select
            value={question.type}
            disabled={!canEdit}
            onChange={(event) => onChange(updateQuestion(configuration, question.key, { type: event.target.value as MatchQuestionType }))}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:text-slate-400"
            aria-label={`Match question type for ${question.key}`}
          >
            {QUESTION_TYPES.map((type) => <option key={type} value={type}>{QUESTION_TYPE_LABELS[type]}</option>)}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-slate-400">
            <span>Section</span>
            <input value={question.section} disabled={!canEdit} onChange={(event) => onChange(updateQuestion(configuration, question.key, { section: event.target.value }))} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          </label>
          <label className="space-y-1 text-xs text-slate-400">
            <span>Display order</span>
            <input type="number" value={question.order} disabled={!canEdit} onChange={(event) => onChange(updateQuestion(configuration, question.key, { order: Number(event.target.value) || 0 }))} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          </label>
        </div>

        {isChoice && (
          <label className="block space-y-1 text-xs text-slate-400">
            <span>Choices, one per line</span>
            <textarea value={question.options.join('\n')} disabled={!canEdit} onChange={(event) => onChange(updateQuestion(configuration, question.key, { options: parseOptions(event.target.value) }))} rows={Math.min(6, Math.max(2, question.options.length))} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          </label>
        )}

        {question.type === 'number' && (
          <div className="grid gap-3 sm:grid-cols-3">
            {(['min', 'max', 'step'] as const).map((field) => (
              <label key={field} className="space-y-1 text-xs text-slate-400">
                <span>{field.toUpperCase()}</span>
                <input type="number" value={question[field] ?? ''} disabled={!canEdit} onChange={(event) => onChange(updateQuestion(configuration, question.key, { [field]: event.target.value === '' ? undefined : Number(event.target.value) }))} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
              </label>
            ))}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-xs text-slate-400">
            <span>Show when question</span>
            <select
              value={question.showWhen?.questionKey || ''}
              disabled={!canEdit}
              onChange={(event) => {
                const reference = questionByKey.get(event.target.value);
                onChange(updateQuestion(configuration, question.key, { showWhen: event.target.value ? { questionKey: event.target.value, equals: reference?.type === 'boolean' ? true : '' } : undefined }));
              }}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value="">Always show</option>
              {configuration.matchQuestions.filter((candidate) => candidate.key !== question.key && !candidate.archived).map((candidate) => <option key={candidate.key} value={candidate.key}>{candidate.label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-slate-400">
            <span>Condition equals</span>
            <input
              type="text"
              value={question.showWhen ? String(question.showWhen.equals) : ''}
              disabled={!canEdit || !question.showWhen}
              onChange={(event) => onChange(updateQuestion(configuration, question.key, { showWhen: question.showWhen ? { ...question.showWhen, equals: parseConditionValue(event.target.value, conditionReference) } : undefined }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white disabled:text-slate-500"
            />
          </label>
          <div className="flex items-end">
            {canEdit && (
              <button type="button" onClick={() => onChange(updateQuestion(configuration, question.key, { archived: !question.archived }))} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">
                {question.archived ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                {question.archived ? 'Restore question' : 'Archive question'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const addQuestion = () => {
    const nextOrder = configuration.matchQuestions.reduce((max, question) => Math.max(max, question.order), 0) + 10;
    onChange({ ...configuration, matchQuestions: [...configuration.matchQuestions, createCustomMatchQuestion(nextOrder)] });
  };

  const updateFilter = (index: number, update: Partial<AllianceFilterDefinition>) => {
    onChange({ ...configuration, allianceFilters: configuration.allianceFilters.map((filter, itemIndex) => itemIndex === index ? { ...filter, ...update } : filter) });
  };

  const updateRule = (index: number, update: Partial<ScoringRuleDefinition>) => {
    onChange({ ...configuration, scoringRules: configuration.scoringRules.map((rule, itemIndex) => itemIndex === index ? { ...rule, ...update } : rule) });
  };

  const updateAnalyticsMetric = (index: number, update: Partial<AnalyticsMetricDefinition>) => {
    onChange({ ...configuration, analyticsMetrics: configuration.analyticsMetrics.map((metric, itemIndex) => itemIndex === index ? { ...metric, ...update } : metric) });
  };

  return (
    <div className="space-y-5 rounded-xl border border-slate-700 bg-slate-800/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Match Configuration</p>
          <p className="mt-1 text-xs text-slate-400">Match questions, answer choices, number limits, display sections, and conditional visibility are shared across this database.</p>
        </div>
        {canEdit && <button type="button" onClick={addQuestion} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"><Plus className="h-3.5 w-3.5" />Add question</button>}
      </div>

      {!canEdit && <p className="rounded-lg border border-slate-700 bg-slate-950/50 p-3 text-xs text-slate-400">Only admins can change Match Configuration.</p>}

      <div className="space-y-3">{activeQuestions.map(renderQuestion)}</div>
      {archivedQuestions.length > 0 && <div className="space-y-3 border-t border-slate-700 pt-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Archived questions</p>{archivedQuestions.map(renderQuestion)}</div>}

      <div className="space-y-3 border-t border-slate-700 pt-4">
        <div>
          <p className="text-sm font-semibold text-white">Alliance Filters</p>
          <p className="mt-1 text-xs text-slate-400">These definitions are available to the Alliance Selection workspace.</p>
        </div>
        {configuration.allianceFilters.map((filter, index) => (
          <div key={`${filter.key}-${index}`} className="grid gap-2 rounded-lg border border-slate-700 bg-slate-900/60 p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <input value={filter.key} disabled={!canEdit} onChange={(event) => updateFilter(index, { key: event.target.value })} placeholder="Question key" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            <input value={filter.label} disabled={!canEdit} onChange={(event) => updateFilter(index, { label: event.target.value })} placeholder="Label" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            <select value={filter.source} disabled={!canEdit} onChange={(event) => updateFilter(index, { source: event.target.value as AllianceFilterDefinition['source'] })} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="pit">Pit</option><option value="match">Match</option></select>
            <select value={filter.type} disabled={!canEdit} onChange={(event) => updateFilter(index, { type: event.target.value as AllianceFilterDefinition['type'] })} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="boolean">Boolean</option><option value="text">Text</option><option value="number">Number</option><option value="single_choice">Choice</option><option value="multi_choice">Multiple choice</option></select>
            {canEdit && <button type="button" onClick={() => onChange({ ...configuration, allianceFilters: configuration.allianceFilters.filter((_, itemIndex) => itemIndex !== index) })} className="rounded-lg border border-rose-500/40 px-3 py-2 text-rose-200 hover:bg-rose-950/30" aria-label={`Remove ${filter.label}`}><Trash2 className="h-4 w-4" /></button>}
          </div>
        ))}
        {canEdit && <button type="button" onClick={() => onChange({ ...configuration, allianceFilters: [...configuration.allianceFilters, { key: `filter_${Date.now()}`, label: 'New filter', source: 'pit', type: 'text' }] })} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"><Plus className="h-3.5 w-3.5" />Add filter</button>}
      </div>

      <div className="space-y-3 border-t border-slate-700 pt-4">
        <div>
          <p className="text-sm font-semibold text-white">Scoring Rules</p>
          <p className="mt-1 text-xs text-slate-400">Enter one value per line using `answer=value`, for example `Level 1=10`.</p>
        </div>
        {configuration.scoringRules.map((rule, index) => (
          <div key={`${rule.key}-${index}`} className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/60 p-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <input value={rule.key} disabled={!canEdit} onChange={(event) => updateRule(index, { key: event.target.value })} placeholder="Question key" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
              <input value={rule.label} disabled={!canEdit} onChange={(event) => updateRule(index, { label: event.target.value })} placeholder="Rule label" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
              <select value={rule.source} disabled={!canEdit} onChange={(event) => updateRule(index, { source: event.target.value as ScoringRuleDefinition['source'] })} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="match">Match</option><option value="pit">Pit</option></select>
            </div>
            <textarea value={valuesText(rule)} disabled={!canEdit} onChange={(event) => updateRule(index, { values: parseValues(event.target.value) })} rows={3} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white" />
          </div>
        ))}
        {canEdit && <button type="button" onClick={() => onChange({ ...configuration, scoringRules: [...configuration.scoringRules, { key: `rule_${Date.now()}`, label: 'New scoring rule', source: 'match', values: {} }] })} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"><Plus className="h-3.5 w-3.5" />Add scoring rule</button>}
      </div>

      <div className="space-y-3 border-t border-slate-700 pt-4">
        <div>
          <p className="text-sm font-semibold text-white">Analytics Metrics</p>
          <p className="mt-1 text-xs text-slate-400">Control the labels, colors, and default visibility of the analytics graph metrics.</p>
        </div>
        {configuration.analyticsMetrics.map((metric, index) => (
          <div key={`${metric.key}-${index}`} className="grid gap-2 rounded-lg border border-slate-700 bg-slate-900/60 p-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center">
            <input value={metric.key} disabled className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-400" aria-label={`Analytics metric key for ${metric.label}`} />
            <input value={metric.label} disabled={!canEdit} onChange={(event) => updateAnalyticsMetric(index, { label: event.target.value })} placeholder="Metric label" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="color" value={metric.color} disabled={!canEdit} onChange={(event) => updateAnalyticsMetric(index, { color: event.target.value })} className="h-8 w-10 rounded border border-slate-700 bg-slate-950" />
              Color
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={metric.enabled} disabled={!canEdit} onChange={(event) => updateAnalyticsMetric(index, { enabled: event.target.checked })} />
              Enabled
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
