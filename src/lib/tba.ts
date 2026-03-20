import { storage } from './storage';
import { TBATeam, TBAMatch } from '../types';

export const tba = {
  getBackendUrl(): string {
    return storage.get<string>('backendUrl') || window.location.origin;
  },

  async fetchTeams(eventKey: string): Promise<TBATeam[]> {
    const response = await fetch(`${this.getBackendUrl()}/api/tba/teams/${eventKey}`);
    if (!response.ok) throw new Error('Failed to fetch teams');
    const teams = await response.json();
    storage.set('tbaTeams', teams);
    return teams;
  },

  async fetchMatches(eventKey: string): Promise<TBAMatch[]> {
    const response = await fetch(`${this.getBackendUrl()}/api/tba/matches/${eventKey}`);
    if (!response.ok) throw new Error('Failed to fetch matches');
    const matches = await response.json();
    storage.set('tbaMatches', matches);
    return matches;
  },

  getTeams(): TBATeam[] {
    return storage.get<TBATeam[]>('tbaTeams') || [];
  },

  getMatches(): TBAMatch[] {
    return storage.get<TBAMatch[]>('tbaMatches') || [];
  }
};
