import { useEffect, useState } from 'react';
import { DEFAULT_SEASON_CONFIGURATION, getCachedSeasonConfiguration, loadSeasonConfiguration, SEASON_CONFIGURATION_UPDATED_EVENT } from '../../lib/seasonConfiguration';
import { SeasonConfiguration } from '../../types';

export function useSeasonConfiguration() {
  const [configuration, setConfiguration] = useState<SeasonConfiguration>(() => getCachedSeasonConfiguration() || DEFAULT_SEASON_CONFIGURATION);
  const [isLoading, setIsLoading] = useState(() => !getCachedSeasonConfiguration());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadSeasonConfiguration()
      .then((loaded) => {
        if (!cancelled) {
          setConfiguration(loaded);
          setError(null);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load season configuration.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<SeasonConfiguration>).detail;
      if (detail) {
        setConfiguration(detail);
        setError(null);
      }
    };
    window.addEventListener(SEASON_CONFIGURATION_UPDATED_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(SEASON_CONFIGURATION_UPDATED_EVENT, refresh);
    };
  }, []);

  return { configuration, isLoading, error };
}
