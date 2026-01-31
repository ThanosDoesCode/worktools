import { useState, useEffect, useCallback } from 'react';
import { UserDefaults, getDefaults, setDefaults as setDefaultsDb } from '@/lib/localDb';

export function useDefaults() {
  const [defaults, setDefaultsState] = useState<UserDefaults>({
    exportFilenamePattern: '{toolname}_{date}',
    preferredQualityPreset: 'balanced',
    defaultCurrency: 'EUR',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Load defaults on mount
  useEffect(() => {
    loadDefaults();
  }, []);

  const loadDefaults = async () => {
    setIsLoading(true);
    try {
      const stored = await getDefaults();
      setDefaultsState(stored);
    } catch (error) {
      console.error('Failed to load defaults:', error);
    }
    setIsLoading(false);
  };

  const updateDefaults = useCallback(async (updates: Partial<UserDefaults>) => {
    try {
      const updated = await setDefaultsDb(updates);
      setDefaultsState(updated);
      setLastSaved(new Date());
      return updated;
    } catch (error) {
      console.error('Failed to update defaults:', error);
      throw error;
    }
  }, []);

  return {
    defaults,
    isLoading,
    lastSaved,
    updateDefaults,
    refreshDefaults: loadDefaults,
  };
}
