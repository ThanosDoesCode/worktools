import { useCallback } from 'react';
import { usePresets, RecommendedPreset } from './usePresets';
import { useToolStateFromUrl } from './useToolStateFromUrl';
import { useVault } from './useVault';

interface UseMoatOptions {
  toolSlug: string;
  defaultSettings: Record<string, unknown>;
  recommendedPresets?: RecommendedPreset[];
}

export function useMoat(
  currentSettings: Record<string, unknown>,
  setSettings: (settings: Record<string, unknown>) => void,
  options: UseMoatOptions
) {
  const { toolSlug, defaultSettings, recommendedPresets = [] } = options;

  // URL state hydration
  const { hasUrlState, clearUrlState } = useToolStateFromUrl(
    toolSlug,
    setSettings,
    defaultSettings
  );

  // Presets management
  const presets = usePresets(
    toolSlug,
    currentSettings,
    setSettings,
    defaultSettings,
    recommendedPresets
  );

  // Vault for job history
  const vault = useVault();

  // Record a job when user runs the tool
  const recordJob = useCallback(
    async (inputMeta: Array<{ name: string; size?: number }> = []) => {
      try {
        await vault.addJob(toolSlug, currentSettings, inputMeta);
      } catch (error) {
        console.error('Failed to record job:', error);
      }
    },
    [vault, toolSlug, currentSettings]
  );

  return {
    // URL state
    hasUrlState,
    clearUrlState,

    // Presets
    userPresets: presets.userPresets,
    recommendedPresets: presets.recommendedPresets,
    isLoadingPresets: presets.isLoading,
    applyPreset: presets.applyPreset,
    saveCurrentAsPreset: presets.saveCurrentAsPreset,
    renamePreset: presets.renamePreset,
    deletePreset: presets.deletePreset,
    togglePinned: presets.togglePinned,
    useLastSettings: presets.useLastSettings,
    resetToDefaults: presets.resetToDefaults,

    // Vault
    recordJob,

    // Tool info
    toolSlug,
    defaultSettings,
  };
}
