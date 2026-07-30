import { supabase } from './supabase';
import { PitQuestionDefinition, PitQuestionType, PitQuestionVisibility } from '../types';

const PIT_QUESTION_TABLE = 'pit_question_definitions';

type PitQuestionRow = {
  key: string;
  label: string;
  question_type: PitQuestionType;
  options: unknown;
  archived: boolean;
  display_order: number;
  section: PitQuestionDefinition['section'];
  built_in: boolean;
  show_when: unknown;
};

function normalizeOptions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.filter((option): option is string => typeof option === 'string')
    .map((option) => option.trim())
    .filter(Boolean)));
}

function normalizeVisibility(value: unknown): PitQuestionVisibility | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.questionKey !== 'string' || !candidate.questionKey.trim()) {
    return undefined;
  }

  const equals = candidate.equals;
  if (typeof equals !== 'string' && typeof equals !== 'number' && typeof equals !== 'boolean') {
    return undefined;
  }

  return { questionKey: candidate.questionKey.trim(), equals };
}

export function rowToPitQuestion(row: PitQuestionRow): PitQuestionDefinition {
  return {
    key: row.key,
    label: row.label,
    type: row.question_type,
    options: normalizeOptions(row.options),
    archived: Boolean(row.archived),
    order: Number.isFinite(row.display_order) ? row.display_order : 0,
    section: row.section || 'Custom Questions',
    builtIn: Boolean(row.built_in),
    showWhen: normalizeVisibility(row.show_when),
  };
}

export async function fetchPitQuestionDefinitions(): Promise<PitQuestionDefinition[]> {
  const { data, error } = await supabase
    .from(PIT_QUESTION_TABLE)
    .select('key, label, question_type, options, archived, display_order, section, built_in, show_when')
    .order('display_order', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Failed to load Pit Scouting questions.');
  }

  return ((data || []) as PitQuestionRow[]).map(rowToPitQuestion);
}

export async function upsertPitQuestionDefinitions(definitions: PitQuestionDefinition[]): Promise<void> {
  const rows = definitions.map((definition) => ({
    key: definition.key,
    label: definition.label,
    question_type: definition.type,
    options: definition.options,
    archived: definition.archived,
    display_order: definition.order,
    section: definition.section,
    built_in: Boolean(definition.builtIn),
    show_when: definition.showWhen || null,
  }));

  const { error } = await supabase
    .from(PIT_QUESTION_TABLE)
    .upsert(rows, { onConflict: 'key' });

  if (error) {
    throw new Error(error.message || 'Failed to save Pit Scouting questions.');
  }
}

export async function fetchPitScoutPayloads(): Promise<unknown[]> {
  const { data, error } = await supabase
    .from('pit_scouts')
    .select('data');

  if (error) {
    throw new Error(error.message || 'Failed to inspect Pit Scouting answers.');
  }

  return (data || []).map((row) => (row as { data: unknown }).data);
}
