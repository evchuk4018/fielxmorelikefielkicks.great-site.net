import { MatchScoutData } from '../types';
import { storage } from './storage';

export const gemini = {
  getBackendUrl(): string {
    return storage.get<string>('backendUrl') || window.location.origin;
  },

  async analyzeCSV(csvData: string): Promise<MatchScoutData[]> {
    const response = await fetch(`${this.getBackendUrl()}/api/gemini/analyze-csv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ csvData }),
    });

    if (!response.ok) {
      throw new Error('Failed to analyze CSV');
    }

    return response.json() as Promise<MatchScoutData[]>;
  }
};
