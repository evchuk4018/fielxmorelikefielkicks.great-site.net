import { extractEventKeyFromMatchKey } from '../lib/matchUtils';
import { listAllScoutedMatchEntries, ScoutedMatchEntry } from '../lib/supabase';
import { storage } from '../lib/storage';
import { MatchScoutData, SyncRecord, TBAMatch } from '../types';
import { getMatchEventKey } from './matchData';

export type PrescoutingScoutedIndex = {
  byTeamAndMatchKey: Set<string>;
  byTeamAndEventMatch: Set<string>;
  entries: ScoutedMatchEntry[];
};

function toFiniteInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function normalizeMatchKey(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeEventKey(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function teamMatchKey(teamNumber: number, matchKey: string): string {
  return `${teamNumber}|${matchKey}`;
}

function teamEventMatchKey(teamNumber: number, eventKey: string, matchNumber: number): string {
  return `${teamNumber}|${eventKey}|${matchNumber}`;
}

function toScoutedEntryFromLocalRecord(record: SyncRecord<MatchScoutData>): ScoutedMatchEntry | null {
  const payload = record.data;
  const teamNumber = toFiniteInteger(payload?.teamNumber);
  if (!teamNumber) {
    return null;
  }

  const matchNumber = toFiniteInteger(payload?.matchNumber);
  const matchKey = normalizeMatchKey(payload?.matchKey);
  const eventKey = normalizeEventKey(payload?.eventKey) || extractEventKeyFromMatchKey(matchKey);

  return {
    teamNumber,
    matchNumber,
    eventKey,
    matchKey,
  };
}

function readLocalScoutedEntries(): ScoutedMatchEntry[] {
  return storage
    .getKeysByPrefix('matchScout:')
    .map((key) => storage.get<SyncRecord<MatchScoutData>>(key))
    .filter((record): record is SyncRecord<MatchScoutData> => Boolean(record && record.type === 'matchScout'))
    .map((record) => toScoutedEntryFromLocalRecord(record))
    .filter((entry): entry is ScoutedMatchEntry => Boolean(entry));
}

export async function loadPrescoutingScoutedIndex(): Promise<PrescoutingScoutedIndex> {
  const [remote, local] = await Promise.all([
    listAllScoutedMatchEntries(),
    Promise.resolve(readLocalScoutedEntries()),
  ]);

  const merged = [...remote, ...local];
  const byTeamAndMatchKey = new Set<string>();
  const byTeamAndEventMatch = new Set<string>();

  merged.forEach((entry) => {
    if (entry.matchKey) {
      byTeamAndMatchKey.add(teamMatchKey(entry.teamNumber, entry.matchKey));
    }

    if (entry.eventKey && typeof entry.matchNumber === 'number' && Number.isInteger(entry.matchNumber)) {
      byTeamAndEventMatch.add(teamEventMatchKey(entry.teamNumber, entry.eventKey, entry.matchNumber));
    }
  });

  return {
    byTeamAndMatchKey,
    byTeamAndEventMatch,
    entries: merged,
  };
}

export function isTeamMatchAlreadyScouted(index: PrescoutingScoutedIndex, teamNumber: number, match: TBAMatch): boolean {
  const normalizedMatchKey = normalizeMatchKey(match.key);
  if (normalizedMatchKey && index.byTeamAndMatchKey.has(teamMatchKey(teamNumber, normalizedMatchKey))) {
    return true;
  }

  const eventKey = getMatchEventKey(match);
  if (eventKey && Number.isInteger(match.match_number)) {
    return index.byTeamAndEventMatch.has(teamEventMatchKey(teamNumber, eventKey, match.match_number));
  }

  return false;
}
