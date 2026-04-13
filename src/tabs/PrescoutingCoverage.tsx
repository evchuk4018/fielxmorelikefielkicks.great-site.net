import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { formatMatchLabel } from '../lib/matchUtils';
import { TBAMatch } from '../types';
import { PRESCOUTING_SEASON_YEAR, PRESCOUTING_TEAMS, PRESCOUTING_TEAM_NUMBERS } from '../prescouting/constants';
import { getMatchEventKey, loadAllTeamMatchesForPrescouting, sortMatches } from '../prescouting/matchData';
import { isTeamMatchAlreadyScouted, loadPrescoutingScoutedIndex, PrescoutingScoutedIndex } from '../prescouting/scoutedEntries';

type MatchColumn = {
  key: string;
  eventKey: string;
  matchNumber: number;
  label: string;
  teamNumbers: Set<number>;
  match: TBAMatch;
};

const EMPTY_SCOUTED_INDEX: PrescoutingScoutedIndex = {
  byTeamAndMatchKey: new Set<string>(),
  byTeamAndEventMatch: new Set<string>(),
  entries: [],
};

export function PrescoutingCoverage() {
  const [teamMatchesMap, setTeamMatchesMap] = useState<Map<number, TBAMatch[]>>(new Map());
  const [scoutedIndex, setScoutedIndex] = useState<PrescoutingScoutedIndex>(EMPTY_SCOUTED_INDEX);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSequence = useRef(0);

  const loadSchedule = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setIsLoadingSchedule(true);
    setError(null);

    try {
      const nextMap = await loadAllTeamMatchesForPrescouting(PRESCOUTING_TEAM_NUMBERS, PRESCOUTING_SEASON_YEAR);
      if (sequence !== loadSequence.current) {
        return;
      }
      setTeamMatchesMap(nextMap);
    } catch (loadError) {
      if (sequence !== loadSequence.current) {
        return;
      }
      setError(loadError instanceof Error ? loadError.message : 'Failed to load prescouting schedule.');
      setTeamMatchesMap(new Map());
    } finally {
      if (sequence === loadSequence.current) {
        setIsLoadingSchedule(false);
      }
    }
  }, []);

  const loadStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const index = await loadPrescoutingScoutedIndex();
      setScoutedIndex(index);
    } catch {
      setScoutedIndex(EMPTY_SCOUTED_INDEX);
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadSchedule(), loadStatus()]);
  }, [loadSchedule, loadStatus]);

  useEffect(() => {
    const refreshStatus = () => {
      void loadStatus();
    };

    window.addEventListener('sync-success', refreshStatus);
    window.addEventListener('storage', refreshStatus);
    return () => {
      window.removeEventListener('sync-success', refreshStatus);
      window.removeEventListener('storage', refreshStatus);
    };
  }, [loadStatus]);

  const columns = useMemo(() => {
    const byKey = new Map<string, MatchColumn>();

    PRESCOUTING_TEAM_NUMBERS.forEach((teamNumber) => {
      const matches = teamMatchesMap.get(teamNumber) || [];
      matches.forEach((match) => {
        const eventKey = getMatchEventKey(match);
        const key = match.key;
        const existing = byKey.get(key);
        if (existing) {
          existing.teamNumbers.add(teamNumber);
          return;
        }

        byKey.set(key, {
          key,
          eventKey,
          matchNumber: match.match_number,
          label: `${eventKey.toUpperCase()} ${formatMatchLabel(match)}`,
          teamNumbers: new Set<number>([teamNumber]),
          match,
        });
      });
    });

    const all = Array.from(byKey.values());
    all.sort((a, b) => {
      const eventCompare = a.eventKey.localeCompare(b.eventKey);
      if (eventCompare !== 0) {
        return eventCompare;
      }

      const sorted = sortMatches([a.match, b.match]);
      return sorted[0].key === a.key ? -1 : 1;
    });

    return all;
  }, [teamMatchesMap]);

  const coverageMetadata = useMemo(() => {
    const coveredKeys = new Set<string>();
    const coveredCountByTeam = new Map<number, number>();
    const scheduledCountByTeam = new Map<number, number>();
    const coveredCountByMatch = new Map<string, number>();
    const scheduledCountByMatch = new Map<string, number>();

    PRESCOUTING_TEAM_NUMBERS.forEach((teamNumber) => {
      scheduledCountByTeam.set(teamNumber, 0);
      coveredCountByTeam.set(teamNumber, 0);
    });

    columns.forEach((column) => {
      let coveredInColumn = 0;
      const scheduledInColumn = column.teamNumbers.size;
      scheduledCountByMatch.set(column.key, scheduledInColumn);

      column.teamNumbers.forEach((teamNumber) => {
        const cellKey = `${column.key}|${teamNumber}`;
        const isCovered = isTeamMatchAlreadyScouted(scoutedIndex, teamNumber, column.match);

        scheduledCountByTeam.set(teamNumber, (scheduledCountByTeam.get(teamNumber) || 0) + 1);
        if (isCovered) {
          coveredInColumn += 1;
          coveredKeys.add(cellKey);
          coveredCountByTeam.set(teamNumber, (coveredCountByTeam.get(teamNumber) || 0) + 1);
        }
      });

      coveredCountByMatch.set(column.key, coveredInColumn);
    });

    return {
      coveredKeys,
      coveredCountByTeam,
      scheduledCountByTeam,
      coveredCountByMatch,
      scheduledCountByMatch,
    };
  }, [columns, scoutedIndex]);

  const overallScheduled = useMemo(
    () => Array.from(coverageMetadata.scheduledCountByTeam.values()).reduce((sum, value) => sum + value, 0),
    [coverageMetadata.scheduledCountByTeam],
  );
  const overallCovered = useMemo(
    () => Array.from(coverageMetadata.coveredCountByTeam.values()).reduce((sum, value) => sum + value, 0),
    [coverageMetadata.coveredCountByTeam],
  );

  if (isLoadingSchedule) {
    return (
      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 text-slate-300 inline-flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading prescouting schedule for all 66 teams...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-rose-900/20 border border-rose-500/30 rounded-2xl p-6 text-rose-200">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-white">Prescouting Coverage Matrix</h2>
            <p className="mt-1 text-sm text-slate-300">
              66 hardcoded teams across all {PRESCOUTING_SEASON_YEAR} matches they played in every event.
            </p>
          </div>
          <button
            onClick={() => {
              void Promise.all([loadSchedule(), loadStatus()]);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingStatus ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Covered cells</p>
            <p className="text-xl font-semibold text-emerald-300">{overallCovered}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Missing cells</p>
            <p className="text-xl font-semibold text-rose-300">{Math.max(overallScheduled - overallCovered, 0)}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Coverage rate</p>
            <p className="text-xl font-semibold text-blue-200">
              {overallScheduled > 0 ? `${Math.round((overallCovered / overallScheduled) * 100)}%` : '0%'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="overflow-auto max-h-[72vh]">
          <table className="min-w-max border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-30 bg-slate-900 px-3 py-2 text-left font-semibold text-slate-200 border-b border-r border-slate-700 min-w-[250px]">
                  Team
                </th>
                {columns.map((column) => {
                  const coveredCount = coverageMetadata.coveredCountByMatch.get(column.key) || 0;
                  const scheduledCount = coverageMetadata.scheduledCountByMatch.get(column.key) || 0;
                  return (
                    <th
                      key={column.key}
                      className="sticky top-0 z-20 bg-slate-900 px-2 py-2 text-center font-semibold text-slate-200 border-b border-r border-slate-700 min-w-[92px]"
                    >
                      <div className="whitespace-nowrap">{column.label}</div>
                      <div className="text-[10px] text-slate-400">{coveredCount}/{scheduledCount}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {PRESCOUTING_TEAMS.map((team) => {
                const scheduledCount = coverageMetadata.scheduledCountByTeam.get(team.teamNumber) || 0;
                const coveredCount = coverageMetadata.coveredCountByTeam.get(team.teamNumber) || 0;
                const complete = scheduledCount > 0 && coveredCount === scheduledCount;

                return (
                  <tr key={team.teamNumber}>
                    <th className="sticky left-0 z-10 bg-slate-900/95 px-3 py-2 text-left border-b border-r border-slate-700">
                      <div className="font-semibold text-slate-100">#{team.rank} - Team {team.teamNumber}</div>
                      <div className="text-[11px] text-slate-400">{coveredCount}/{scheduledCount}</div>
                      <div className={`text-[10px] mt-0.5 ${complete ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {complete ? 'Complete' : 'Missing'}
                      </div>
                    </th>
                    {columns.map((column) => {
                      const scheduled = column.teamNumbers.has(team.teamNumber);
                      const covered = coverageMetadata.coveredKeys.has(`${column.key}|${team.teamNumber}`);

                      if (!scheduled) {
                        return (
                          <td
                            key={`${column.key}:${team.teamNumber}`}
                            className="h-9 border-b border-r border-slate-800 bg-slate-950/70 text-center text-slate-600"
                            title="Team not in this match"
                          >
                            -
                          </td>
                        );
                      }

                      return (
                        <td
                          key={`${column.key}:${team.teamNumber}`}
                          className={`h-9 border-b border-r border-slate-700 text-center font-semibold ${
                            covered ? 'bg-emerald-900/35 text-emerald-200' : 'bg-rose-900/30 text-rose-200'
                          }`}
                          title={covered ? 'Scouted' : 'Missing'}
                        >
                          {covered ? '✓' : '•'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
