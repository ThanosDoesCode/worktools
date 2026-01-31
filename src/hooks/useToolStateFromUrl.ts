import { useEffect, useRef } from 'react';
import { decodeToolState, getStateFromUrl, clearStateFromUrl } from '@/lib/urlState';

export function useToolStateFromUrl(
  toolSlug: string,
  setSettings: (settings: Record<string, unknown>) => void,
  defaultSettings: Record<string, unknown>
): { hasUrlState: boolean; clearUrlState: () => void } {
  const hasHydrated = useRef(false);
  const hasUrlState = useRef(false);

  useEffect(() => {
    if (hasHydrated.current) return;
    hasHydrated.current = true;

    const encoded = getStateFromUrl();
    if (!encoded) return;

    const decoded = decodeToolState(encoded);
    if (!decoded) return;

    if (decoded.toolSlug !== toolSlug) {
      console.warn(`URL state toolSlug mismatch: expected ${toolSlug}, got ${decoded.toolSlug}`);
      return;
    }

    // Merge with defaults to ensure all keys exist
    const mergedSettings = { ...defaultSettings, ...decoded.settings };
    setSettings(mergedSettings);
    hasUrlState.current = true;
  }, [toolSlug, setSettings, defaultSettings]);

  const clearUrlState = () => {
    clearStateFromUrl();
    setSettings(defaultSettings);
    hasUrlState.current = false;
  };

  return {
    hasUrlState: hasUrlState.current,
    clearUrlState,
  };
}
