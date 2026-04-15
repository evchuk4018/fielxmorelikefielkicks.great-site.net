import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { getProfileTeams } from '../lib/competitionProfiles';
import { statbotics, StatboticsTeamEvent } from '../lib/statbotics';
import { storage } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { tba } from '../lib/tba';
import { MatchScoutData, PitScoutData, SyncRecord, TBARanking, TBARankings, TBATeam } from '../types';

type AllianceSelectionProps = {
  eventKey: string;
  profileId: string | null;
};

type TeamNoteSummary = {
  pitNote: string | null;
  matchNotes: string[];
  noteCount: number;
};

type AllianceBoardRow = {
  teamNumber: number;
  teamName: string;
  tbaRank: number | null;
  epaTotal: number | null;
  epaAuto: number | null;
  epaTeleop: number | null;
  epaEndgame: number | null;
  notes: TeamNoteSummary;
};

type MatchNoteLine = {
  teamNumber: number;
  text: string;
  updatedAt: number;
};

type SupabaseScoutingRow = {
  team_number?: number | null;
  event_key?: string | null;
  data: unknown;
  updated_at?: string | null;
};

const REFRESH_INTERVAL_MS = 45000;

function normalizeEventKey(value: string): string {
  return value.trim().toLowerCase();
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizePayload(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseTeamKey(teamKey: unknown): number | null {
  if (typeof teamKey !== 'string') {
    return null;
  }

  const match = teamKey.trim().toLowerCase().match(/^frc(\d+)$/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function extractTeamNumber(row: StatboticsTeamEvent): number | null {
  const parsed = toFiniteNumber(row.team_number ?? row.team);
  if (!parsed || !Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function normalizeText(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function getPayloadEventKey(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const value = (payload as { eventKey?: unknown }).eventKey;
  return typeof value === 'string' ? normalizeEventKey(value) : '';
}

function buildPickedStorageKey(eventKey: string): string {
  return `allianceSelection:picked:${eventKey}`;
}

function readPickedTeams(key: string): number[] {
  const stored = storage.get<number[]>(key);
  if (!Array.isArray(stored)) {
    return [];
  }

  return Array.from(
    new Set(
      stored
        .map((value) => toFiniteNumber(value))
        .filter((value): value is number => value !== null && Number.isInteger(value) && value > 0),
    ),
  ).sort((a, b) => a - b);
}

function summarizeMatchNoteLines(lines: MatchNoteLine[]): Map<number, string[]> {
  const grouped = new Map<number, MatchNoteLine[]>();

  lines.forEach((line) => {
    const existing = grouped.get(line.teamNumber) || [];
    existing.push(line);
    grouped.set(line.teamNumber, existing);
  });

  const summary = new Map<number, string[]>();

  grouped.forEach((items, teamNumber) => {
    const unique = new Set<string>();
    const ordered = [...items]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((item) => item.text)
      .filter((text) => {
        if (unique.has(text)) {
          return false;
        }
        unique.add(text);
        return true;
      })
      .slice(0, 3);

    summary.set(teamNumber, ordered);
  });

  return summary;
}

async function buildTeamNoteSummaryMap(eventKey: string, profileId: string | null): Promise<Map<number, TeamNoteSummary>> {
  const normalizedEventKey = normalizeEventKey(eventKey);

  const pitByTeam = new Map<number, { updatedAt: number; note: string }>();
  const matchLines: MatchNoteLine[] = [];

  const localPitPrefix = profileId ? `pitScout:${profileId}:` : 'pitScout:';

  const localPitRecords = storage
    .getAllKeys()
    .filter((key) => key.startsWith(localPitPrefix))
    .map((key) => storage.get<SyncRecord<PitScoutData>>(key))
    .filter((record): record is SyncRecord<PitScoutData> => Boolean(record));

  localPitRecords.forEach((record) => {
    const payload = record.data;
    const payloadEventKey = getPayloadEventKey(payload);
    if (payloadEventKey && payloadEventKey !== normalizedEventKey) {
      return;
    }

    const teamNumber = toFiniteNumber(payload?.teamNumber);
    if (!teamNumber || !Number.isInteger(teamNumber) || teamNumber <= 0) {
      return;
    }

    const note = normalizeText(payload?.notes);
    if (!note) {
      return;
    }

    const existing = pitByTeam.get(teamNumber);
    if (!existing || record.timestamp >= existing.updatedAt) {
      pitByTeam.set(teamNumber, {
        updatedAt: record.timestamp,
        note,
      });
    }
  });

  const localMatchRecords = storage
    .getAllKeys()
    .filter((key) => key.startsWith('matchScout:'))
    .map((key) => storage.get<SyncRecord<MatchScoutData>>(key))
    .filter((record): record is SyncRecord<MatchScoutData> => Boolean(record));

  localMatchRecords.forEach((record) => {
    const payload = record.data;
    if (getPayloadEventKey(payload) !== normalizedEventKey) {
      return;
    }

    const teamNumber = toFiniteNumber(payload?.teamNumber);
    if (!teamNumber || !Number.isInteger(teamNumber) || teamNumber <= 0) {
      return;
    }

    const lines = [
      normalizeText(payload?.autonNotes) ? `Auto: ${normalizeText(payload?.autonNotes)}` : '',
      normalizeText(payload?.defenseNotes) ? `Defense: ${normalizeText(payload?.defenseNotes)}` : '',
      normalizeText(payload?.notes),
    ].filter((line) => line.length > 0);

    lines.forEach((text) => {
      matchLines.push({
        teamNumber,
        text,
        updatedAt: record.timestamp,
      });
    });
  });

  const [remotePitResult, remoteMatchResult] = await Promise.all([
    supabase
      .from('pit_scouts')
      .select('team_number, event_key, data, updated_at')
      .eq('event_key', normalizedEventKey),
    supabase
      .from('match_scouts')
      .select('team_number, event_key, data, updated_at')
      .eq('event_key', normalizedEventKey),
  ]);

  if (!remotePitResult.error) {
    const pitRows = (remotePitResult.data || []) as SupabaseScoutingRow[];
    pitRows.forEach((row) => {
      const payload = normalizePayload(row.data) as Partial<PitScoutData>;
      const teamNumber = toFiniteNumber(row.team_number ?? payload?.teamNumber);
      if (!teamNumber || !Number.isInteger(teamNumber) || teamNumber <= 0) {
        return;
      }

      const note = normalizeText(payload?.notes);
      if (!note) {
        return;
      }

      const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : 0;
      const existing = pitByTeam.get(teamNumber);
      if (!existing || updatedAt >= existing.updatedAt) {
        pitByTeam.set(teamNumber, { updatedAt, note });
      }
    });
  }

  if (!remoteMatchResult.error) {
    const matchRows = (remoteMatchResult.data || []) as SupabaseScoutingRow[];
    matchRows.forEach((row) => {
      const payload = normalizePayload(row.data) as Partial<MatchScoutData>;
      if (getPayloadEventKey(payload) !== normalizedEventKey) {
        return;
      }

      const teamNumber = toFiniteNumber(row.team_number ?? payload?.teamNumber);
      if (!teamNumber || !Number.isInteger(teamNumber) || teamNumber <= 0) {
        return;
      }

      const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : 0;
      const lines = [
        normalizeText(payload?.autonNotes) ? `Auto: ${normalizeText(payload?.autonNotes)}` : '',
        normalizeText(payload?.defenseNotes) ? `Defense: ${normalizeText(payload?.defenseNotes)}` : '',
        normalizeText(payload?.notes),
      ].filter((line) => line.length > 0);

      lines.forEach((text) => {
        matchLines.push({
          teamNumber,
          text,
          updatedAt,
        });
      });
    });
  }

  const teamMatchNotes = summarizeMatchNoteLines(matchLines);
  const teamNumbers = new Set<number>([
    ...Array.from(pitByTeam.keys()),
    ...Array.from(teamMatchNotes.keys()),
  ]);

  const summary = new Map<number, TeamNoteSummary>();

  teamNumbers.forEach((teamNumber) => {
    const pit = pitByTeam.get(teamNumber);
    const matchNotes = teamMatchNotes.get(teamNumber) || [];
    summary.set(teamNumber, {
      pitNote: pit?.note || null,
      matchNotes,
      noteCount: (pit?.note ? 1 : 0) + matchNotes.length,
    });
  });

  return summary;
}

function buildRankMap(payload: TBARankings | null): Map<number, number> {
  const rankMap = new Map<number, number>();

  const rankings = Array.isArray(payload?.rankings) ? payload.rankings : [];
  rankings.forEach((ranking: TBARanking) => {
    const teamNumber = parseTeamKey(ranking.team_key);
    const rank = toFiniteNumber(ranking.rank);
    if (!teamNumber || !rank || !Number.isInteger(rank) || rank <= 0) {
      return;
    }

    rankMap.set(teamNumber, rank);
  });

  return rankMap;
}

function compareByDraftValue(a: AllianceBoardRow, b: AllianceBoardRow): number {
  const aEpa = a.epaTotal;
  const bEpa = b.epaTotal;

  if (aEpa !== null && bEpa !== null && aEpa !== bEpa) {
    return bEpa - aEpa;
  }

  if (aEpa !== null && bEpa === null) {
    return -1;
  }

  if (aEpa === null && bEpa !== null) {
    return 1;
  }

  if (a.tbaRank !== null && b.tbaRank !== null && a.tbaRank !== b.tbaRank) {
    return a.tbaRank - b.tbaRank;
  }

  if (a.tbaRank !== null && b.tbaRank === null) {
    return -1;
  }

  if (a.tbaRank === null && b.tbaRank !== null) {
    return 1;
  }

  return a.teamNumber - b.teamNumber;
}

function formatEpa(value: number | null): string {
  return value === null ? '--' : value.toFixed(1);
}

export function AllianceSelection({ eventKey, profileId }: AllianceSelectionProps) {
  const normalizedEventKey = useMemo(() => normalizeEventKey(eventKey), [eventKey]);
  const pickedStorageKey = useMemo(() => (normalizedEventKey ? buildPickedStorageKey(normalizedEventKey) : ''), [normalizedEventKey]);

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [rows, setRows] = useState<AllianceBoardRow[]>([]);
  const [pickedTeamNumbers, setPickedTeamNumbers] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!pickedStorageKey) {
      setPickedTeamNumbers([]);
      return;
    }

    setPickedTeamNumbers(readPickedTeams(pickedStorageKey));
  }, [pickedStorageKey]);

  useEffect(() => {
    if (!pickedStorageKey) {
      return;
    }

    const deduped = Array.from(new Set<number>(pickedTeamNumbers)).sort((a, b) => a - b);
    storage.set<number[]>(pickedStorageKey, deduped);
  }, [pickedStorageKey, pickedTeamNumbers]);

  useEffect(() => {
    if (!pickedStorageKey) {
      return;
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== pickedStorageKey) {
        return;
      }
      setPickedTeamNumbers(readPickedTeams(pickedStorageKey));
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [pickedStorageKey]);

  useEffect(() => {
    if (!normalizedEventKey) {
      setRows([]);
      setError('Select an event profile in Home to use alliance selection.');
      return;
    }

    let cancelled = false;

    const loadBoard = async (refresh = false) => {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const [rankingsResult, statboticsResult, teamsResult, notesMap] = await Promise.all([
          tba.fetchRankings(normalizedEventKey),
          statbotics.fetchEventTeams(normalizedEventKey),
          tba.fetchTeams(normalizedEventKey),
          buildTeamNoteSummaryMap(normalizedEventKey, profileId),
        ]);

        const rankMap = buildRankMap(rankingsResult);

        const teamNameMap = new Map<number, string>();
        const assignTeamNames = (teams: TBATeam[]) => {
          teams.forEach((team) => {
            if (!Number.isInteger(team.team_number) || team.team_number <= 0) {
              return;
            }

            teamNameMap.set(
              team.team_number,
              team.nickname || team.name || `Team ${team.team_number}`,
            );
          });
        };

        if (Array.isArray(teamsResult)) {
          assignTeamNames(teamsResult);
        }

        if (profileId) {
          assignTeamNames(getProfileTeams(profileId));
        }

        const statMap = new Map<number, StatboticsTeamEvent>();
        if (Array.isArray(statboticsResult)) {
          statboticsResult.forEach((row) => {
            const teamNumber = extractTeamNumber(row);
            if (!teamNumber) {
              return;
            }
            statMap.set(teamNumber, row);

            if (!teamNameMap.has(teamNumber)) {
              const fallbackName = typeof row.team_name === 'string' && row.team_name.trim()
                ? row.team_name.trim()
                : `Team ${teamNumber}`;
              teamNameMap.set(teamNumber, fallbackName);
            }
          });
        }

        const allTeamNumbers = new Set<number>([
          ...Array.from(teamNameMap.keys()),
          ...Array.from(rankMap.keys()),
          ...Array.from(statMap.keys()),
          ...Array.from(notesMap.keys()),
        ]);

        const nextRows = Array.from(allTeamNumbers)
          .map((teamNumber) => {
            const statRow = statMap.get(teamNumber) || null;
            const notes = notesMap.get(teamNumber) || {
              pitNote: null,
              matchNotes: [],
              noteCount: 0,
            };

            return {
              teamNumber,
              teamName: teamNameMap.get(teamNumber) || `Team ${teamNumber}`,
              tbaRank: rankMap.get(teamNumber) ?? null,
              epaTotal: statRow ? toFiniteNumber(statRow.epa?.total_points ?? statRow.norm_epa) : null,
              epaAuto: statRow ? toFiniteNumber(statRow.epa?.auto_points) : null,
              epaTeleop: statRow ? toFiniteNumber(statRow.epa?.teleop_points) : null,
              epaEndgame: statRow ? toFiniteNumber(statRow.epa?.endgame_points) : null,
              notes,
            } as AllianceBoardRow;
          })
          .sort(compareByDraftValue);

        if (!cancelled) {
          setRows(nextRows);
        }
      } catch (loadError) {
        if (!cancelled) {
          setRows([]);
          setError(loadError instanceof Error ? loadError.message : 'Failed to load alliance board data.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    void loadBoard(refreshToken > 0);

    const refresh = () => {
      void loadBoard(true);
    };

    const onStorageChange = (event: Event) => {
      const storageEvent = event as StorageEvent;
      const changedKey = storageEvent.key;

      if (!changedKey) {
        refresh();
        return;
      }

      if (
        changedKey === pickedStorageKey
        || changedKey.startsWith('matchScout:')
        || changedKey.startsWith('pitScout:')
      ) {
        refresh();
      }
    };

    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refresh);
    window.addEventListener('sync-success', refresh);
    window.addEventListener('team-import-success', refresh);
    window.addEventListener('storage', onStorageChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('sync-success', refresh);
      window.removeEventListener('team-import-success', refresh);
      window.removeEventListener('storage', onStorageChange);
    };
  }, [normalizedEventKey, pickedStorageKey, profileId, refreshToken]);

  const pickedSet = useMemo(() => new Set(pickedTeamNumbers), [pickedTeamNumbers]);

  const availableRows = useMemo(() => {
    return rows
      .filter((row) => !pickedSet.has(row.teamNumber))
      .sort(compareByDraftValue);
  }, [pickedSet, rows]);

  const pickedRows = useMemo(() => {
    return rows
      .filter((row) => pickedSet.has(row.teamNumber))
      .sort(compareByDraftValue);
  }, [pickedSet, rows]);

  const topAvailable = availableRows[0] || null;

  const markPicked = (teamNumber: number) => {
    setPickedTeamNumbers((previous) => {
      if (previous.includes(teamNumber)) {
        return previous;
      }
      return [...previous, teamNumber].sort((a, b) => a - b);
    });
  };

  const unmarkPicked = (teamNumber: number) => {
    setPickedTeamNumbers((previous) => previous.filter((value) => value !== teamNumber));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24 px-4">
      <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white">Alliance Selection Board</h2>
            <p className="text-sm text-slate-400 mt-1">
              Best remaining teams are ranked by event EPA. TBA rank is shown for context.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Event: <span className="font-mono uppercase">{normalizedEventKey || 'N/A'}</span>
            </p>
          </div>

          <button
            onClick={() => {
              setRefreshToken((previous) => previous + 1);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Available</p>
            <p className="text-2xl font-mono text-white">{availableRows.length}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Picked</p>
            <p className="text-2xl font-mono text-white">{pickedRows.length}</p>
          </div>
          <div className="rounded-xl border border-emerald-600/40 bg-emerald-900/20 px-4 py-3">
            <p className="text-xs text-emerald-200 uppercase tracking-wide">Top Remaining</p>
            <p className="text-lg font-mono text-emerald-100">
              {topAvailable ? topAvailable.teamNumber : '--'}
            </p>
            <p className="text-xs text-emerald-200/80 truncate">
              {topAvailable ? `${topAvailable.teamName} (${formatEpa(topAvailable.epaTotal)} EPA)` : 'No teams remaining'}
            </p>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-8 flex items-center gap-3 text-slate-200">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading rankings, EPA, and scouting notes...
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/20 p-4 text-rose-200">
          {error}
        </div>
      )}

      {!isLoading && !error && availableRows.length === 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200">
          No available teams found. If the draft is complete, use the picked list below to restore teams as needed.
        </div>
      )}

      {!isLoading && !error && availableRows.length > 0 && (
        <div className="space-y-3">
          {availableRows.map((row, index) => {
            const hasMatchNotes = row.notes.matchNotes.length > 0;
            const hasPitNote = Boolean(row.notes.pitNote);

            return (
              <div
                key={row.teamNumber}
                className="rounded-2xl border border-slate-700 bg-slate-900/75 p-4 shadow-lg"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-[220px]">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-emerald-600/20 px-2 py-1 text-xs font-semibold text-emerald-200">
                        Remaining #{index + 1}
                      </span>
                      <span className="rounded-md bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-300">
                        TBA #{row.tbaRank ?? '--'}
                      </span>
                    </div>

                    <p className="mt-2 text-xl font-mono text-white">{row.teamNumber}</p>
                    <p className="text-sm text-slate-300">{row.teamName}</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-[260px]">
                    <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2">
                      <p className="text-[11px] text-slate-400 uppercase tracking-wide">EPA Total</p>
                      <p className="text-lg font-mono text-white">{formatEpa(row.epaTotal)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2">
                      <p className="text-[11px] text-slate-400 uppercase tracking-wide">Auto</p>
                      <p className="text-lg font-mono text-white">{formatEpa(row.epaAuto)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2">
                      <p className="text-[11px] text-slate-400 uppercase tracking-wide">Teleop</p>
                      <p className="text-lg font-mono text-white">{formatEpa(row.epaTeleop)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2">
                      <p className="text-[11px] text-slate-400 uppercase tracking-wide">Endgame</p>
                      <p className="text-lg font-mono text-white">{formatEpa(row.epaEndgame)}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Scouting Notes ({row.notes.noteCount})</p>

                  {hasPitNote && (
                    <p className="mt-2 text-sm text-slate-200">
                      <span className="text-slate-400">Pit:</span> {row.notes.pitNote}
                    </p>
                  )}

                  {hasMatchNotes && (
                    <div className="mt-2 space-y-1">
                      {row.notes.matchNotes.map((note, noteIndex) => (
                        <p key={`${row.teamNumber}-match-note-${noteIndex}`} className="text-sm text-slate-200">
                          <span className="text-slate-400">Match:</span> {note}
                        </p>
                      ))}
                    </div>
                  )}

                  {!hasPitNote && !hasMatchNotes && (
                    <p className="mt-2 text-sm text-slate-500">No scouting notes recorded yet.</p>
                  )}
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => markPicked(row.teamNumber)}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark Picked
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && !error && pickedRows.length > 0 && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-4">
          <h3 className="text-lg font-semibold text-white">Picked Teams</h3>
          <p className="text-xs text-slate-400">Picked teams are removed from the live remaining board.</p>

          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {pickedRows.map((row) => (
              <div key={`picked-${row.teamNumber}`} className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-mono text-white">{row.teamNumber} - {row.teamName}</p>
                    <p className="text-xs text-slate-400">
                      EPA {formatEpa(row.epaTotal)} | TBA #{row.tbaRank ?? '--'}
                    </p>
                  </div>

                  <button
                    onClick={() => unmarkPicked(row.teamNumber)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restore
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
