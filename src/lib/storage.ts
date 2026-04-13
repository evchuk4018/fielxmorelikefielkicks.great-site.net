import { v4 as uuidv4 } from 'uuid';
import { SyncRecord } from '../types';

const SYNC_QUEUE_KEY = 'syncQueue';

type MatchScoutKeyInput = {
  teamNumber: number | string;
  matchNumber?: number | string | null;
  matchKey?: string | null;
};

function toMatchScoutKeyNumber(value: number | string | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function normalizeMatchScoutMatchKey(value: string | null | undefined): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toLowerCase();
}

function getDeterministicMatchScoutId(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }

  const payload = data as Record<string, unknown>;
  const teamNumber = toMatchScoutKeyNumber(payload.teamNumber as number | string | null | undefined);
  const matchKey = normalizeMatchScoutMatchKey(payload.matchKey as string | null | undefined);
  if (!teamNumber || !matchKey) {
    return null;
  }

  return `matchScout:${teamNumber}:${matchKey}`;
}

export function buildMatchScoutStorageKey(input: MatchScoutKeyInput): string {
  const teamNumber = toMatchScoutKeyNumber(input.teamNumber);
  if (!teamNumber) {
    throw new Error('A valid team number is required for match scout storage key');
  }

  const matchKey = normalizeMatchScoutMatchKey(input.matchKey);
  if (matchKey) {
    return `matchScout:${matchKey}:${teamNumber}`;
  }

  const matchNumber = toMatchScoutKeyNumber(input.matchNumber);
  if (!matchNumber) {
    throw new Error('A valid match number or match key is required for match scout storage key');
  }

  return `matchScout:${matchNumber}:${teamNumber}`;
}

export function getMatchScoutStorageKeyCandidates(input: MatchScoutKeyInput): string[] {
  const teamNumber = toMatchScoutKeyNumber(input.teamNumber);
  if (!teamNumber) {
    return [];
  }

  const keys: string[] = [];
  const matchKey = normalizeMatchScoutMatchKey(input.matchKey);
  const matchNumber = toMatchScoutKeyNumber(input.matchNumber);

  if (matchKey) {
    keys.push(`matchScout:${matchKey}:${teamNumber}`);
  }

  if (matchNumber) {
    keys.push(`matchScout:${matchNumber}:${teamNumber}`);
  }

  return Array.from(new Set(keys));
}

export function get<T>(key: string): T | null {
  const item = localStorage.getItem(key);
  return item ? JSON.parse(item) : null;
}

export function set<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getAllKeys(): string[] {
  return Object.keys(localStorage);
}

export function getKeysByPrefix(prefixes: string | string[]): string[] {
  const normalizedPrefixes = Array.isArray(prefixes)
    ? prefixes.filter((prefix) => typeof prefix === 'string' && prefix.length > 0)
    : [prefixes].filter((prefix) => typeof prefix === 'string' && prefix.length > 0);

  if (normalizedPrefixes.length === 0) {
    return [];
  }

  return Object.keys(localStorage).filter((key) => normalizedPrefixes.some((prefix) => key.startsWith(prefix)));
}

export function saveRecord<T>(type: 'pitScout' | 'matchScout', key: string, data: T): void {
  const existingRecord = get<SyncRecord<T>>(key);
  const deterministicId = type === 'matchScout' ? getDeterministicMatchScoutId(data) : null;
  
  const record: SyncRecord<T> = {
    id: existingRecord?.id || deterministicId || uuidv4(),
    type,
    timestamp: Date.now(),
    data,
  };

  // Save locally
  set(key, record);

  // Add to sync queue
  const queue = get<SyncRecord<any>[]>(SYNC_QUEUE_KEY) || [];
  const existingIndex = queue.findIndex(r => r.id === record.id);
  if (existingIndex >= 0) {
    queue[existingIndex] = record;
  } else {
    queue.push(record);
  }
  
  set(SYNC_QUEUE_KEY, queue);
}

export function getSyncQueue(): SyncRecord<any>[] {
  return get<SyncRecord<any>[]>(SYNC_QUEUE_KEY) || [];
}

export function removeFromSyncQueue(ids: string[]): void {
  const queue = getSyncQueue();
  const newQueue = queue.filter(r => !ids.includes(r.id));
  set(SYNC_QUEUE_KEY, newQueue);
}

export function clearSyncQueue(): void {
  set(SYNC_QUEUE_KEY, []);
}

export function deleteKey(key: string): void {
  localStorage.removeItem(key);
}

export function removeMatchScoutRecordById(recordId: string): void {
  const queue = getSyncQueue();
  const queueWithoutRecord = queue.filter((record) => record.id !== recordId);
  set(SYNC_QUEUE_KEY, queueWithoutRecord);

  const keys = getAllKeys().filter((key) => key.startsWith('matchScout:'));
  keys.forEach((key) => {
    const record = get<SyncRecord<any>>(key);
    if (record?.id === recordId) {
      deleteKey(key);
    }
  });
}

export function removeMatchScoutRecordByKey(key: string): void {
  const record = get<SyncRecord<any>>(key);
  if (!record) {
    deleteKey(key);
    return;
  }

  removeMatchScoutRecordById(record.id);
}

export const storage = {
  get,
  set,
  getAllKeys,
  getKeysByPrefix,
  buildMatchScoutStorageKey,
  getMatchScoutStorageKeyCandidates,
  saveRecord,
  getSyncQueue,
  removeFromSyncQueue,
  clearSyncQueue,
  deleteKey,
  removeMatchScoutRecordById,
  removeMatchScoutRecordByKey
};
