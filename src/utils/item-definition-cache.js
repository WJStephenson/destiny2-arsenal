import { getStoredSettings } from './auth-storage';

/** DestinyItemType.Subclass -- the only reliable marker of a subclass item. */
const SUBCLASS_ITEM_TYPE = 16;

const memoryCache = new Map();

/** Bungie's error code for 'you are asking too quickly'. */
const THROTTLE_ERROR_CODES = new Set([51, 52, 53]);

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Ask Bungie for one definition, retrying a failure that is worth retrying.
 *
 * A definition never changes, so a request that fails is only ever a transport
 * problem or a rate limit -- both of which pass. Backing off and asking again
 * costs a moment; giving up costs the item its name and icon for as long as the
 * profile is on screen.
 */
async function fetchDefinitionWithRetry(hashKey, headers, attempts = 3) {
  const url = `https://www.bungie.net/Platform/Destiny2/Manifest/DestinyInventoryItemDefinition/${hashKey}/`;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await wait(250 * (2 ** (attempt - 1)));

    try {
      const res = await fetch(url, { headers });

      // A rate limit or a server hiccup: worth asking again.
      if (res.status === 429 || res.status >= 500) continue;

      const data = await res.json();
      if (data?.Response) return data;
      if (THROTTLE_ERROR_CODES.has(data?.ErrorCode)) continue;

      // Bungie answered and meant it (an unknown hash, a bad key). Asking again
      // would get the same answer.
      return data;
    } catch (e) {
      // Network error -- retry.
    }
  }

  return null;
}

// Helper to get definition from Bungie Manifest API
export async function getItemDefinition(itemHash) {
  if (!itemHash) return null;
  const hashKey = String(itemHash);

  if (memoryCache.has(hashKey)) {
    return memoryCache.get(hashKey);
  }

  // Try sessionStorage
  try {
    const cached = sessionStorage.getItem(`d2_def3_${hashKey}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      memoryCache.set(hashKey, parsed);
      return parsed;
    }
  } catch (e) {}

  // Fetch from Bungie API. One definition at a time is all Bungie offers, so a
  // profile asks for a great many of them at once and a throttled or dropped
  // request is routine -- and an item whose definition never arrives renders as
  // a nameless, iconless tile. Hence the retries.
  try {
    const settings = getStoredSettings();
    const headers = {};
    if (settings.apiKey) headers['X-API-Key'] = settings.apiKey;

    const data = await fetchDefinitionWithRetry(hashKey, headers);

    if (data?.Response) {
      const display = data.Response.displayProperties || {};
      const inv = data.Response.inventory || {};
      const damageTypeEnum = data.Response.defaultDamageType;
      
      const damageTypeMap = { 0: 'None', 1: 'Kinetic', 2: 'Arc', 3: 'Solar', 4: 'Void', 6: 'Stasis', 7: 'Strand' };
      const tierMap = { 0: 'Unknown', 2: 'Basic', 3: 'Common', 4: 'Rare', 5: 'Legendary', 6: 'Exotic' };
      const classTypeMap = { 0: 'Titan', 1: 'Hunter', 2: 'Warlock', 3: 'Any' };

      const def = {
        hash: hashKey,
        name: display.name || `Item #${hashKey}`,
        description: display.description || '',
        icon: display.icon ? `https://www.bungie.net${display.icon}` : null,
        iconWatermark: data.Response.iconWatermark ? `https://www.bungie.net${data.Response.iconWatermark}` : null,
        screenshot: data.Response.screenshot ? `https://www.bungie.net${data.Response.screenshot}` : null,
        itemTypeDisplayName: data.Response.itemTypeDisplayName || '',
        // The slot this item equips into. A vault item reports the vault as its
        // own bucket, so this is the only exact answer for anything stored.
        bucketTypeHash: inv.bucketTypeHash ?? null,
        // Which Guardian can wear it -- the optimizer would otherwise build
        // sets out of another class's armour and fail to equip them.
        classType: classTypeMap[data.Response.classType] ?? null,
        tierTypeName: data.Response.inventory?.tierTypeName || tierMap[inv.tierType] || 'Legendary',
        damageType: damageTypeMap[damageTypeEnum] || 'Kinetic',
        isWeapon: data.Response.itemType === 3,
        isArmor: data.Response.itemType === 2,
        // Armour set membership, for set-bonus targeting. Not the item's own
        // `setData` -- that one is for quest step lists.
        setHash: data.Response.equippingBlock?.equipableItemSetHash ?? null,
        // Bungie's own item type, which is the only thing that names a
        // subclass (16) or an artifact (28) outright.
        itemType: data.Response.itemType ?? null,
        isSubclass: data.Response.itemType === SUBCLASS_ITEM_TYPE,
        // Plug identity. Supers, abilities, aspects and fragments are all
        // plugs, and this is what tells them apart -- their category
        // identifier reads like 'hunter.arc.aspects' or 'shared.fragments'.
        plugCategoryIdentifier: data.Response.plug?.plugCategoryIdentifier || null,
        plugCategoryHash: data.Response.plug?.plugCategoryHash ?? null,
        // Where a subclass's own sockets get their options from, for the
        // plugs the live profile did not list.
        socketEntries: (data.Response.sockets?.socketEntries || []).map(entry => ({
          socketTypeHash: entry.socketTypeHash ?? null,
          singleInitialItemHash: entry.singleInitialItemHash ?? null,
          reusablePlugSetHash: entry.reusablePlugSetHash ?? null,
          randomizedPlugSetHash: entry.randomizedPlugSetHash ?? null,
          reusablePlugItems: (entry.reusablePlugItems || [])
            .map(p => p.plugItemHash)
            .filter(h => h !== null && h !== undefined)
        }))
      };

      memoryCache.set(hashKey, def);
      try {
        sessionStorage.setItem(`d2_def3_${hashKey}`, JSON.stringify(def));
      } catch (e) {}

      return def;
    }
  } catch (err) {
    console.error(`Failed to fetch item definition for ${hashKey}:`, err);
  }

  return {
    hash: hashKey,
    name: `Item #${hashKey}`,
    icon: null,
    tierTypeName: 'Legendary',
    damageType: 'Kinetic'
  };
}

/**
 * Resolve many definitions at once.
 *
 * Bungie has no bulk definition endpoint, so this is one request per hash and a
 * full vault is a great many hashes. Cached hashes are answered without a
 * request at all, and the rest go out in small waves rather than one burst --
 * a burst is what gets a profile rate-limited, and a rate-limited profile is
 * one full of blank tiles.
 */
export async function batchResolveItemDefinitions(hashes) {
  const uniqueHashes = [...new Set(hashes.filter(Boolean))];
  const results = {};

  const chunkSize = 8;
  for (let i = 0; i < uniqueHashes.length; i += chunkSize) {
    const chunk = uniqueHashes.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (h) => {
        results[h] = await getItemDefinition(h);
      })
    );
  }

  return results;
}
