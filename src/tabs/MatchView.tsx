import React, { useEffect, useMemo, useState } from 'react';
import { competition } from '../lib/competition';
import { storage } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { TBAMatch } from '../types';
import { showToast } from '../components/Toast';

type CountMap = Record<number, number>;

function getTeamNumberFromKey(teamKey: string): number | null {
  const normalized = teamKey.replace('frc', '');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function MatchView() {
  const [matches, setMatches] = useState<TBAMatch[]>(competition.getActiveProfile()?.matches || []);
  const [selectedMatchKey, setSelectedMatchKey] = useState<string>('');
  const [scoutingCounts, setScoutingCounts] = useState<CountMap>({});

  const selectedMatch = useMemo(
    () => matches.find((match) => match.key === selectedMatchKey) || null,
    [matches, selectedMatchKey]
  );

  useEffect(() => {
    const refresh = () => {
      const activeMatches = competition.getActiveProfile()?.matches || [];
      setMatches(activeMatches);
      setSelectedMatchKey((current) =>
        current && activeMatches.some((match) => match.key === current) ? current : (activeMatches[0]?.key || '')
      );
    };

    refresh();
    window.addEventListener('active-competition-changed', refresh);
    return () => window.removeEventListener('active-competition-changed', refresh);
  }, []);

  useEffect(() => {
    if (!selectedMatch) {
      setScoutingCounts({});
      return;
    }

    const loadCounts = async () => {
      const localCounts: CountMap = {};
      storage
        .getAllKeys()
        .filter((key) => key.startsWith(`matchScout:${selectedMatch.match_number}:`))
        .forEach((key) => {
          const parts = key.split(':');
          const teamNumber = Number(parts[2]);
          if (Number.isFinite(teamNumber)) {
            localCounts[teamNumber] = (localCounts[teamNumber] || 0) + 1;
          }
        });

      try {
        const { data, error } = await supabase
          .from('match_scouts')
          .select('team_number')
          .eq('match_number', selectedMatch.match_number);

        if (!error) {
          (data || []).forEach((row: { team_number?: number | null }) => {
            const teamNumber = row.team_number;
            if (typeof teamNumber === 'number') {
              localCounts[teamNumber] = (localCounts[teamNumber] || 0) + 1;
            }
          });
        } else {
          console.error('[MatchView] Failed to load match scouting counts', error);
          showToast('Could not load remote scouting counts');
        }
      } catch (error) {
        console.error('[MatchView] Failed to query scouting counts', error);
        showToast('Could not load remote scouting counts');
        // Keep local counts if remote query fails.
      }

      setScoutingCounts(localCounts);
    };

    loadCounts();
  }, [selectedMatch]);

  const teamsInSelectedMatch = useMemo(() => {
    if (!selectedMatch) return [];
    return [...selectedMatch.alliances.red.team_keys, ...selectedMatch.alliances.blue.team_keys]
      .map(getTeamNumberFromKey)
      .filter((value): value is number => value !== null);
  }, [selectedMatch]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 px-4">
      <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl space-y-4">
        <h2 className="text-2xl font-bold text-white">Match View</h2>
        {matches.length === 0 ? (
          <p className="text-slate-400">No matches available. Set an active competition profile on Home first.</p>
        ) : (
          <>
            <label className="block text-sm font-medium text-slate-300">Select Match</label>
            <select
              value={selectedMatchKey}
              onChange={(event) => setSelectedMatchKey(event.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200"
            >
              {matches.map((match) => (
                <option key={match.key} value={match.key}>
                  {match.comp_level.toUpperCase()} {match.match_number}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {selectedMatch && (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white">
              Teams in {selectedMatch.comp_level.toUpperCase()} {selectedMatch.match_number}
            </h3>
          </div>
          <div className="divide-y divide-slate-700">
            {teamsInSelectedMatch.map((teamNumber) => (
              <div key={teamNumber} className="px-6 py-4 flex items-center justify-between">
                <span className="font-mono text-white">{teamNumber}</span>
                <span className="text-slate-300 text-sm">
                  Scouting datasets: <span className="font-semibold text-blue-300">{scoutingCounts[teamNumber] || 0}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
