import React, { useEffect, useMemo, useState } from 'react';
import { competition } from '../lib/competition';
import { statbotics } from '../lib/statbotics';
import { StatboticsTeamStats } from '../types';
import { showToast } from '../components/Toast';

export function AllianceStrategy() {
  const [eventKey, setEventKey] = useState(competition.getActiveProfile()?.eventKey || '');
  const [stats, setStats] = useState<StatboticsTeamStats[]>(eventKey ? statbotics.getEventTeamStats(eventKey) : []);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const refreshActive = () => {
      const activeEventKey = competition.getActiveProfile()?.eventKey || '';
      setEventKey(activeEventKey);
      setStats(activeEventKey ? statbotics.getEventTeamStats(activeEventKey) : []);
    };
    window.addEventListener('active-competition-changed', refreshActive);
    return () => window.removeEventListener('active-competition-changed', refreshActive);
  }, []);

  useEffect(() => {
    if (!eventKey) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const rows = await statbotics.fetchEventTeamStats(eventKey);
        setStats(rows);
      } catch (error) {
        showToast('Failed to load Statbotics data');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [eventKey]);

  const sortedStats = useMemo(
    () => [...stats].sort((a, b) => (b.epa ?? -999) - (a.epa ?? -999)),
    [stats]
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24 px-4">
      <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl">
        <h2 className="text-2xl font-bold text-white">Statbotics Team Stats</h2>
        {eventKey ? (
          <p className="text-slate-400 mt-2">
            Active event: <span className="font-mono text-blue-300">{eventKey.toUpperCase()}</span>
          </p>
        ) : (
          <p className="text-slate-400 mt-2">Set an active competition profile on Home to load Statbotics data.</p>
        )}
      </div>

      {isLoading ? (
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl text-slate-300">Loading Statbotics data…</div>
      ) : sortedStats.length === 0 ? (
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl text-slate-300">No Statbotics data available.</div>
      ) : (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/70 text-slate-400">
                <tr>
                  <th className="px-5 py-4">Team</th>
                  <th className="px-5 py-4">EPA</th>
                  <th className="px-5 py-4">Average Points</th>
                  <th className="px-5 py-4">Predicted Win Rate</th>
                  <th className="px-5 py-4">Record</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {sortedStats.map((team) => (
                  <tr key={team.teamNumber}>
                    <td className="px-5 py-3 font-mono text-white">{team.teamNumber}</td>
                    <td className="px-5 py-3">{team.epa == null ? 'N/A' : team.epa.toFixed(2)}</td>
                    <td className="px-5 py-3">{team.avgPoints == null ? 'N/A' : team.avgPoints.toFixed(1)}</td>
                    <td className="px-5 py-3">
                      {team.predictedWinRate == null ? 'N/A' : `${(team.predictedWinRate * 100).toFixed(0)}%`}
                    </td>
                    <td className="px-5 py-3">{team.record}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
