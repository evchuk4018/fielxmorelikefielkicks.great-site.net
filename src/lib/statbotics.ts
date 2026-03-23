import { storage } from './storage';
import { StatboticsTeamStats } from '../types';

type StatboticsResponse = {
  team: number;
  norm_epa_mean?: number;
  points_mean?: number;
  record?: {
    wins?: number;
    losses?: number;
    ties?: number;
  };
  winrate?: number;
};

function mapResponseToStats(item: StatboticsResponse): StatboticsTeamStats {
  const wins = item.record?.wins ?? 0;
  const losses = item.record?.losses ?? 0;
  const ties = item.record?.ties ?? 0;
  return {
    teamNumber: item.team,
    epa: typeof item.norm_epa_mean === 'number' ? item.norm_epa_mean : null,
    avgPoints: typeof item.points_mean === 'number' ? item.points_mean : null,
    predictedWinRate: typeof item.winrate === 'number' ? item.winrate : null,
    record: `${wins}-${losses}-${ties}`,
  };
}

export const statbotics = {
  async fetchEventTeamStats(eventKey: string): Promise<StatboticsTeamStats[]> {
    const response = await fetch(`/api/statbotics/event/${encodeURIComponent(eventKey)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch Statbotics event stats');
    }
    const payload = await response.json();
    const rows = Array.isArray(payload) ? payload : [];
    const stats = rows.map(mapResponseToStats).sort((a, b) => a.teamNumber - b.teamNumber);
    storage.set(`statbotics:${eventKey}`, stats);
    return stats;
  },

  getEventTeamStats(eventKey: string): StatboticsTeamStats[] {
    return storage.get<StatboticsTeamStats[]>(`statbotics:${eventKey}`) || [];
  },
};
