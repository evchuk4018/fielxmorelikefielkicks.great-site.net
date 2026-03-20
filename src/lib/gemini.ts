import { MatchScoutData } from '../types';

export const gemini = {
  async analyzeCSV(csvData: string): Promise<MatchScoutData[]> {
    const response = await fetch('/api/gemini/analyze-csv', {
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
