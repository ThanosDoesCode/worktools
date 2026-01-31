import { useState, useEffect, useCallback } from 'react';
import {
  Preset,
  listPresets,
  upsertPreset,
  deletePreset as deletePresetDb,
  setPinned as setPinnedDb,
  getLastSettings,
} from '@/lib/localDb';

export interface RecommendedPreset {
  id: string;
  name: string;
  description?: string;
  settings: Record<string, unknown>;
}

export function usePresets(
  toolSlug: string,
  currentSettings: Record<string, unknown>,
  setSettings: (settings: Record<string, unknown>) => void,
  defaultSettings: Record<string, unknown>,
  recommendedPresets: RecommendedPreset[] = []
) {
  const [userPresets, setUserPresets] = useState<Preset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Load presets on mount
  useEffect(() => {
    loadPresets();
  }, [toolSlug]);

  const loadPresets = async () => {
    setIsLoading(true);
    try {
      const presets = await listPresets(toolSlug);
      setUserPresets(presets);
    } catch (error) {
      console.error('Failed to load presets:', error);
    }
    setIsLoading(false);
  };

  const applyPreset = useCallback((preset: RecommendedPreset | Preset) => {
    const mergedSettings = { ...defaultSettings, ...preset.settings };
    setSettings(mergedSettings);
  }, [defaultSettings, setSettings]);

  const saveCurrentAsPreset = useCallback(async (name: string, description?: string) => {
    try {
      const newPreset = await upsertPreset(toolSlug, {
        name,
        description,
        settings: currentSettings,
        pinned: false,
      });
      setUserPresets((prev) => [newPreset, ...prev]);
      setLastSaved(new Date());
      return newPreset;
    } catch (error) {
      console.error('Failed to save preset:', error);
      throw error;
    }
  }, [toolSlug, currentSettings]);

  const renamePreset = useCallback(async (presetId: string, newName: string) => {
    const preset = userPresets.find((p) => p.id === presetId);
    if (!preset) return;

    try {
      const updated = await upsertPreset(toolSlug, {
        ...preset,
        name: newName,
      });
      setUserPresets((prev) =>
        prev.map((p) => (p.id === presetId ? updated : p))
      );
    } catch (error) {
      console.error('Failed to rename preset:', error);
      throw error;
    }
  }, [toolSlug, userPresets]);

  const deletePreset = useCallback(async (presetId: string) => {
    try {
      await deletePresetDb(presetId);
      setUserPresets((prev) => prev.filter((p) => p.id !== presetId));
    } catch (error) {
      console.error('Failed to delete preset:', error);
      throw error;
    }
  }, []);

  const togglePinned = useCallback(async (presetId: string) => {
    const preset = userPresets.find((p) => p.id === presetId);
    if (!preset) return;

    try {
      await setPinnedDb(presetId, !preset.pinned);
      setUserPresets((prev) =>
        prev.map((p) => (p.id === presetId ? { ...p, pinned: !p.pinned } : p))
      );
    } catch (error) {
      console.error('Failed to toggle pinned:', error);
      throw error;
    }
  }, [userPresets]);

  const useLastSettings = useCallback(async () => {
    try {
      const last = await getLastSettings(toolSlug);
      if (last) {
        const mergedSettings = { ...defaultSettings, ...last };
        setSettings(mergedSettings);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to load last settings:', error);
      return false;
    }
  }, [toolSlug, defaultSettings, setSettings]);

  const resetToDefaults = useCallback(() => {
    setSettings(defaultSettings);
  }, [defaultSettings, setSettings]);

  return {
    userPresets,
    recommendedPresets,
    isLoading,
    lastSaved,
    applyPreset,
    saveCurrentAsPreset,
    renamePreset,
    deletePreset,
    togglePinned,
    useLastSettings,
    resetToDefaults,
    refreshPresets: loadPresets,
  };
}
