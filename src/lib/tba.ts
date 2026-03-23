import { storage } from './storage';
import { TBATeam, TBAMatch } from '../types';

export const tba = {
  async fetchEvent(eventKey: string): Promise<{ key: string; name?: string; short_name?: string; event_type_string?: string; year?: number; city?: string; state_prov?: string; country?: string }> {
    const response = await fetch(`/api/tba/event/${encodeURIComponent(eventKey)}`);
    if (!response.ok) throw new Error('Failed to fetch event');
    return response.json();
  },

  async fetchTeams(eventKey: string): Promise<TBATeam[]> {
    const response = await fetch(`/api/tba/teams/${encodeURIComponent(eventKey)}`);
    if (!response.ok) throw new Error('Failed to fetch teams');
    const teams = await response.json();
    storage.set('tbaTeams', teams);
    storage.set(`tbaTeams:${eventKey}`, teams);
    return teams;
  },

  async fetchMatches(eventKey: string): Promise<TBAMatch[]> {
    const response = await fetch(`/api/tba/matches/${encodeURIComponent(eventKey)}`);
    if (!response.ok) throw new Error('Failed to fetch matches');
    const matches = await response.json();
    storage.set('tbaMatches', matches);
    storage.set(`tbaMatches:${eventKey}`, matches);
    return matches;
  },

  getTeams(): TBATeam[] {
    return storage.get<TBATeam[]>('tbaTeams') || [];
  },

  getMatches(): TBAMatch[] {
    return storage.get<TBAMatch[]>('tbaMatches') || [];
  },

  getTeamsForEvent(eventKey: string): TBATeam[] {
    return storage.get<TBATeam[]>(`tbaTeams:${eventKey}`) || [];
  },

  getMatchesForEvent(eventKey: string): TBAMatch[] {
    return storage.get<TBAMatch[]>(`tbaMatches:${eventKey}`) || [];
  }
};
