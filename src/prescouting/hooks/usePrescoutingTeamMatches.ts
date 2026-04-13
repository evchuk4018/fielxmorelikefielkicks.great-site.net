import { useEffect, useMemo, useState } from 'react';
import { TBAMatch } from '../../types';
import { loadTeamMatchesForPrescouting } from '../matchData';

export function usePrescoutingTeamMatches(teamNumber: number | null, year: number) {
  const [matches, setMatches] = useState<TBAMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamNumber) {
      setMatches([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const run = async () => {
      try {
        const loaded = await loadTeamMatchesForPrescouting(teamNumber, year);
        if (!cancelled) {
          setMatches(loaded);
        }
      } catch (loadError) {
        if (!cancelled) {
          setMatches([]);
          setError(loadError instanceof Error ? loadError.message : 'Failed to load team matches.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [teamNumber, year]);

  const hasMatches = useMemo(() => matches.length > 0, [matches.length]);

  return {
    matches,
    hasMatches,
    isLoading,
    error,
  };
}
