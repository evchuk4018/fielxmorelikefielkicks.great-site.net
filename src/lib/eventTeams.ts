import { TBATeam } from '../types';

type StatboticsTeamLike = {
  team?: unknown;
  team_number?: unknown;
  nickname?: unknown;
  name?: unknown;
};

function toTeamNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function mergeEventTeams(baseTeams: TBATeam[], statboticsRows: unknown): TBATeam[] {
  const merged = new Map<number, TBATeam>();

  baseTeams.forEach((team) => {
    if (!Number.isInteger(team?.team_number) || team.team_number <= 0) {
      return;
    }

    merged.set(team.team_number, team);
  });

  if (Array.isArray(statboticsRows)) {
    statboticsRows.forEach((row) => {
      const candidate = row as StatboticsTeamLike;
      const teamNumber = toTeamNumber(candidate.team_number ?? candidate.team);
      if (!teamNumber) {
        return;
      }

      const existing = merged.get(teamNumber);
      const nickname = toText(candidate.nickname) || toText(candidate.name);

      if (existing) {
        if (!existing.nickname && nickname) {
          merged.set(teamNumber, {
            ...existing,
            nickname,
            name: existing.name || nickname,
          });
        }
        return;
      }

      const resolvedName = nickname || `Team ${teamNumber}`;
      merged.set(teamNumber, {
        key: `frc${teamNumber}`,
        team_number: teamNumber,
        nickname: resolvedName,
        name: resolvedName,
        city: '',
        state_prov: '',
        country: '',
      });
    });
  }

  return Array.from(merged.values()).sort((a, b) => a.team_number - b.team_number);
}
