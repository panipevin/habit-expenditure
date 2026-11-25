import type { ConnectedViewer, WidgetConfig } from '../types';

export const MAX_CONNECTED_VIEWERS = 25;

// Excludes ambiguous characters (0, O, 1, I) while strictly matching Firestore's ^[A-Z0-9]+$ rule.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateShareInviteCode(length = 6): string {
  const safeLen = Math.max(6, Math.min(16, Math.floor(length)));
  let out = '';
  for (let i = 0; i < safeLen; i++) {
    const idx = Math.floor(Math.random() * CODE_ALPHABET.length);
    out += CODE_ALPHABET[idx];
  }
  return out;
}

export function normalizeShareInviteCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16);
}

export function isValidShareInviteCode(code: string): boolean {
  return /^[A-Z0-9]{6,16}$/.test(code);
}

export function sanitizeDisplayName(name: string | null | undefined, fallback = 'Family Member'): string {
  const clean = (name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  return clean || fallback;
}

export function addViewerToAccessList(
  viewerIds: string[],
  viewerNames: Record<string, string>,
  viewerUid: string,
  viewerName: string,
  ownerUid: string
): { viewerIds: string[]; viewerNames: Record<string, string>; changed: boolean } {
  const cleanUid = viewerUid.trim();
  if (!cleanUid || cleanUid === ownerUid) {
    return { viewerIds, viewerNames, changed: false };
  }

  const cleanName = sanitizeDisplayName(viewerName, `Member ${cleanUid.slice(0, 6)}`);
  const alreadyPresent = viewerIds.includes(cleanUid);

  if (alreadyPresent) {
    if (viewerNames[cleanUid] === cleanName) {
      return { viewerIds, viewerNames, changed: false };
    }
    return {
      viewerIds,
      viewerNames: { ...viewerNames, [cleanUid]: cleanName },
      changed: true,
    };
  }

  if (viewerIds.length >= MAX_CONNECTED_VIEWERS) {
    return { viewerIds, viewerNames, changed: false };
  }

  return {
    viewerIds: [...viewerIds, cleanUid],
    viewerNames: { ...viewerNames, [cleanUid]: cleanName },
    changed: true,
  };
}

export function removeViewerFromAccessList(
  viewerIds: string[],
  viewerNames: Record<string, string>,
  viewerUid: string
): { viewerIds: string[]; viewerNames: Record<string, string> } {
  const nextIds = viewerIds.filter((id) => id !== viewerUid);
  const nextNames: Record<string, string> = {};
  for (const id of nextIds) {
    if (viewerNames[id]) {
      nextNames[id] = viewerNames[id];
    }
  }
  return { viewerIds: nextIds, viewerNames: nextNames };
}

export function buildConnectedViewersList(
  viewerIds: string[],
  viewerNames: Record<string, string>
): ConnectedViewer[] {
  return viewerIds.map((uid) => ({
    uid,
    name: sanitizeDisplayName(viewerNames[uid], `Member ${uid.slice(0, 6)}`),
  }));
}

export function migrateLegacyWidgets(
  rawWidgets: unknown,
  defaultWidgets: WidgetConfig[]
): WidgetConfig[] {
  if (!Array.isArray(rawWidgets) || rawWidgets.length === 0) {
    return defaultWidgets;
  }

  const allowedIds = new Set(defaultWidgets.map((w) => w.id));
  const seen = new Set<string>();
  const migrated: WidgetConfig[] = [];

  for (const item of rawWidgets) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as { id?: string; title?: string; visible?: boolean; size?: string };
    const mappedId = raw.id === 'boards' ? 'family' : raw.id;
    if (!mappedId || !allowedIds.has(mappedId as WidgetConfig['id']) || seen.has(mappedId)) {
      continue;
    }
    seen.add(mappedId);
    const defaultMatch = defaultWidgets.find((w) => w.id === mappedId)!;
    migrated.push({
      id: defaultMatch.id,
      title: raw.id === 'boards' ? defaultMatch.title : raw.title || defaultMatch.title,
      visible: typeof raw.visible === 'boolean' ? raw.visible : defaultMatch.visible,
      size: raw.size === 'wide' || raw.size === 'compact' ? raw.size : defaultMatch.size,
    });
  }

  for (const def of defaultWidgets) {
    if (!seen.has(def.id)) {
      migrated.push(def);
    }
  }

  return migrated;
}
