let cachedWeapons = null;
let cachedArmor = null;
let cachedPerks = null;
let cachedFilters = null;

let weaponsByHash = new Map();
let weaponsByName = new Map();
let armorByHash = new Map();
let armorByName = new Map();
let perksByHash = new Map();
let perksByName = new Map();

let loadPromise = null;

export async function initClientManifest(onProgress) {
  if (cachedWeapons && cachedArmor && cachedPerks) {
    return {
      weaponsCount: cachedWeapons.length,
      armorCount: cachedArmor.length,
      perksCount: cachedPerks.length
    };
  }

  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      if (onProgress) onProgress('Loading Destiny 2 Armory...');

      // Fetch all files in parallel (chunked under 10MB each for fast HTTP/2 parallel download)
      const [fRes, aRes, pRes, w1Res, w2Res, w3Res] = await Promise.all([
        fetch('/data/filters.json'),
        fetch('/data/armor.json'),
        fetch('/data/perks.json'),
        fetch('/data/weapons-1.json'),
        fetch('/data/weapons-2.json'),
        fetch('/data/weapons-3.json')
      ]);

      if (fRes.ok) cachedFilters = await fRes.json();

      if (w1Res.ok && w2Res.ok && w3Res.ok) {
        const [w1, w2, w3] = await Promise.all([
          w1Res.json(),
          w2Res.json(),
          w3Res.json()
        ]);
        cachedWeapons = [...w1, ...w2, ...w3];
        cachedWeapons.forEach(w => {
          const h = w.hash || w.id;
          if (h) {
            w.hash = h;
            weaponsByHash.set(Number(h), w);
          }
          if (w.name) {
            weaponsByName.set(w.name.toLowerCase().trim(), w);
          }
        });
      }

      if (aRes.ok) {
        const rawArmor = await aRes.json();
        cachedArmor = Array.isArray(rawArmor) ? rawArmor : Object.values(rawArmor);
        cachedArmor.forEach(a => {
          const h = a.hash || a.id;
          if (h) {
            a.hash = h;
            armorByHash.set(Number(h), a);
          }
          if (a.name) {
            armorByName.set(a.name.toLowerCase().trim(), a);
          }
        });
      }

      if (pRes.ok) {
        const rawPerks = await pRes.json();
        cachedPerks = Array.isArray(rawPerks) ? rawPerks : Object.values(rawPerks);
        cachedPerks.forEach(p => {
          const h = p.hash || p.id;
          if (h) {
            p.hash = h;
            perksByHash.set(Number(h), p);
          }
          if (p.name) {
            perksByName.set(p.name.toLowerCase().trim(), p);
          }
        });
      }

      return {
        weaponsCount: cachedWeapons?.length || 0,
        armorCount: cachedArmor?.length || 0,
        perksCount: cachedPerks?.length || 0
      };
    } catch (err) {
      console.error('Error initializing client manifest:', err);
      return { weaponsCount: 0, armorCount: 0, perksCount: 0 };
    }
  })();

  return loadPromise;
}

export function getFiltersMetadata() {
  if (cachedFilters) return cachedFilters;
  return {
    weaponTypes: [
      'Hand Cannon', 'Auto Rifle', 'Pulse Rifle', 'Scout Rifle', 'Submachine Gun',
      'Sidearm', 'Bow', 'Shotgun', 'Fusion Rifle', 'Sniper Rifle', 'Linear Fusion Rifle',
      'Grenade Launcher', 'Rocket Launcher', 'Machine Gun', 'Sword', 'Glaive', 'Trace Rifle'
    ],
    damageTypes: ['Solar', 'Arc', 'Void', 'Stasis', 'Strand', 'Kinetic'],
    slots: ['Kinetic', 'Energy', 'Power'],
    ammoTypes: ['Primary', 'Special', 'Heavy'],
    tiers: ['Exotic', 'Legendary', 'Rare', 'Common'],
    sourceCategories: [
      'Raid', 'Dungeon', 'Nightfall / Vanguard', 'Trials of Osiris',
      'Iron Banner', 'Crucible', 'Into the Light / Onslaught',
      'Exotic Quest / Archive', 'Seasonal / Episode', 'World Drop'
    ]
  };
}

export async function searchWeaponsClient(filters = {}) {
  await initClientManifest();
  if (!cachedWeapons) return { total: 0, items: [], totalPages: 1 };

  let results = [...cachedWeapons];

  // 1. Text search
  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    results = results.filter(w => 
      w.name.toLowerCase().includes(q) ||
      (w.weaponType && w.weaponType.toLowerCase().includes(q)) ||
      (w.sourceString && w.sourceString.toLowerCase().includes(q)) ||
      (w.intrinsic?.name && w.intrinsic.name.toLowerCase().includes(q))
    );
  }

  // 2. Weapon Types
  if (filters.weaponType && filters.weaponType.length > 0) {
    const types = Array.isArray(filters.weaponType) ? filters.weaponType : filters.weaponType.split(',');
    results = results.filter(w => types.includes(w.weaponType) || types.includes(w.itemTypeDisplayName));
  }

  // 3. Damage Types
  if (filters.damageType && filters.damageType.length > 0) {
    const dmgs = Array.isArray(filters.damageType) ? filters.damageType : filters.damageType.split(',');
    results = results.filter(w => dmgs.includes(w.damageType));
  }

  // 4. Slots
  if (filters.slot && filters.slot.length > 0) {
    const slots = Array.isArray(filters.slot) ? filters.slot : filters.slot.split(',');
    results = results.filter(w => slots.includes(w.slot));
  }

  // 5. Tiers / Rarities
  if (filters.tier && filters.tier.length > 0) {
    const tiers = Array.isArray(filters.tier) ? filters.tier : filters.tier.split(',');
    results = results.filter(w => tiers.includes(w.tierTypeName));
  }

  // 6. Ammo Types
  if (filters.ammoType && filters.ammoType.length > 0) {
    const ammos = Array.isArray(filters.ammoType) ? filters.ammoType : filters.ammoType.split(',');
    results = results.filter(w => ammos.includes(w.ammoType));
  }

  // 7. Sources. A selection is either a broad category ("Raid") or a specific
  // source string ("Last Wish"), since both are offered by the search bar.
  if (filters.sourceCategory && filters.sourceCategory.length > 0) {
    const srcs = Array.isArray(filters.sourceCategory) ? filters.sourceCategory : filters.sourceCategory.split(',');
    results = results.filter(w => srcs.some(src => w.sourceCategory === src || w.sourceString === src));
  }

  // 7b. Archetypes / frames, matched on the weapon's intrinsic.
  if (filters.archetype && filters.archetype.length > 0) {
    const archs = Array.isArray(filters.archetype) ? filters.archetype : filters.archetype.split(',');
    results = results.filter(w => archs.includes(w.intrinsic?.name));
  }

  // 8. Craftable
  if (filters.craftable === true || filters.craftable === 'true') {
    results = results.filter(w => w.isCraftable);
  }

  // 9. Perks Match
  if (filters.perks && filters.perks.length > 0) {
    const reqPerks = Array.isArray(filters.perks) ? filters.perks : filters.perks.split(',');
    const matchMode = filters.perkMatchMode || 'and';

    results = results.filter(w => {
      const weaponPerksLower = (w.allPerkNames || []).map(p => p.toLowerCase());
      if (matchMode === 'and') {
        return reqPerks.every(rp => weaponPerksLower.includes(rp.toLowerCase()));
      } else {
        return reqPerks.some(rp => weaponPerksLower.includes(rp.toLowerCase()));
      }
    });
  }

  // Sorting
  const sortBy = filters.sortBy || 'name';
  const sortDir = filters.sortDir || 'asc';
  results.sort((a, b) => {
    let valA = a[sortBy] ?? '';
    let valB = b[sortBy] ?? '';
    if (typeof valA === 'string') {
      return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortDir === 'asc' ? valA - valB : valB - valA;
  });

  const total = results.length;
  const page = parseInt(filters.page || 1, 10);
  const limit = parseInt(filters.limit || 48, 10);
  const totalPages = Math.ceil(total / limit) || 1;
  const paginated = results.slice((page - 1) * limit, page * limit);

  return { total, page, totalPages, limit, items: paginated };
}

export async function searchArmorClient(filters = {}) {
  await initClientManifest();
  if (!cachedArmor) return { total: 0, items: [], totalPages: 1 };

  let results = [...cachedArmor];

  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    results = results.filter(a => 
      a.name.toLowerCase().includes(q) || 
      (a.setName && a.setName.toLowerCase().includes(q)) ||
      (a.sourceCategory && a.sourceCategory.toLowerCase().includes(q)) ||
      (a.setIntrinsicPerk && a.setIntrinsicPerk.toLowerCase().includes(q)) ||
      (a.sourceString && a.sourceString.toLowerCase().includes(q)) ||
      (a.exoticPerk?.name && a.exoticPerk.name.toLowerCase().includes(q))
    );
  }

  if (filters.classType && filters.classType !== 'All') {
    results = results.filter(a => a.classType === filters.classType);
  }

  if (filters.slot && filters.slot !== 'All') {
    results = results.filter(a => (a.armorSlot === filters.slot) || (a.slot === filters.slot));
  }

  if (filters.tier && filters.tier !== 'All') {
    results = results.filter(a => a.tierTypeName === filters.tier);
  }

  // Armour is tagged with sourceCategory by the manifest indexer. An earlier
  // build filtered on a `setCategory` field that is never populated, so every
  // category returned nothing.
  if (filters.sourceCategory && filters.sourceCategory !== 'All') {
    results = results.filter(a => a.sourceCategory === filters.sourceCategory);
  }

  if (filters.setName && filters.setName !== 'All') {
    results = results.filter(a => a.setName === filters.setName);
  }

  if (filters.artificeOnly === true || filters.artificeOnly === 'true') {
    results = results.filter(a => a.isArtifice);
  }

  const total = results.length;
  const page = parseInt(filters.page || 1, 10);
  const limit = parseInt(filters.limit || 36, 10);
  const totalPages = Math.ceil(total / limit) || 1;
  const paginated = results.slice((page - 1) * limit, page * limit);

  return { total, page, totalPages, limit, items: paginated };
}

export function getSuggestionsClient(query) {
  if (!query || !query.trim() || !cachedWeapons) {
    return { weapons: [], archetypes: [], sources: [], weaponTypes: [] };
  }

  const q = query.trim().toLowerCase();

  const matchingWeapons = cachedWeapons
    .filter(w => w.name.toLowerCase().includes(q))
    .slice(0, 5);

  const archetypesSet = new Set();
  const sourcesSet = new Set();
  const weaponTypesSet = new Set();
  const categoriesSet = new Set();

  cachedWeapons.forEach(w => {
    if (w.intrinsic?.name && w.intrinsic.name.toLowerCase().includes(q)) {
      archetypesSet.add(w.intrinsic.name);
    }
    // Broad categories rank ahead of specific source strings below, so both
    // "Raid" and "Last Wish" are reachable from the one search bar.
    if (w.sourceCategory && w.sourceCategory.toLowerCase().includes(q)) {
      categoriesSet.add(w.sourceCategory);
    }
    if (w.sourceString && w.sourceString.toLowerCase().includes(q)) {
      sourcesSet.add(w.sourceString);
    }
    if (w.weaponType && w.weaponType.toLowerCase().includes(q)) {
      weaponTypesSet.add(w.weaponType);
    }
  });

  const sources = [
    ...Array.from(categoriesSet),
    ...Array.from(sourcesSet).filter(src => !categoriesSet.has(src))
  ].slice(0, 8);

  return {
    weapons: matchingWeapons,
    archetypes: Array.from(archetypesSet).slice(0, 8),
    sources,
    weaponTypes: Array.from(weaponTypesSet).slice(0, 6)
  };
}

export function searchPerksClient(query = '', type = 'all') {
  if (!cachedPerks) return [];
  const q = query.toLowerCase().trim();

  return cachedPerks.filter(p => {
    if (type !== 'all' && p.category !== type) return false;
    if (q) return p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q));
    return true;
  });
}

export function getPerkByName(name) {
  if (!name) return null;
  return perksByName.get(name.trim().toLowerCase()) || null;
}

export function getPerkByHash(hash) {
  if (!hash) return null;
  return perksByHash.get(Number(hash)) || null;
}

export function getClientItemByHash(hash) {
  if (!hash) return null;
  const numHash = Number(hash);
  if (weaponsByHash.has(numHash)) return weaponsByHash.get(numHash);
  if (armorByHash.has(numHash)) return armorByHash.get(numHash);
  if (perksByHash.has(numHash)) return perksByHash.get(numHash);
  return null;
}

export function getClientItemByName(name) {
  if (!name) return null;
  const clean = name.toLowerCase().trim();
  if (weaponsByName.has(clean)) return weaponsByName.get(clean);
  if (armorByName.has(clean)) return armorByName.get(clean);
  if (perksByName.has(clean)) return perksByName.get(clean);
  return null;
}

/**
 * Distinct armour source categories present in the manifest, so the UI offers
 * exactly the filters that can return something.
 */
export async function getArmorSourceCategories() {
  await initClientManifest();
  if (!cachedArmor) return [];
  return Array.from(new Set(cachedArmor.map(a => a.sourceCategory).filter(Boolean))).sort();
}
