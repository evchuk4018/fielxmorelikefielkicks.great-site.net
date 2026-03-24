import React, { useEffect, useMemo, useState } from 'react';
import { tba } from '../lib/tba';
import { storage } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { CompetitionProfile, TBAMatch, TBATeam } from '../types';

type MatchScoutCountRow = {
  team_number: number | null;
  data?: {
    eventKey?: string;
  } | null;
};

type MatchViewProps = {
  activeProfile: CompetitionProfile | null;
};

type TeamRow = {
  teamNumber: number;
  nickname: string;
  alliance: 'Red' | 'Blue';
};

function toTeamNumber(teamKey: string): number {
  return Number(teamKey.replace('frc', ''));
}

function compLevelSortOrder(compLevel: string): number {
  switch (compLevel) {
    case 'qm':
      return 0;
    case 'ef':
      return 1;
    case 'qf':
      return 2;
    case 'sf':
      return 3;
    case 'f':
      return 4;
    default:
      return 5;
  }
}

function formatMatchLabel(match: TBAMatch): string {
  const compLabel = match.comp_level.toUpperCase();
  if (match.comp_level === 'qm') {
    return `QM ${match.match_number}`;
  }
  return `${compLabel} ${match.set_number}-${match.match_number}`;
}

function buildLocalCountByTeam(matchNumber: number): Map<number, number> {
  const counts = new Map<number, number>();

  storage
    .getAllKeys()
    .filter((key) => key.startsWith(`matchScout:${matchNumber}:`))
    .forEach((key) => {
      const teamPart = key.split(':')[2];
      const teamNumber = Number(teamPart);
      if (!Number.isFinite(teamNumber)) {
        return;
      }
      counts.set(teamNumber, (counts.get(teamNumber) || 0) + 1);
    });

  return counts;
}

async function fetchRemoteCountByTeam(
  matchNumber: number,
  eventKey: string,
  allowedTeams: Set<number>,
): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  const normalizedEventKey = eventKey.trim().toLowerCase();
  const { data, error } = await supabase
    .from('match_scouts')
    .select('team_number, data')
    .eq('match_number', matchNumber);

  if (error) {
    throw error;
  }

  ((data || []) as MatchScoutCountRow[]).forEach((row) => {
    const teamNumber = row.team_number;
    if (typeof teamNumber !== 'number' || !Number.isFinite(teamNumber)) {
      return;
    }

    if (!allowedTeams.has(teamNumber)) {
      return;
    }

    const rowEventKey =
      row.data && typeof row.data === 'object' && typeof row.data.eventKey === 'string'
        ? row.data.eventKey.trim().toLowerCase()
        : '';

    // Backward compatibility: older rows may not have eventKey in payload.
    if (rowEventKey && rowEventKey !== normalizedEventKey) {
      return;
    }

    counts.set(teamNumber, (counts.get(teamNumber) || 0) + 1);
  });

  return counts;
}

function mergeCounts(localCounts: Map<number, number>, remoteCounts: Map<number, number>): Map<number, number> {
  const merged = new Map<number, number>();

  [...localCounts.entries(), ...remoteCounts.entries()].forEach(([teamNumber]) => {
    const local = localCounts.get(teamNumber) || 0;
    const remote = remoteCounts.get(teamNumber) || 0;
    merged.set(teamNumber, Math.max(local, remote));
  });

  return merged;
}

export function MatchView({ activeProfile }: MatchViewProps) {
  const [matches, setMatches] = useState<TBAMatch[]>([]);
  const [teamNameByNumber, setTeamNameByNumber] = useState<Map<number, string>>(new Map());
  const [selectedMatchKey, setSelectedMatchKey] = useState<string>('');
  const [countByTeam, setCountByTeam] = useState<Map<number, number>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!activeProfile) {
        if (cancelled) {
          return;
        }
        setError('No active competition profile selected.');
        setMatches([]);
        setTeamNameByNumber(new Map());
        setSelectedMatchKey('');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [teams, loadedMatches] = await Promise.all([
          tba.fetchTeams(activeProfile.eventKey),
          tba.fetchMatches(activeProfile.eventKey),
        ]);

        if (cancelled) {
          return;
        }

        const sortedMatches = [...loadedMatches]
          .filter((match: TBAMatch) => match.alliances?.red?.team_keys && match.alliances?.blue?.team_keys)
          .sort((a, b) => {
            const levelSort = compLevelSortOrder(a.comp_level) - compLevelSortOrder(b.comp_level);
            if (levelSort !== 0) {
              return levelSort;
            }
            if (a.set_number !== b.set_number) {
              return a.set_number - b.set_number;
            }
            return a.match_number - b.match_number;
          });

        const nameMap = new Map<number, string>();
        teams.forEach((team: TBATeam) => {
          nameMap.set(team.team_number, team.nickname || team.name || 'Unknown');
        });

        setMatches(sortedMatches);
        setTeamNameByNumber(nameMap);

        if (sortedMatches.length > 0) {
          const firstQualMatch = sortedMatches.find((match) => match.comp_level === 'qm') || sortedMatches[0];
          setSelectedMatchKey(firstQualMatch.key);
        } else {
          setSelectedMatchKey('');
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError('Failed to load matches and team roster for this event.');
        setMatches([]);
        setTeamNameByNumber(new Map());
        setSelectedMatchKey('');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [activeProfile]);

  const selectedMatch = useMemo(
    () => matches.find((match: TBAMatch) => match.key === selectedMatchKey) || null,
    [matches, selectedMatchKey]
  );

  useEffect(() => {
    let cancelled = false;

    const loadCounts = async () => {
      if (!selectedMatch || !activeProfile) {
        setCountByTeam(new Map());
        return;
      }

      const allowedTeams = new Set<number>([
        ...selectedMatch.alliances.red.team_keys.map((teamKey: string) => toTeamNumber(teamKey)),
        ...selectedMatch.alliances.blue.team_keys.map((teamKey: string) => toTeamNumber(teamKey)),
      ]);

      setIsLoadingCounts(true);
      try {
        const localCounts = buildLocalCountByTeam(selectedMatch.match_number);
        const remoteCounts = await fetchRemoteCountByTeam(selectedMatch.match_number, activeProfile.eventKey, allowedTeams);
        if (!cancelled) {
          setCountByTeam(mergeCounts(localCounts, remoteCounts));
        }
      } catch {
        if (!cancelled) {
          setCountByTeam(buildLocalCountByTeam(selectedMatch.match_number));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCounts(false);
        }
      }
    };

    loadCounts();

    const refresh = () => {
      loadCounts();
    };

    window.addEventListener('sync-success', refresh);
    window.addEventListener('storage', refresh);

    return () => {
      cancelled = true;
      window.removeEventListener('sync-success', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [selectedMatch, activeProfile]);

  const teamRows = useMemo<TeamRow[]>(() => {
    if (!selectedMatch) {
      return [];
    }

    const redRows = selectedMatch.alliances.red.team_keys.map((teamKey: string) => {
      const teamNumber = toTeamNumber(teamKey);
      return {
        teamNumber,
        nickname: teamNameByNumber.get(teamNumber) || 'Unknown',
        alliance: 'Red' as const,
      };
    });

    const blueRows = selectedMatch.alliances.blue.team_keys.map((teamKey: string) => {
      const teamNumber = toTeamNumber(teamKey);
      return {
        teamNumber,
        nickname: teamNameByNumber.get(teamNumber) || 'Unknown',
        alliance: 'Blue' as const,
      };
    });

    return [...redRows, ...blueRows];
  }, [selectedMatch, teamNameByNumber]);

  const scoutedTeamsCount = useMemo(
    () => teamRows.filter((row: TeamRow) => (countByTeam.get(row.teamNumber) || 0) > 0).length,
    [teamRows, countByTeam]
  );

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 text-slate-300">
          Loading match list...
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

  if (matches.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 text-slate-300">
          No matches found for this competition yet.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24 px-4">
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-white">Match View</h2>
        <p className="text-slate-400 mt-2">
          Select a match to see alliance teams and current scouting submission counts.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Match</label>
            <select
              value={selectedMatchKey}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setSelectedMatchKey(event.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100"
            >
              {matches.map((match: TBAMatch) => (
                <option key={match.key} value={match.key}>
                  {formatMatchLabel(match)}
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm text-slate-300 rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2.5">
            Teams Scouted: <span className="font-semibold text-white">{scoutedTeamsCount}/6</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-sm text-slate-200">
          <thead className="bg-slate-900/60 text-slate-400 uppercase text-xs tracking-wide">
            <tr>
              <th className="px-4 py-3">Alliance</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Nickname</th>
              <th className="px-4 py-3">Scouting Count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {teamRows.map((row: TeamRow) => {
              const count = countByTeam.get(row.teamNumber) || 0;
              const isScouted = count > 0;

              return (
                <tr key={`${selectedMatch?.key}:${row.alliance}:${row.teamNumber}`} className="hover:bg-slate-800/60">
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${
                        row.alliance === 'Red'
                          ? 'border-rose-400/40 bg-rose-500/15 text-rose-200'
                          : 'border-blue-400/40 bg-blue-500/15 text-blue-200'
                      }`}
                    >
                      {row.alliance}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-white">{row.teamNumber}</td>
                  <td className="px-4 py-3">{row.nickname}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${
                        isScouted
                          ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                          : 'border-slate-500/40 bg-slate-500/10 text-slate-300'
                      }`}
                    >
                      {isLoadingCounts ? 'Loading...' : `${count} submission${count === 1 ? '' : 's'}`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
