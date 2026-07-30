import { v4 as uuidv4 } from 'uuid';
import { PitAnswer, PitAnswers, PitQuestionDefinition, PitQuestionSection, PitQuestionType } from '../types';
import { storage } from './storage';
import {
  fetchPitQuestionDefinitions,
  fetchPitScoutPayloads,
  upsertPitQuestionDefinitions,
} from './pitQuestionRepository';

export const PIT_QUESTIONS_UPDATED_EVENT = 'pit-questions-updated';
export const PIT_QUESTIONS_CACHE_KEY = 'global:pitQuestionDefinitions';

const QUESTION_TYPES: PitQuestionType[] = ['boolean', 'short_text', 'long_text', 'number', 'single_choice', 'multi_choice'];
const QUESTION_SECTIONS: PitQuestionSection[] = ['Robot Details', 'Game Mechanisms', 'Strategy & Notes', 'Custom Questions'];
let loadedDefinitions: PitQuestionDefinition[] | null = null;
let loadingDefinitions: Promise<PitQuestionDefinition[]> | null = null;

export const DEFAULT_PIT_QUESTION_DEFINITIONS: PitQuestionDefinition[] = [
  {
    key: 'chassisWidth', label: 'Chassis Width (in)', type: 'number', options: [], archived: false, order: 10, section: 'Robot Details', builtIn: true,
  },
  {
    key: 'chassisLength', label: 'Chassis Length (in)', type: 'number', options: [], archived: false, order: 20, section: 'Robot Details', builtIn: true,
  },
  {
    key: 'driveTrainType', label: 'Drive Train Type', type: 'single_choice', options: ['Tank', 'Swerve', 'Mecanum', 'H-Drive', 'Other'], archived: false, order: 30, section: 'Robot Details', builtIn: true,
  },
  {
    key: 'driveTrainOther', label: 'Drive Train (Other)', type: 'short_text', options: [], archived: false, order: 40, section: 'Robot Details', builtIn: true,
    showWhen: { questionKey: 'driveTrainType', equals: 'Other' },
  },
  {
    key: 'driveMotors', label: 'Drive Motors', type: 'multi_choice', options: ['Falcon 500 / Kraken X60', 'NEO', 'NEO Vortex', 'CIM', 'MiniCIM', 'Other'], archived: false, order: 50, section: 'Robot Details', builtIn: true,
  },
  {
    key: 'fuelHopperCapacity', label: 'Fuel Hopper Capacity', type: 'number', options: [], archived: false, order: 60, section: 'Game Mechanisms', builtIn: true,
  },
  {
    key: 'intakePosition', label: 'Intake Position', type: 'single_choice', options: ['Over the bumper', 'Under the bumper', 'Both'], archived: false, order: 70, section: 'Game Mechanisms', builtIn: true,
  },
  {
    key: 'shooterType', label: 'Shooter Type', type: 'single_choice', options: ['Single shooter', 'Multi-shooter'], archived: false, order: 80, section: 'Game Mechanisms', builtIn: true,
  },
  {
    key: 'hasTurret', label: 'Has Turret?', type: 'boolean', options: [], archived: false, order: 90, section: 'Game Mechanisms', builtIn: true,
  },
  {
    key: 'canDriveOverBump', label: 'Can drive over Bump (~6.5in)', type: 'boolean', options: [], archived: false, order: 100, section: 'Game Mechanisms', builtIn: true,
  },
  {
    key: 'canDriveUnderTrench', label: 'Can drive under Trench (~40in)', type: 'boolean', options: [], archived: false, order: 110, section: 'Game Mechanisms', builtIn: true,
  },
  {
    key: 'canClimbTower', label: 'Can climb Tower?', type: 'boolean', options: [], archived: false, order: 120, section: 'Game Mechanisms', builtIn: true,
  },
  {
    key: 'maxClimbLevel', label: 'Maximum Climb Level', type: 'single_choice', options: ['Level 1', 'Level 2', 'Level 3'], archived: false, order: 130, section: 'Game Mechanisms', builtIn: true,
    showWhen: { questionKey: 'canClimbTower', equals: true },
  },
  {
    key: 'canPlayDefense', label: 'Defense Capability?', type: 'boolean', options: [], archived: false, order: 140, section: 'Strategy & Notes', builtIn: true,
  },
  {
    key: 'defenseStyle', label: 'Defense Style', type: 'long_text', options: [], archived: false, order: 150, section: 'Strategy & Notes', builtIn: true,
    showWhen: { questionKey: 'canPlayDefense', equals: true },
  },
  {
    key: 'autoDescription', label: 'Autonomous Description', type: 'long_text', options: [], archived: false, order: 160, section: 'Strategy & Notes', builtIn: true,
  },
  {
    key: 'visionSetup', label: 'Vision Setup', type: 'long_text', options: [], archived: false, order: 170, section: 'Strategy & Notes', builtIn: true,
  },
  {
    key: 'looksGood', label: 'Does it look good?', type: 'single_choice', options: ['Yes', 'No', 'Mid'], archived: false, order: 180, section: 'Strategy & Notes', builtIn: true,
  },
  {
    key: 'notes', label: 'Additional Notes', type: 'long_text', options: [], archived: false, order: 190, section: 'Strategy & Notes', builtIn: true,
  },
];

function cloneDefinitions(definitions: PitQuestionDefinition[]): PitQuestionDefinition[] {
  return definitions.map((definition) => ({
    ...definition,
    options: [...definition.options],
    showWhen: definition.showWhen ? { ...definition.showWhen } : undefined,
  }));
}

function normalizeDefinition(definition: PitQuestionDefinition): PitQuestionDefinition {
  const type = QUESTION_TYPES.includes(definition.type) ? definition.type : 'short_text';
  const section = QUESTION_SECTIONS.includes(definition.section) ? definition.section : 'Custom Questions';
  const options = Array.from(new Set((definition.options || [])
    .filter((option): option is string => typeof option === 'string')
    .map((option) => option.trim())
    .filter(Boolean)));

  return {
    ...definition,
    key: definition.key.trim(),
    label: definition.label.trim(),
    type,
    options: type === 'single_choice' || type === 'multi_choice' ? options : [],
    archived: Boolean(definition.archived),
    order: Number.isFinite(definition.order) ? definition.order : 0,
    section,
  };
}

function sortDefinitions(definitions: PitQuestionDefinition[]): PitQuestionDefinition[] {
  return cloneDefinitions(definitions)
    .map(normalizeDefinition)
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

export function getCachedPitQuestionDefinitions(): PitQuestionDefinition[] | null {
  const cached = storage.get<PitQuestionDefinition[]>(PIT_QUESTIONS_CACHE_KEY);
  return cached ? sortDefinitions(cached) : null;
}

export async function loadPitQuestionDefinitions(): Promise<PitQuestionDefinition[]> {
  if (loadedDefinitions) {
    return cloneDefinitions(loadedDefinitions);
  }
  if (loadingDefinitions) {
    return cloneDefinitions(await loadingDefinitions);
  }

  loadingDefinitions = loadPitQuestionDefinitionsInternal();
  try {
    loadedDefinitions = await loadingDefinitions;
    return cloneDefinitions(loadedDefinitions);
  } finally {
    loadingDefinitions = null;
  }
}

async function loadPitQuestionDefinitionsInternal(): Promise<PitQuestionDefinition[]> {
  const cached = getCachedPitQuestionDefinitions();

  try {
    const remote = await fetchPitQuestionDefinitions();
    if (remote.length > 0) {
      const remoteKeys = new Set(remote.map((definition) => definition.key));
      const missingDefaults = DEFAULT_PIT_QUESTION_DEFINITIONS.filter((definition) => !remoteKeys.has(definition.key));
      const definitions = sortDefinitions([...remote, ...missingDefaults]);
      if (missingDefaults.length > 0) {
        try {
          await upsertPitQuestionDefinitions(missingDefaults);
        } catch {
          // A read-only deployment can still use the merged local definitions.
        }
      }
      storage.set(PIT_QUESTIONS_CACHE_KEY, definitions);
      return definitions;
    }

    const defaults = sortDefinitions(DEFAULT_PIT_QUESTION_DEFINITIONS);
    try {
      await upsertPitQuestionDefinitions(defaults);
    } catch {
      // The app remains usable with the defaults when an older deployment has not run schema.sql yet.
    }
    storage.set(PIT_QUESTIONS_CACHE_KEY, defaults);
    return defaults;
  } catch {
    return cached || sortDefinitions(DEFAULT_PIT_QUESTION_DEFINITIONS);
  }
}

export function validatePitQuestionDefinitions(definitions: PitQuestionDefinition[]): string | null {
  const keys = new Set<string>();

  for (const definition of definitions) {
    if (!definition.key.trim()) {
      return 'Every question needs a stable key.';
    }
    if (!definition.label.trim()) {
      return 'Every question needs question text.';
    }
    if (keys.has(definition.key)) {
      return `The question key "${definition.key}" is duplicated.`;
    }
    keys.add(definition.key);

    if (!QUESTION_TYPES.includes(definition.type)) {
      return `Unsupported question type for "${definition.label}".`;
    }

    if ((definition.type === 'single_choice' || definition.type === 'multi_choice') && definition.options.length === 0) {
      return `Add at least one choice for "${definition.label}".`;
    }
    if (definition.options.some((option) => !option.trim())) {
      return `Choices for "${definition.label}" cannot be empty.`;
    }
    if (new Set(definition.options.map((option) => option.trim().toLowerCase())).size !== definition.options.length) {
      return `Choices for "${definition.label}" must be unique.`;
    }
  }

  return null;
}

export async function savePitQuestionDefinitions(definitions: PitQuestionDefinition[]): Promise<PitQuestionDefinition[]> {
  const normalized = sortDefinitions(definitions);
  const validationError = validatePitQuestionDefinitions(normalized);
  if (validationError) {
    throw new Error(validationError);
  }

  await upsertPitQuestionDefinitions(normalized);
  loadedDefinitions = normalized;
  storage.set(PIT_QUESTIONS_CACHE_KEY, normalized);
  window.dispatchEvent(new CustomEvent(PIT_QUESTIONS_UPDATED_EVENT, { detail: normalized }));
  return normalized;
}

export function createCustomPitQuestion(label = 'New Pit Question', order = 1000): PitQuestionDefinition {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'question';
  return {
    key: `custom_${slug}_${uuidv4().slice(0, 8)}`,
    label,
    type: 'short_text',
    options: [],
    archived: false,
    order,
    section: 'Custom Questions',
  };
}

export function getPitAnswer(payload: unknown, questionKey: string): PitAnswer | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const answers = record.answers;
  if (answers && typeof answers === 'object' && !Array.isArray(answers)) {
    const answerMap = answers as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(answerMap, questionKey)) {
      return answerMap[questionKey] as PitAnswer;
    }
  }

  if (Object.prototype.hasOwnProperty.call(record, questionKey)) {
    return record[questionKey] as PitAnswer;
  }

  return undefined;
}

export function getPitAnswers(payload: unknown): PitAnswers {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }

  const answers = (payload as Record<string, unknown>).answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return {};
  }

  return answers as PitAnswers;
}

export function hasPitAnswerValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

export function hasPitQuestionAnswer(payload: unknown, questionKey: string): boolean {
  return hasPitAnswerValue(getPitAnswer(payload, questionKey));
}

export function getDefaultPitAnswer(type: PitQuestionType): PitAnswer {
  switch (type) {
    case 'boolean':
      return false;
    case 'number':
      return null;
    case 'multi_choice':
      return [];
    default:
      return '';
  }
}

export function isPitQuestionVisible(payload: unknown, definition: PitQuestionDefinition): boolean {
  if (!definition.showWhen) {
    return true;
  }

  return getPitAnswer(payload, definition.showWhen.questionKey) === definition.showWhen.equals;
}

export async function hasAnyPitQuestionAnswers(questionKey: string): Promise<boolean> {
  const localKeys = storage.getKeysByPrefix('pitScout:');
  for (const key of localKeys) {
    const record = storage.get<{ data?: unknown }>(key);
    if (record?.data && hasPitQuestionAnswer(record.data, questionKey)) {
      return true;
    }
  }

  try {
    const payloads = await fetchPitScoutPayloads();
    return payloads.some((payload) => hasPitQuestionAnswer(payload, questionKey));
  } catch {
    return false;
  }
}
