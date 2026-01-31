// URL State encoding/decoding utilities

export interface ToolState {
  v: number;
  toolSlug: string;
  settings: Record<string, unknown>;
}

// Base64url encode (URL-safe)
function base64UrlEncode(str: string): string {
  const base64 = btoa(unescape(encodeURIComponent(str)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Base64url decode
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return decodeURIComponent(escape(atob(base64)));
}

export function encodeToolState(toolSlug: string, settings: Record<string, unknown>): string {
  const state: ToolState = {
    v: 1,
    toolSlug,
    settings,
  };
  return base64UrlEncode(JSON.stringify(state));
}

export function decodeToolState(encoded: string): ToolState | null {
  try {
    const json = base64UrlDecode(encoded);
    const parsed = JSON.parse(json);
    
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (typeof parsed.v !== 'number') return null;
    if (typeof parsed.toolSlug !== 'string') return null;
    if (typeof parsed.settings !== 'object' || parsed.settings === null) return null;
    
    return parsed as ToolState;
  } catch {
    return null;
  }
}

export function getStateFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('state');
}

export function buildShareableUrl(toolSlug: string, settings: Record<string, unknown>): string {
  const encoded = encodeToolState(toolSlug, settings);
  const url = new URL(window.location.href);
  url.searchParams.set('state', encoded);
  return url.toString();
}

export function clearStateFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('state');
  window.history.replaceState({}, '', url.toString());
}
