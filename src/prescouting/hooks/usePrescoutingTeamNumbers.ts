import { useCallback, useEffect, useState } from 'react';
import { getPrescoutingTeamNumbers, PRESCOUTING_TEAM_LIST_UPDATED_EVENT } from '../teamSettingsRepository';

type UsePrescoutingTeamNumbersParams = {
  seasonYear: number;
  enabled?: boolean;
};

export function usePrescoutingTeamNumbers({ seasonYear, enabled = true }: UsePrescoutingTeamNumbersParams) {
  const [teamNumbers, setTeamNumbers] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) {
      setTeamNumbers([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      setTeamNumbers(await getPrescoutingTeamNumbers(seasonYear));
    } catch (loadError) {
      setTeamNumbers([]);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load Prescouting teams.');
    } finally {
      setIsLoading(false);
    }
  }, [enabled, seasonYear]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const refresh = () => {
      void reload();
    };

    window.addEventListener(PRESCOUTING_TEAM_LIST_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(PRESCOUTING_TEAM_LIST_UPDATED_EVENT, refresh);
  }, [reload]);

  return { teamNumbers, isLoading, error, reload };
}
