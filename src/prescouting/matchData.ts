import { compLevelSortOrder, extractEventKeyFromMatchKey, toTeamNumber, toYoutubeEmbedUrl } from '../lib/matchUtils';
import { tba } from '../lib/tba';
import { TBAMatch, TBAMatchDetail, TBAVideo } from '../types';

function normalizeMatchKey(value: string): string {
  return value.trim().toLowerCase();
}

export function getMatchEventKey(match: TBAMatch): string {
  const fromPayload = typeof match.event_key === 'string' ? match.event_key.trim().toLowerCase() : '';
  if (fromPayload) {
    return fromPayload;
  }

  return extractEventKeyFromMatchKey(match.key);
}

export function matchIncludesTeam(match: TBAMatch, teamNumber: number): boolean {
  const red = (match.alliances?.red?.team_keys || []).map(toTeamNumber);
  const blue = (match.alliances?.blue?.team_keys || []).map(toTeamNumber);
  return red.includes(teamNumber) || blue.includes(teamNumber);
}

export function sortMatches(matches: TBAMatch[]): TBAMatch[] {
  return [...matches].sort((a, b) => {
    const levelSort = compLevelSortOrder(a.comp_level) - compLevelSortOrder(b.comp_level);
    if (levelSort !== 0) {
      return levelSort;
    }

    if (a.set_number !== b.set_number) {
      return a.set_number - b.set_number;
    }

    if (a.match_number !== b.match_number) {
      return a.match_number - b.match_number;
    }

    return normalizeMatchKey(a.key).localeCompare(normalizeMatchKey(b.key));
  });
}

export function dedupeMatches(matches: TBAMatch[]): TBAMatch[] {
  const byKey = new Map<string, TBAMatch>();
  matches.forEach((match) => {
    const key = normalizeMatchKey(match.key);
    if (!key) {
      return;
    }

    byKey.set(key, {
      ...match,
      key,
      event_key: getMatchEventKey(match),
    });
  });

  return sortMatches(Array.from(byKey.values()));
}

export async function loadTeamMatchesForPrescouting(teamNumber: number, year: number): Promise<TBAMatch[]> {
  const matches = await tba.fetchTeamMatchesByYear(teamNumber, year);
  return dedupeMatches(matches).filter((match) => matchIncludesTeam(match, teamNumber));
}

export async function loadAllTeamMatchesForPrescouting(teamNumbers: number[], year: number): Promise<Map<number, TBAMatch[]>> {
  const output = new Map<number, TBAMatch[]>();
  const queue = [...teamNumbers];
  const workerCount = Math.max(1, Math.min(6, queue.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (queue.length > 0) {
        const nextTeam = queue.shift();
        if (!nextTeam) {
          return;
        }

        const matches = await loadTeamMatchesForPrescouting(nextTeam, year);
        output.set(nextTeam, matches);
      }
    }),
  );

  return output;
}

export function pickYoutubeVideo(videos: TBAVideo[] | undefined): TBAVideo | null {
  if (!Array.isArray(videos)) {
    return null;
  }

  const youtube = videos.find((video) => video.type === 'youtube' && typeof video.key === 'string' && video.key.trim());
  return youtube || null;
}

export async function loadYoutubeVideoForMatch(matchKey: string): Promise<{ videoKey: string; embedUrl: string } | null> {
  const detail: TBAMatchDetail = await tba.fetchMatchDetail(matchKey);
  const youtube = pickYoutubeVideo(detail.videos);
  if (!youtube) {
    return null;
  }

  return {
    videoKey: youtube.key,
    embedUrl: toYoutubeEmbedUrl(youtube.key),
  };
}
