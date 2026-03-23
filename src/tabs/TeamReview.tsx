import React, { useEffect, useState } from 'react';
import { storage } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { competition } from '../lib/competition';
import { statbotics } from '../lib/statbotics';
import { MatchScoutData, PitScoutData, StatboticsTeamStats, SyncRecord } from '../types';
import { MatchDataSection, PitDataSection } from '../components/TeamDataSections';
import { showToast } from '../components/Toast';

function teamNumbersFromStorage(): number[] {
  const set = new Set<number>();
  storage.getAllKeys().forEach((key) => {
    if (key.startsWith('pitScout:')) {
      const value = Number(key.replace('pitScout:', ''));
      if (Number.isFinite(value)) set.add(value);
    }
    if (key.startsWith('matchScout:')) {
      const value = Number(key.split(':')[2]);
      if (Number.isFinite(value)) set.add(value);
    }
  });
  return Array.from(set).sort((a, b) => a - b);
}

export function TeamReview() {
  const [teamNumbers, setTeamNumbers] = useState<number[]>(teamNumbersFromStorage());
  const [selectedTeam, setSelectedTeam] = useState<number | ''>('');
  const [pitEntries, setPitEntries] = useState<PitScoutData[]>([]);
  const [matchEntries, setMatchEntries] = useState<MatchScoutData[]>([]);
  const [statboticsData, setStatboticsData] = useState<StatboticsTeamStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeEventKey, setActiveEventKey] = useState(competition.getActiveProfile()?.eventKey || '');

  useEffect(() => {
    const refresh = () => setActiveEventKey(competition.getActiveProfile()?.eventKey || '');
    window.addEventListener('active-competition-changed', refresh);
    return () => window.removeEventListener('active-competition-changed', refresh);
  }, []);

  useEffect(() => {
    const refresh = () => setTeamNumbers(teamNumbersFromStorage());
    window.addEventListener('sync-success', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('team-import-success', refresh);
    return () => {
      window.removeEventListener('sync-success', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('team-import-success', refresh);
    };
  }, []);

  useEffect(() => {
    if (!selectedTeam) {
      setPitEntries([]);
      setMatchEntries([]);
      setStatboticsData(null);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      try {
        const localPit = storage.get<SyncRecord<PitScoutData>>(`pitScout:${selectedTeam}`)?.data;
        const localMatches = storage
          .getAllKeys()
          .filter((key) => key.startsWith('matchScout:'))
          .map((key) => storage.get<SyncRecord<MatchScoutData>>(key)?.data)
          .filter((row): row is MatchScoutData => Boolean(row) && Number(row.teamNumber) === Number(selectedTeam));

        const [pitResponse, matchResponse] = await Promise.all([
          supabase.from('pit_scouts').select('data, team_number').eq('team_number', Number(selectedTeam)),
          supabase.from('match_scouts').select('data, team_number').eq('team_number', Number(selectedTeam)),
        ]);

        const remotePit = (pitResponse.data || []).map((row: { data: any }) => row.data as PitScoutData);
        const remoteMatch = (matchResponse.data || []).map((row: { data: any }) => row.data as MatchScoutData);

        const pitMerged = [...remotePit];
        if (localPit) {
          pitMerged.unshift(localPit);
        }
        setPitEntries(pitMerged);

        const matchMerged = [...remoteMatch, ...localMatches];
        const uniqueMatches = new Map<string, MatchScoutData>();
        matchMerged.forEach((item) => {
          uniqueMatches.set(`${item.matchNumber}:${item.teamNumber}`, item);
        });
        setMatchEntries(Array.from(uniqueMatches.values()));

        if (activeEventKey) {
          let allStats = statbotics.getEventTeamStats(activeEventKey);
          if (allStats.length === 0) {
            allStats = await statbotics.fetchEventTeamStats(activeEventKey);
          }
          setStatboticsData(allStats.find((row) => row.teamNumber === Number(selectedTeam)) || null);
        } else {
          setStatboticsData(null);
        }
      } catch (error) {
        showToast('Failed to load team review data');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [selectedTeam, activeEventKey]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24 px-4">
      <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl space-y-4">
        <h2 className="text-2xl font-bold text-white">Team Review</h2>
        <p className="text-slate-400">Unified view of pit scouting submissions and Statbotics metrics.</p>
        <select
          value={selectedTeam}
          onChange={(event) => setSelectedTeam(event.target.value ? Number(event.target.value) : '')}
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 font-mono"
        >
          <option value="">Select team</option>
          {teamNumbers.map((teamNumber) => (
            <option key={teamNumber} value={teamNumber}>
              {teamNumber}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl text-slate-300">Loading team review data…</div>
      ) : selectedTeam ? (
        <div className="space-y-6">
          <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-white">Statbotics Data</h3>
            {statboticsData ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="p-3 bg-slate-900/50 border border-slate-700 rounded-xl">
                  <p className="text-slate-400">EPA</p>
                  <p className="text-white font-semibold">{statboticsData.epa == null ? 'N/A' : statboticsData.epa.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-slate-900/50 border border-slate-700 rounded-xl">
                  <p className="text-slate-400">Average Points</p>
                  <p className="text-white font-semibold">
                    {statboticsData.avgPoints == null ? 'N/A' : statboticsData.avgPoints.toFixed(1)}
                  </p>
                </div>
                <div className="p-3 bg-slate-900/50 border border-slate-700 rounded-xl">
                  <p className="text-slate-400">Predicted Win Rate</p>
                  <p className="text-white font-semibold">
                    {statboticsData.predictedWinRate == null ? 'N/A' : `${(statboticsData.predictedWinRate * 100).toFixed(0)}%`}
                  </p>
                </div>
                <div className="p-3 bg-slate-900/50 border border-slate-700 rounded-xl">
                  <p className="text-slate-400">Record</p>
                  <p className="text-white font-semibold">{statboticsData.record}</p>
                </div>
              </div>
            ) : (
              <p className="text-slate-400 text-sm">No Statbotics row found for this team in the active competition profile.</p>
            )}
          </div>

          <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl space-y-8">
            {pitEntries.length > 0 ? (
              pitEntries.map((entry, index) => (
                <div key={`${entry.teamNumber}-${index}`} className="space-y-6">
                  <PitDataSection pitData={entry} />
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-400">No pit scouting submissions for this team.</div>
            )}
            <MatchDataSection records={matchEntries} />
          </div>
        </div>
      ) : (
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl text-slate-400">
          Select a team to review data.
        </div>
      )}
    </div>
  );
}
