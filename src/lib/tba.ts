import { storage } from './storage';
import { TBATeam, TBAMatch, TBAEvent, TBARankings } from '../types';

export const tba = {
  async fetchEvent(eventKey: string): Promise<TBAEvent> {
    const normalizedEventKey = eventKey.trim().toLowerCase();
    console.log('[tba.fetchEvent] request', {
      originalEventKey: eventKey,
      normalizedEventKey,
    });
    const response = await fetch(`/api/tba/event/${encodeURIComponent(normalizedEventKey)}`);
    if (!response.ok) throw new Error('Failed to fetch event info');
    const event = await response.json();
    console.log('[tba.fetchEvent] success', {
      normalizedEventKey,
      eventName: event?.name || null,
    });
    return event;
  },

  async fetchTeams(eventKey: string): Promise<TBATeam[]> {
    const normalizedEventKey = eventKey.trim().toLowerCase();
    console.log('[tba.fetchTeams] request', {
      originalEventKey: eventKey,
      normalizedEventKey,
    });
    const response = await fetch(`/api/tba/teams/${encodeURIComponent(normalizedEventKey)}`);
    if (!response.ok) throw new Error('Failed to fetch teams');
    const teams = await response.json();
    storage.set('tbaTeams', teams);
    console.log('[tba.fetchTeams] success', {
      normalizedEventKey,
      teamCount: Array.isArray(teams) ? teams.length : 0,
    });
    return teams;
  },

  async fetchMatches(eventKey: string): Promise<TBAMatch[]> {
    const normalizedEventKey = eventKey.trim().toLowerCase();
    console.log('[tba.fetchMatches] request', {
      originalEventKey: eventKey,
      normalizedEventKey,
    });
    const response = await fetch(`/api/tba/matches/${encodeURIComponent(normalizedEventKey)}`);
    if (!response.ok) throw new Error('Failed to fetch matches');
    const matches = await response.json();
    storage.set('tbaMatches', matches);
    console.log('[tba.fetchMatches] success', {
      normalizedEventKey,
      matchCount: Array.isArray(matches) ? matches.length : 0,
    });
    return matches;
  },

  async fetchRankings(eventKey: string): Promise<TBARankings> {
    const normalizedEventKey = eventKey.trim().toLowerCase();
    console.log('[tba.fetchRankings] request', {
      originalEventKey: eventKey,
      normalizedEventKey,
    });
    const response = await fetch(`/api/tba/rankings/${encodeURIComponent(normalizedEventKey)}`);
    if (!response.ok) throw new Error('Failed to fetch rankings');
    const rankings = (await response.json()) as TBARankings;
    storage.set(`tbaRankings:${normalizedEventKey}`, rankings);
    storage.set('tbaRankings', rankings);
    console.log('[tba.fetchRankings] success', {
      normalizedEventKey,
      rankingCount: Array.isArray(rankings?.rankings) ? rankings.rankings.length : 0,
    });
    return rankings;
  },

  getTeams(): TBATeam[] {
    const teams = storage.get<TBATeam[]>('tbaTeams') || [];
    console.log('[tba.getTeams] cache', { teamCount: teams.length });
    return teams;
  },

  getMatches(): TBAMatch[] {
    return storage.get<TBAMatch[]>('tbaMatches') || [];
  },

  getRankings(eventKey?: string): TBARankings | null {
    if (eventKey) {
      const normalizedEventKey = eventKey.trim().toLowerCase();
      const scoped = storage.get<TBARankings>(`tbaRankings:${normalizedEventKey}`);
      if (scoped) {
        return scoped;
      }
    }

    return storage.get<TBARankings>('tbaRankings');
  }
};
