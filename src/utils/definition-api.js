import { getStoredSettings, ensureApiKey } from './auth-storage';

/**
 * Manifest definitions that are not inventory items -- plug sets, loadout
 * names, artifacts.
 *
 * The bundled manifest carries weapons, armour and perks only, so everything
 * here has to come from Bungie one hash at a time. Definitions never change, so
 * a resolved one is kept for the session and asked for once.
 */

const memoryCache = new Map();

/** Bungie's error codes for 'you are asking too quickly'. */
const THROTTLE_ERROR_CODES = new Set([51, 52, 53]);

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const cacheKey = (type, hash) => `${type}:${hash}`;

async function fetchWithRetry(url, headers, attempts = 3) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await wait(250 * (2 ** (attempt - 1)));

    try {
      const res = await fetch(url, { headers });
      // A rate limit or a server hiccup: worth asking again.
      if (res.status === 429 || res.status >= 500) continue;

      const data = await res.json();
      if (data?.Response) return data.Response;
      if (THROTTLE_ERROR_CODES.has(data?.ErrorCode)) continue;

      // Bungie answered and meant it (an unknown hash, a bad key).
      return null;
    } catch (e) {
      // Network error -- retry.
    }
  }
  return null;
}

/**
 * One manifest definition of any type, raw as Bungie sends it.
 * `type` is a definition table name, e.g. 'DestinyPlugSetDefinition'.
 */
export async function getDefinition(type, hash) {
  if (!type || hash === null || hash === undefined) return null;
  const key = cacheKey(type, hash);
  if (memoryCache.has(key)) return memoryCache.get(key);

  try {
    const cached = sessionStorage.getItem(`d2_gdef_${key}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      memoryCache.set(key, parsed);
      return parsed;
    }
  } catch (e) {}

  const settings = await ensureApiKey().catch(() => getStoredSettings());
  const headers = {};
  if (settings?.apiKey) headers['X-API-Key'] = settings.apiKey;

  const def = await fetchWithRetry(
    `https://www.bungie.net/Platform/Destiny2/Manifest/${type}/${hash}/`,
    headers
  );

  if (def) {
    memoryCache.set(key, def);
    try {
      sessionStorage.setItem(`d2_gdef_${key}`, JSON.stringify(def));
    } catch (e) {
      // Session storage is full or unavailable; the memory cache still holds.
    }
  }
  return def;
}

/**
 * Resolve many definitions of one type, in small waves.
 *
 * Bungie has no bulk definition endpoint, and a burst of requests is what gets
 * a profile rate-limited. Returns a hash-keyed object.
 */
export async function batchResolveDefinitions(type, hashes) {
  const unique = [...new Set((hashes || []).filter(h => h !== null && h !== undefined))];
  const results = {};

  const chunkSize = 8;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async (h) => {
      const def = await getDefinition(type, h);
      if (def) results[h] = def;
    }));
  }

  return results;
}

/** Display name / icon / description off any definition, in one shape. */
export function displayOf(def) {
  const display = def?.displayProperties || {};
  return {
    name: display.name || '',
    description: display.description || '',
    icon: display.icon ? `https://www.bungie.net${display.icon}` : null
  };
}

/**
 * The plug item hashes a plug set offers. This is the manifest's own list, so
 * it describes what exists rather than what the player owns -- the profile's
 * live plug sets are preferred wherever they are available.
 */
export async function getPlugSetItemHashes(plugSetHash) {
  const def = await getDefinition('DestinyPlugSetDefinition', plugSetHash);
  return (def?.reusablePlugItems || [])
    .map(p => p.plugItemHash)
    .filter(h => h !== null && h !== undefined);
}
