import { TBAMatch } from '../types';

export function toTeamNumber(teamKey: string): number {
  return Number(teamKey.replace('frc', ''));
}

export function compLevelSortOrder(compLevel: string): number {
  switch (compLevel) {
    case 'qm':
      return 0;
    case 'ef':
      return 1;
    case 'qf':
      return 2;
    case 'sf':
      return 3;
    case 'f':
      return 4;
    default:
      return 5;
  }
}

export function formatMatchLabel(match: Pick<TBAMatch, 'comp_level' | 'set_number' | 'match_number'>): string {
  if (match.comp_level === 'qm') {
    return `QM ${match.match_number}`;
  }
  return `${match.comp_level.toUpperCase()} ${match.set_number}-${match.match_number}`;
}

export function extractEventKeyFromMatchKey(matchKey: string): string {
  const normalized = matchKey.trim().toLowerCase();
  const separatorIndex = normalized.indexOf('_');
  if (separatorIndex <= 0) {
    return '';
  }
  return normalized.slice(0, separatorIndex);
}

export function toYoutubeEmbedUrl(videoKey: string): string {
  const normalized = videoKey.trim();
  return `https://www.youtube.com/embed/${encodeURIComponent(normalized)}`;
}
