import React, { useEffect, useMemo, useState } from 'react';
import { storage } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { SyncRecord } from '../types';
import { MatchDataSection, PitDataSection } from '../components/TeamDataSections';

type RawEntryType = 'pit' | 'match';

type RawEntry = {
  key: string;
  type: RawEntryType;
  teamNumber: number | string;
  matchNumber?: number | string;
  updatedAt: number;
  source: 'local' | 'remote';
  payload: unknown;
};

type SupabaseRow = {
  data: unknown;
  team_number?: number | null;
  match_number?: number | null;
  updated_at?: string;
};

function normalizePayload(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

export function RawData() {
  const [entries, setEntries] = useState<RawEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeamNumber, setSelectedTeamNumber] = useState<number | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const localPitEntries = storage
        .getAllKeys()
        .filter((key) => key.startsWith('pitScout:'))
        .map((key) => storage.get<SyncRecord<any>>(key))
        .filter(Boolean)
        .map((record) => ({
          key: `pit:${record!.data?.teamNumber}`,
          type: 'pit' as const,
          teamNumber: record!.data?.teamNumber ?? 'Unknown',
          updatedAt: record!.timestamp || 0,
          source: 'local' as const,
          payload: record!.data,
        }));

      const localMatchEntries = storage
        .getAllKeys()
        .filter((key) => key.startsWith('matchScout:'))
        .map((key) => storage.get<SyncRecord<any>>(key))
        .filter(Boolean)
        .map((record) => ({
          key: `match:${record!.data?.matchNumber}:${record!.data?.teamNumber}`,
          type: 'match' as const,
          teamNumber: record!.data?.teamNumber ?? 'Unknown',
          matchNumber: record!.data?.matchNumber ?? 'Unknown',
          updatedAt: record!.timestamp || 0,
          source: 'local' as const,
          payload: record!.data,
        }));

      const [pitResult, matchResult] = await Promise.all([
        supabase.from('pit_scouts').select('team_number, data, updated_at'),
        supabase.from('match_scouts').select('match_number, team_number, data, updated_at'),
      ]);

      const remotePitEntries: RawEntry[] = pitResult.error
        ? []
        : ((pitResult.data || []) as SupabaseRow[]).map((row) => {
            const payload = normalizePayload(row.data) as any;
            const teamNumber = row.team_number ?? payload?.teamNumber ?? 'Unknown';
            return {
              key: `pit:${teamNumber}`,
              type: 'pit',
              teamNumber,
              updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : 0,
              source: 'remote',
              payload,
            };
          });

      const remoteMatchEntries: RawEntry[] = matchResult.error
        ? []
        : ((matchResult.data || []) as SupabaseRow[]).map((row) => {
            const payload = normalizePayload(row.data) as any;
            const matchNumber = row.match_number ?? payload?.matchNumber ?? 'Unknown';
            const teamNumber = row.team_number ?? payload?.teamNumber ?? 'Unknown';
            return {
              key: `match:${matchNumber}:${teamNumber}`,
              type: 'match',
              teamNumber,
              matchNumber,
              updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : 0,
              source: 'remote',
              payload,
            };
          });

      const merged = new Map<string, RawEntry>();
      [...localPitEntries, ...remotePitEntries, ...localMatchEntries, ...remoteMatchEntries].forEach((entry) => {
        const existing = merged.get(entry.key);
        if (!existing || entry.updatedAt >= existing.updatedAt) {
          merged.set(entry.key, entry);
        }
      });

      const sorted = Array.from(merged.values()).sort((a, b) => b.updatedAt - a.updatedAt);
      setEntries(sorted);
    };

    loadData();

    const refresh = () => {
      loadData();
    };

    window.addEventListener('sync-success', refresh);
    window.addEventListener('team-import-success', refresh);
    window.addEventListener('storage', refresh);

    return () => {
      window.removeEventListener('sync-success', refresh);
      window.removeEventListener('team-import-success', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const counts = useMemo(() => {
    const pit = entries.filter((e) => e.type === 'pit').length;
    const match = entries.filter((e) => e.type === 'match').length;
    return { pit, match, total: entries.length };
  }, [entries]);

  const teams = useMemo(() => {
    const numberSet = new Set<number>();
    entries.forEach((entry) => {
      const teamValue = Number(entry.teamNumber);
      if (Number.isFinite(teamValue)) {
        numberSet.add(teamValue);
      }
    });
    return Array.from(numberSet).sort((a, b) => a - b);
  }, [entries]);

  const filteredTeams = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return teams;
    return teams.filter((teamNumber) => String(teamNumber).includes(query));
  }, [teams, searchQuery]);

  const selectedTeamEntries = useMemo(() => {
    if (selectedTeamNumber == null) return [];
    return entries.filter((entry) => Number(entry.teamNumber) === selectedTeamNumber);
  }, [entries, selectedTeamNumber]);

  const selectedTeamPitEntry = useMemo(() => {
    return selectedTeamEntries.find((entry) => entry.type === 'pit') || null;
  }, [selectedTeamEntries]);

  const selectedTeamMatchEntries = useMemo(() => {
    return selectedTeamEntries.filter((entry) => entry.type === 'match').map((entry) => entry.payload as any);
  }, [selectedTeamEntries]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24 px-4">
      <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl">
        <h2 className="text-2xl font-bold text-white">Raw Data</h2>
        <p className="text-slate-400 mt-2">
          Team-first view for all pit scouting and match scouting records.
        </p>
        <div className="mt-4 text-sm text-slate-300 flex flex-wrap gap-4">
          <span>Total: {counts.total}</span>
          <span>Pit: {counts.pit}</span>
          <span>Match: {counts.match}</span>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Filter team number"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-sm placeholder:text-slate-500"
            aria-label="Search team number"
          />
        </div>
        <div className="mt-2 text-xs text-slate-400" role="status" aria-live="polite">
          Teams: {filteredTeams.length}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl text-slate-400">
          No pit scouting or match scouting records found yet.
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl text-slate-400">
          No team records match this search.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Teams</h3>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {filteredTeams.map((teamNumber) => (
                <button
                  key={teamNumber}
                  onClick={() => setSelectedTeamNumber(teamNumber)}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition-colors font-mono ${
                    selectedTeamNumber === teamNumber
                      ? 'bg-blue-600/30 border-blue-500 text-white'
                      : 'bg-slate-900/40 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Team {teamNumber}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl">
            {selectedTeamNumber == null ? (
              <div className="text-slate-400">Select a team to view detailed scouting data.</div>
            ) : (
              <div className="space-y-8">
                <h3 className="text-xl font-bold text-white font-mono">Team {selectedTeamNumber}</h3>
                {selectedTeamPitEntry ? (
                  <PitDataSection pitData={selectedTeamPitEntry.payload as any} />
                ) : (
                  <div className="text-sm text-slate-400">No pit scouting record for this team.</div>
                )}
                <MatchDataSection records={selectedTeamMatchEntries as any} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
