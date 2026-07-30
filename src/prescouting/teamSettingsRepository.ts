import { supabase } from '../lib/supabase';
import { PrescoutingTeamSettings } from './types';

export const PRESCOUTING_TEAM_LIST_UPDATED_EVENT = 'prescouting-team-list-updated';

type PrescoutingSettingsRow = {
  season_year: number;
  team_numbers: unknown;
};

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

export function normalizePrescoutingTeamNumbers(value: unknown): number[] {
  let candidate = value;
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      candidate = [];
    }
  }

  if (!Array.isArray(candidate)) {
    return [];
  }

  return Array.from(
    new Set(
      candidate
        .map(parsePositiveInteger)
        .filter((teamNumber): teamNumber is number => teamNumber !== null),
    ),
  ).sort((a, b) => a - b);
}

export function parsePrescoutingTeamNumbersInput(input: string): {
  teamNumbers: number[];
  invalidTokens: string[];
} {
  const tokens = input.split(/[\s,]+/).map((token) => token.trim()).filter(Boolean);
  const invalidTokens: string[] = [];
  const teamNumbers: number[] = [];

  tokens.forEach((token) => {
    const parsed = parsePositiveInteger(token);
    if (parsed === null) {
      invalidTokens.push(token);
      return;
    }

    teamNumbers.push(parsed);
  });

  return {
    teamNumbers: normalizePrescoutingTeamNumbers(teamNumbers),
    invalidTokens,
  };
}

function validateSeasonYear(seasonYear: number): void {
  if (!Number.isInteger(seasonYear) || seasonYear <= 0) {
    throw new Error('A valid Prescouting season year is required.');
  }
}

export async function getPrescoutingTeamSettings(seasonYear: number): Promise<PrescoutingTeamSettings> {
  validateSeasonYear(seasonYear);

  const { data, error } = await supabase
    .from('prescouting_settings')
    .select('season_year, team_numbers')
    .eq('season_year', seasonYear)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Failed to load Prescouting team settings.');
  }

  const row = data as PrescoutingSettingsRow | null;
  return {
    seasonYear,
    teamNumbers: normalizePrescoutingTeamNumbers(row?.team_numbers),
  };
}

export async function getPrescoutingTeamNumbers(seasonYear: number): Promise<number[]> {
  const settings = await getPrescoutingTeamSettings(seasonYear);
  return settings.teamNumbers;
}

export async function savePrescoutingTeamNumbers(input: {
  seasonYear: number;
  teamNumbers: number[];
  isAdmin: boolean;
}): Promise<PrescoutingTeamSettings> {
  if (!input.isAdmin) {
    throw new Error('Only admins can update Prescouting team settings.');
  }

  validateSeasonYear(input.seasonYear);
  const teamNumbers = normalizePrescoutingTeamNumbers(input.teamNumbers);
  const { data, error } = await supabase
    .from('prescouting_settings')
    .upsert(
      {
        season_year: input.seasonYear,
        team_numbers: teamNumbers,
      },
      { onConflict: 'season_year' },
    )
    .select('season_year, team_numbers')
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to save Prescouting team settings.');
  }

  const row = data as PrescoutingSettingsRow;
  return {
    seasonYear: row.season_year,
    teamNumbers: normalizePrescoutingTeamNumbers(row.team_numbers),
  };
}
