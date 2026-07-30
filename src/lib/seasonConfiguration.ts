import { storage } from './storage';
import {
  AllianceFilterDefinition,
  AnalyticsMetricDefinition,
  MatchQuestionDefinition,
  MatchQuestionType,
  PitQuestionVisibility,
  ScoringRuleDefinition,
  SeasonConfiguration,
} from '../types';
import { supabase } from './supabase';

export const SEASON_CONFIGURATION_UPDATED_EVENT = 'season-configuration-updated';
export const SEASON_CONFIGURATION_CACHE_KEY = 'global:seasonConfiguration';
export const SEASON_CONFIGURATION_ID = 'default';

const QUESTION_TYPES: MatchQuestionType[] = ['boolean', 'short_text', 'long_text', 'number', 'single_choice', 'multi_choice'];

export const DEFAULT_MATCH_QUESTION_DEFINITIONS: MatchQuestionDefinition[] = [
  { key: 'leftStartingZone', label: 'Left Starting Zone?', type: 'boolean', options: [], archived: false, order: 10, section: 'Autonomous Metrics' },
  { key: 'autoFuelScored', label: 'Scoring Count in Auto', type: 'number', options: [], archived: false, order: 20, section: 'Autonomous Metrics', min: 0, max: 100, step: 1 },
  { key: 'autoClimbAttempted', label: 'End Game Action Attempted in Auto?', type: 'boolean', options: [], archived: false, order: 30, section: 'Autonomous Metrics' },
  { key: 'autoClimbResult', label: 'Auto Result', type: 'single_choice', options: ['Successful', 'Attempted but Failed'], archived: false, order: 40, section: 'Autonomous Metrics', showWhen: { questionKey: 'autoClimbAttempted', equals: true } },
  { key: 'teleopFuelScored', label: 'Scoring Count in Teleop', type: 'number', options: [], archived: false, order: 50, section: 'Teleop Metrics', min: 0, max: 500, step: 1 },
  { key: 'avgBps', label: 'Average Actions per Second', type: 'number', options: [], archived: false, order: 60, section: 'Teleop Metrics', min: 0, max: 100, step: 0.1 },
  { key: 'shootingConsistency', label: 'Scoring Consistency', type: 'number', options: [], archived: false, order: 70, section: 'Teleop Metrics', min: 1, max: 5, step: 1 },
  { key: 'intakeConsistency', label: 'Intake Consistency', type: 'number', options: [], archived: false, order: 80, section: 'Teleop Metrics', min: 1, max: 5, step: 1 },
  { key: 'droveOverBump', label: 'Used Route A', type: 'boolean', options: [], archived: false, order: 90, section: 'Teleop Metrics' },
  { key: 'droveUnderTrench', label: 'Used Route B', type: 'boolean', options: [], archived: false, order: 100, section: 'Teleop Metrics' },
  { key: 'defenseEffectiveness', label: 'Defense Effectiveness', type: 'number', options: [], archived: false, order: 110, section: 'Defense', min: 1, max: 5, step: 1 },
  { key: 'defendedAgainst', label: 'Was Defended Against?', type: 'boolean', options: [], archived: false, order: 120, section: 'Defense' },
  { key: 'hubScoringStrategy', label: 'Scoring Strategy', type: 'single_choice', options: ['Prioritized scoring when active', 'Scored regardless of state', 'Collected or fed another robot'], archived: false, order: 130, section: 'Teleop Metrics' },
  { key: 'endGameClimbResult', label: 'End Game Result', type: 'single_choice', options: ['Did Not Attempt', 'Parked', 'Level 1', 'Level 2', 'Level 3', 'Attempted but Failed'], archived: false, order: 140, section: 'End Game' },
  { key: 'climbTimeSeconds', label: 'End Game Time (seconds)', type: 'number', options: [], archived: false, order: 150, section: 'End Game', min: 0, max: 180, step: 1 },
  { key: 'foulsCaused', label: 'Fouls Caused', type: 'number', options: [], archived: false, order: 160, section: 'Post-Match', min: 0, max: 20, step: 1 },
  { key: 'cardReceived', label: 'Card Received?', type: 'single_choice', options: ['None', 'Yellow', 'Red'], archived: false, order: 170, section: 'Post-Match' },
];

export const DEFAULT_ALLIANCE_FILTERS: AllianceFilterDefinition[] = [
  { key: 'driveTrainType', label: 'Drive Train Type', source: 'pit', type: 'single_choice' },
  { key: 'canClimbTower', label: 'Can Climb', source: 'pit', type: 'boolean' },
  { key: 'canPlayDefense', label: 'Can Play Defense', source: 'pit', type: 'boolean' },
  { key: 'fuelHopperCapacity', label: 'Capacity', source: 'pit', type: 'number' },
];

export const DEFAULT_SCORING_RULES: ScoringRuleDefinition[] = [
  { key: 'autoClimbResult', label: 'Auto Result Points', source: 'match', values: { Successful: 15, 'Attempted but Failed': 0 } },
  { key: 'endGameClimbResult', label: 'End Game Result Points', source: 'match', values: { 'Did Not Attempt': 0, Parked: 0, 'Level 1': 10, 'Level 2': 20, 'Level 3': 30, 'Attempted but Failed': 0 } },
];

export const DEFAULT_ANALYTICS_METRICS: AnalyticsMetricDefinition[] = [
  { key: 'total_points', label: 'Total EPA (unitless)', color: '#60a5fa', enabled: true },
  { key: 'auto_points', label: 'Auto', color: '#34d399', enabled: true },
  { key: 'teleop_points', label: 'Teleop', color: '#f59e0b', enabled: true },
  { key: 'endgame_points', label: 'Endgame', color: '#f472b6', enabled: true },
];

export const DEFAULT_SEASON_CONFIGURATION: SeasonConfiguration = {
  id: SEASON_CONFIGURATION_ID,
  seasonYear: new Date().getFullYear(),
  defaultEventKey: '',
  brandName: 'FRC Scout',
  gameName: 'Season Scouting',
  matchQuestions: DEFAULT_MATCH_QUESTION_DEFINITIONS,
  allianceFilters: DEFAULT_ALLIANCE_FILTERS,
  scoringRules: DEFAULT_SCORING_RULES,
  analyticsMetrics: DEFAULT_ANALYTICS_METRICS,
};

type SeasonConfigurationRow = {
  id: string;
  season_year: number;
  default_event_key: string | null;
  brand_name: string | null;
  game_name: string | null;
  match_questions: unknown;
  alliance_filters: unknown;
  scoring_rules: unknown;
  analytics_metrics: unknown;
  updated_at?: string;
  created_at?: string;
};

let loadedConfiguration: SeasonConfiguration | null = null;
let loadingConfiguration: Promise<SeasonConfiguration> | null = null;

function cloneVisibility(value: PitQuestionVisibility | undefined): PitQuestionVisibility | undefined {
  return value ? { ...value } : undefined;
}

function cloneQuestion(question: MatchQuestionDefinition): MatchQuestionDefinition {
  return { ...question, options: [...question.options], showWhen: cloneVisibility(question.showWhen) };
}

function cloneConfiguration(configuration: SeasonConfiguration): SeasonConfiguration {
  return {
    ...configuration,
    matchQuestions: configuration.matchQuestions.map(cloneQuestion),
    allianceFilters: configuration.allianceFilters.map((filter) => ({ ...filter })),
    scoringRules: configuration.scoringRules.map((rule) => ({ ...rule, values: { ...rule.values } })),
    analyticsMetrics: configuration.analyticsMetrics.map((metric) => ({ ...metric })),
  };
}

function normalizeVisibility(value: unknown): PitQuestionVisibility | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.questionKey !== 'string' || !candidate.questionKey.trim()) {
    return undefined;
  }

  if (typeof candidate.equals !== 'string' && typeof candidate.equals !== 'number' && typeof candidate.equals !== 'boolean') {
    return undefined;
  }

  return { questionKey: candidate.questionKey.trim(), equals: candidate.equals };
}

function normalizeQuestion(value: unknown, index: number): MatchQuestionDefinition | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<MatchQuestionDefinition>;
  const key = typeof candidate.key === 'string' ? candidate.key.trim() : '';
  const label = typeof candidate.label === 'string' ? candidate.label.trim() : '';
  if (!key || !label || !QUESTION_TYPES.includes(candidate.type as MatchQuestionType)) {
    return null;
  }

  const options = Array.from(new Set((Array.isArray(candidate.options) ? candidate.options : [])
    .filter((option): option is string => typeof option === 'string')
    .map((option) => option.trim())
    .filter(Boolean)));

  return {
    key,
    label,
    type: candidate.type as MatchQuestionType,
    options: candidate.type === 'single_choice' || candidate.type === 'multi_choice' ? options : [],
    archived: Boolean(candidate.archived),
    order: Number.isFinite(candidate.order) ? Number(candidate.order) : (index + 1) * 10,
    section: typeof candidate.section === 'string' && candidate.section.trim() ? candidate.section.trim() : 'Match Questions',
    showWhen: normalizeVisibility(candidate.showWhen),
    min: Number.isFinite(candidate.min) ? Number(candidate.min) : undefined,
    max: Number.isFinite(candidate.max) ? Number(candidate.max) : undefined,
    step: Number.isFinite(candidate.step) ? Number(candidate.step) : undefined,
  };
}

function normalizeConfiguration(value: Partial<SeasonConfiguration>): SeasonConfiguration {
  const questions = (Array.isArray(value.matchQuestions) ? value.matchQuestions : [])
    .map((question, index) => normalizeQuestion(question, index))
    .filter((question): question is MatchQuestionDefinition => Boolean(question));

  const analyticsMetrics = (Array.isArray(value.analyticsMetrics) ? value.analyticsMetrics : [])
    .filter((metric): metric is AnalyticsMetricDefinition => Boolean(metric) && typeof metric === 'object')
    .map((metric) => ({
      key: typeof metric.key === 'string' ? metric.key.trim() : '',
      label: typeof metric.label === 'string' ? metric.label.trim() : '',
      color: typeof metric.color === 'string' && metric.color.trim() ? metric.color.trim() : '#60a5fa',
      enabled: metric.enabled !== false,
    }))
    .filter((metric) => metric.key && metric.label);

  return {
    id: SEASON_CONFIGURATION_ID,
    seasonYear: Number.isInteger(value.seasonYear) && Number(value.seasonYear) > 0
      ? Number(value.seasonYear)
      : DEFAULT_SEASON_CONFIGURATION.seasonYear,
    defaultEventKey: typeof value.defaultEventKey === 'string' ? value.defaultEventKey.trim().toLowerCase() : '',
    brandName: typeof value.brandName === 'string' && value.brandName.trim() ? value.brandName.trim() : DEFAULT_SEASON_CONFIGURATION.brandName,
    gameName: typeof value.gameName === 'string' && value.gameName.trim() ? value.gameName.trim() : DEFAULT_SEASON_CONFIGURATION.gameName,
    matchQuestions: questions.length > 0 ? questions.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)) : DEFAULT_MATCH_QUESTION_DEFINITIONS.map(cloneQuestion),
    allianceFilters: Array.isArray(value.allianceFilters) ? value.allianceFilters.filter(Boolean).map((filter) => ({ ...filter })) : DEFAULT_ALLIANCE_FILTERS.map((filter) => ({ ...filter })),
    scoringRules: Array.isArray(value.scoringRules) ? value.scoringRules.filter(Boolean).map((rule) => ({ ...rule, values: { ...(rule.values || {}) } })) : DEFAULT_SCORING_RULES.map((rule) => ({ ...rule, values: { ...rule.values } })),
    analyticsMetrics: analyticsMetrics.length > 0 ? analyticsMetrics : DEFAULT_ANALYTICS_METRICS.map((metric) => ({ ...metric })),
  };
}

function rowToConfiguration(row: SeasonConfigurationRow): SeasonConfiguration {
  return normalizeConfiguration({
    seasonYear: row.season_year,
    defaultEventKey: row.default_event_key || '',
    brandName: row.brand_name || '',
    gameName: row.game_name || '',
    matchQuestions: row.match_questions as MatchQuestionDefinition[],
    allianceFilters: row.alliance_filters as AllianceFilterDefinition[],
    scoringRules: row.scoring_rules as ScoringRuleDefinition[],
    analyticsMetrics: row.analytics_metrics as AnalyticsMetricDefinition[],
  });
}

function cacheConfiguration(configuration: SeasonConfiguration): void {
  storage.set(SEASON_CONFIGURATION_CACHE_KEY, configuration);
}

export function getCachedSeasonConfiguration(): SeasonConfiguration | null {
  const cached = storage.get<Partial<SeasonConfiguration>>(SEASON_CONFIGURATION_CACHE_KEY);
  return cached ? normalizeConfiguration(cached) : null;
}

export async function loadSeasonConfiguration(): Promise<SeasonConfiguration> {
  if (loadedConfiguration) {
    return cloneConfiguration(loadedConfiguration);
  }
  if (loadingConfiguration) {
    return cloneConfiguration(await loadingConfiguration);
  }

  loadingConfiguration = loadSeasonConfigurationInternal();
  try {
    loadedConfiguration = await loadingConfiguration;
    return cloneConfiguration(loadedConfiguration);
  } finally {
    loadingConfiguration = null;
  }
}

async function loadSeasonConfigurationInternal(): Promise<SeasonConfiguration> {
  const cached = getCachedSeasonConfiguration();

  try {
    const { data, error } = await supabase
      .from('season_configurations')
      .select('id, season_year, default_event_key, brand_name, game_name, match_questions, alliance_filters, scoring_rules, analytics_metrics, updated_at, created_at')
      .eq('id', SEASON_CONFIGURATION_ID)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || 'Failed to load season configuration.');
    }

    if (data) {
      const configuration = rowToConfiguration(data as SeasonConfigurationRow);
      cacheConfiguration(configuration);
      return configuration;
    }

    const defaults = normalizeConfiguration(DEFAULT_SEASON_CONFIGURATION);
    await saveSeasonConfiguration(defaults, false);
    return defaults;
  } catch (error) {
    console.warn('Season configuration is unavailable; using cached/default configuration.', error);
    return cached || normalizeConfiguration(DEFAULT_SEASON_CONFIGURATION);
  }
}

export function validateSeasonConfiguration(configuration: SeasonConfiguration): string | null {
  if (!Number.isInteger(configuration.seasonYear) || configuration.seasonYear <= 0) {
    return 'Season year must be a positive whole number.';
  }

  const keys = new Set<string>();
  for (const question of configuration.matchQuestions) {
    if (!question.key.trim() || !question.label.trim()) {
      return 'Every Match question needs a key and label.';
    }
    if (keys.has(question.key)) {
      return `The Match question key "${question.key}" is duplicated.`;
    }
    keys.add(question.key);
    if (!QUESTION_TYPES.includes(question.type)) {
      return `Unsupported Match question type for "${question.label}".`;
    }
    if ((question.type === 'single_choice' || question.type === 'multi_choice') && question.options.length === 0) {
      return `Add at least one choice for "${question.label}".`;
    }
  }

  return null;
}

async function saveSeasonConfiguration(configuration: SeasonConfiguration, requireAdmin: boolean): Promise<SeasonConfiguration> {
  if (requireAdmin && !configuration) {
    throw new Error('A season configuration is required.');
  }

  const normalized = normalizeConfiguration(configuration);
  const validationError = validateSeasonConfiguration(normalized);
  if (validationError) {
    throw new Error(validationError);
  }

  const { data, error } = await supabase
    .from('season_configurations')
    .upsert({
      id: SEASON_CONFIGURATION_ID,
      season_year: normalized.seasonYear,
      default_event_key: normalized.defaultEventKey || null,
      brand_name: normalized.brandName,
      game_name: normalized.gameName,
      match_questions: normalized.matchQuestions,
      alliance_filters: normalized.allianceFilters,
      scoring_rules: normalized.scoringRules,
      analytics_metrics: normalized.analyticsMetrics,
    }, { onConflict: 'id' })
    .select('id, season_year, default_event_key, brand_name, game_name, match_questions, alliance_filters, scoring_rules, analytics_metrics, updated_at, created_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to save season configuration.');
  }

  const saved = rowToConfiguration(data as SeasonConfigurationRow);
  loadedConfiguration = saved;
  cacheConfiguration(saved);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SEASON_CONFIGURATION_UPDATED_EVENT, { detail: saved }));
  }
  return cloneConfiguration(saved);
}

export async function saveSeasonConfigurationAsAdmin(configuration: SeasonConfiguration): Promise<SeasonConfiguration> {
  return saveSeasonConfiguration(configuration, true);
}

export function getDefaultMatchAnswer(type: MatchQuestionType): boolean | number | string | string[] | null {
  switch (type) {
    case 'boolean': return false;
    case 'number': return null;
    case 'multi_choice': return [];
    default: return '';
  }
}

export function getMatchAnswer(payload: unknown, key: string): boolean | number | string | string[] | null | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }
  const record = payload as Record<string, unknown>;
  const answers = record.answers;
  if (answers && typeof answers === 'object' && !Array.isArray(answers) && Object.prototype.hasOwnProperty.call(answers, key)) {
    return (answers as Record<string, boolean | number | string | string[] | null>)[key];
  }
  if (Object.prototype.hasOwnProperty.call(record, key)) {
    return record[key] as boolean | number | string | string[] | null;
  }
  return undefined;
}

export function isMatchQuestionVisible(payload: unknown, question: MatchQuestionDefinition): boolean {
  if (!question.showWhen) {
    return true;
  }
  const answer = getMatchAnswer(payload, question.showWhen.questionKey);
  if (Array.isArray(answer)) {
    return typeof question.showWhen.equals === 'string' && answer.includes(question.showWhen.equals);
  }
  return answer === question.showWhen.equals;
}
