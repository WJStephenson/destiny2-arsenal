import { getStoredSettings } from './auth-storage';

const memoryCache = new Map();

// Helper to get definition from Bungie Manifest API
export async function getItemDefinition(itemHash) {
  if (!itemHash) return null;
  const hashKey = String(itemHash);

  if (memoryCache.has(hashKey)) {
    return memoryCache.get(hashKey);
  }

  // Try sessionStorage
  try {
    const cached = sessionStorage.getItem(`d2_def2_${hashKey}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      memoryCache.set(hashKey, parsed);
      return parsed;
    }
  } catch (e) {}

  // Fetch from Bungie API
  try {
    const settings = getStoredSettings();
    const headers = {};
    if (settings.apiKey) headers['X-API-Key'] = settings.apiKey;

    const res = await fetch(`https://www.bungie.net/Platform/Destiny2/Manifest/DestinyInventoryItemDefinition/${hashKey}/`, { headers });
    const data = await res.json();
    
    if (data.Response) {
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
        setHash: data.Response.equippingBlock?.equipableItemSetHash ?? null
      };

      memoryCache.set(hashKey, def);
      try {
        sessionStorage.setItem(`d2_def2_${hashKey}`, JSON.stringify(def));
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

// Batch resolve item definitions for a list of hashes
export async function batchResolveItemDefinitions(hashes) {
  const uniqueHashes = [...new Set(hashes.filter(Boolean))];
  const results = {};
  
  // Resolve in concurrent chunks of 15
  const chunkSize = 15;
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
