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
 * Per the Bungie API spec: Destiny.Definitions.Items
 * .DestinyEquipableItemSetDefinition, reachable through the entity endpoint
 * /Destiny2/Manifest/{entityType}/{hashIdentifier}/.
 */
const SET_TABLE = 'DestinyEquipableItemSetDefinition';

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
    response = await fetchDefinition(SET_TABLE, key);
  } catch (e) {
    response = null;
  }

  // Cache the miss too: without it every armour piece of an unknown set would
  // re-request it on every profile refresh.
  if (!response) {
    memoryCache.set(key, null);
    return null;
  }

  // setPerks -- "the perks conferred by this set of armor pieces". Each entry
  // is a DestinyItemSetPerkDefinition, which carries only requiredSetCount and
  // sandboxPerkHash: it has no display properties of its own, so the name and
  // description have to come from the sandbox perk behind it.
  const rawPerks = Array.isArray(response.setPerks) ? response.setPerks : [];
  const bonuses = [];

  for (const perk of rawPerks) {
    const count = perk.requiredSetCount;
    if (count === null || count === undefined) continue;
    const sandbox = await getSandboxPerk(perk.sandboxPerkHash);
    bonuses.push({
      count,
      name: sandbox?.name || `${count}-piece bonus`,
      description: sandbox?.description || ''
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
