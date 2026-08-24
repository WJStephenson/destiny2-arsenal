import { getStoredSettings } from './auth-storage';

/**
 * Armour set definitions -- the names and the 2-piece / 4-piece bonuses.
 *
 * Live armour arrives carrying only a set *hash*: the item definition points at
 * its set but says nothing about it. Without this the optimizer can tell that
 * five pieces belong to the same set but not what that set is called or what
 * wearing it does, which is how the selector ended up listing "Unnamed set".
 *
 * Resolved from the manifest entity endpoint rather than the bundled data, so
 * it works without a manifest re-sync.
 */

const memoryCache = new Map();
const perkCache = new Map();

/**
 * The definition table has been named differently across manifest versions.
 * The first name that answers is remembered, so the cost of guessing is paid
 * once per session rather than per set.
 */
const SET_TABLE_CANDIDATES = [
  'DestinyEquipableItemSetDefinition',
  'DestinyItemSetDefinition'
];
let resolvedSetTable = null;

function authHeaders() {
  const settings = getStoredSettings();
  return settings.apiKey ? { 'X-API-Key': settings.apiKey } : {};
}

async function fetchDefinition(table, hash) {
  const res = await fetch(
    `https://www.bungie.net/Platform/Destiny2/Manifest/${table}/${hash}/`,
    { headers: authHeaders() }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.Response || null;
}

/** Sandbox perk behind a set bonus, for its name and description. */
async function getSandboxPerk(perkHash) {
  if (!perkHash) return null;
  const key = String(perkHash);
  if (perkCache.has(key)) return perkCache.get(key);

  let perk = null;
  try {
    const def = await fetchDefinition('DestinySandboxPerkDefinition', key);
    if (def) {
      perk = {
        name: def.displayProperties?.name || '',
        description: def.displayProperties?.description || ''
      };
    }
  } catch (e) {
    // A missing perk description is not worth failing the whole set over.
  }

  perkCache.set(key, perk);
  return perk;
}

export async function getSetDefinition(setHash) {
  if (setHash === null || setHash === undefined) return null;
  const key = String(setHash);

  if (memoryCache.has(key)) return memoryCache.get(key);

  try {
    const cached = sessionStorage.getItem(`d2_set_${key}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      memoryCache.set(key, parsed);
      return parsed;
    }
  } catch (e) {}

  let response = null;
  try {
    const tables = resolvedSetTable ? [resolvedSetTable] : SET_TABLE_CANDIDATES;
    for (const table of tables) {
      response = await fetchDefinition(table, key);
      if (response) {
        resolvedSetTable = table;
        break;
      }
    }
  } catch (e) {
    response = null;
  }

  // Cache the miss too: without it every armour piece of an unknown set would
  // re-request it on every profile refresh.
  if (!response) {
    memoryCache.set(key, null);
    return null;
  }

  // Field naming has moved around, so each known spelling is probed.
  const rawPerks = response.setPerks || response.perks || response.setBonuses || [];
  const bonuses = [];

  for (const perk of Array.isArray(rawPerks) ? rawPerks : []) {
    const count = perk.requiredSetCount ?? perk.setCount ?? perk.requiredCount ?? null;
    if (count === null) continue;
    const sandbox = await getSandboxPerk(perk.sandboxPerkHash ?? perk.perkHash);
    bonuses.push({
      count,
      name: sandbox?.name || perk.displayProperties?.name || `${count}-piece bonus`,
      description: sandbox?.description || perk.displayProperties?.description || ''
    });
  }

  bonuses.sort((a, b) => a.count - b.count);

  const def = {
    hash: response.hash ?? Number(key),
    name: response.displayProperties?.name || '',
    bonuses
  };

  memoryCache.set(key, def);
  try {
    sessionStorage.setItem(`d2_set_${key}`, JSON.stringify(def));
  } catch (e) {}

  return def;
}

export async function batchResolveSetDefinitions(setHashes) {
  const unique = [...new Set(setHashes.filter(h => h !== null && h !== undefined))];
  const results = {};

  const chunkSize = 10;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async (h) => {
      const def = await getSetDefinition(h);
      if (def) results[String(h)] = def;
    }));
  }

  return results;
}
