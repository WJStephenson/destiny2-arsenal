const fs = require('fs');
const path = require('path');
const https = require('https');
const AdmZip = require('adm-zip');
const Database = require('better-sqlite3');
const { downloadFile } = require('./download-helper');

const DATA_DIR = path.join(__dirname, '..', 'data');
const MANIFEST_META_FILE = path.join(DATA_DIR, 'manifest-meta.json');
const WEAPONS_FILE = path.join(DATA_DIR, 'weapons.json');
const ARMOR_FILE = path.join(DATA_DIR, 'armor.json');
const PERKS_FILE = path.join(DATA_DIR, 'perks.json');
const FILTERS_FILE = path.join(DATA_DIR, 'filters.json');
const SQLITE_CACHE_FILE = path.join(DATA_DIR, 'manifest.content');

/**
 * Equipment bucket hashes from DestinyInventoryBucketDefinition, and the armour
 * ItemSubType values from the API enum. Both are used to slot armour, so a
 * single wrong number cannot quietly drop a whole slot out of the dataset.
 */
const BUCKET_HASHES = {
  kinetic: 1498876634,
  energy: 2465295065,
  power: 953998645,
  helmet: 3448274439,
  gauntlets: 3551918588,
  chest: 14239492,
  legs: 20886954,
  classItem: 1585787867
};

const ITEM_SUB_TYPES = {
  helmet: 26,
  gauntlets: 27,
  chest: 28,
  legs: 29,
  classItem: 30
};

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let syncProgress = {
  status: 'idle',
  percent: 0,
  message: 'Manifest not loaded',
  totalItems: 0,
  weaponsCount: 0,
  armorCount: 0,
  perksCount: 0,
  version: null,
  lastUpdated: null,
  error: null
};

let memoryDB = {
  weapons: [],
  armor: [],
  perks: {},
  perkList: [],
  filters: {
    weaponTypes: [],
    damageTypes: [],
    slots: [],
    ammoTypes: [],
    tiers: [],
    sourceCategories: [
      'Raid', 'Dungeon', 'Nightfall / Vanguard', 'Trials of Osiris',
      'Iron Banner', 'Crucible', 'Into the Light / Onslaught',
      'Exotic Quest / Archive', 'Seasonal / Episode', 'World Drop'
    ],
    perkColumns: {
      barrels: [],
      magazines: [],
      column3: [],
      column4: [],
      originTraits: [],
      intrinsics: []
    },
    popularPerks: [
      'Incandescent', 'Voltshot', 'Kinetic Tremors', 'Bait and Switch',
      'Destabilizing Rounds', 'Precision Instrument', 'Reconstruction', 'Rewind Rounds',
      'Heal Clip', 'Firefly', 'Explosive Payload', 'Demolitionist',
      'Frenzy', 'Target Lock', 'Hatchling', 'Headstone',
      'Cascade Point', 'Envious Assassin', 'Auto-Loading Holster', 'Subsistence',
      'Outlaw', 'Rapid Hit', 'Desperado', 'Kill Clip'
    ],
    classes: ['Hunter', 'Titan', 'Warlock'],
    armorSlots: ['Helmet', 'Gauntlets', 'Chest Armor', 'Leg Armor', 'Class Item']
  },
  weaponsMap: new Map(),
  armorMap: new Map(),
  perkWeaponsMap: new Map()
};

function getSyncStatus() {
  return syncProgress;
}

function loadCachedData() {
  try {
    if (fs.existsSync(MANIFEST_META_FILE) && fs.existsSync(WEAPONS_FILE) && fs.existsSync(ARMOR_FILE) && fs.existsSync(PERKS_FILE) && fs.existsSync(FILTERS_FILE)) {
      console.log('Loading cached Destiny 2 data from disk...');
      const meta = JSON.parse(fs.readFileSync(MANIFEST_META_FILE, 'utf-8'));
      memoryDB.weapons = JSON.parse(fs.readFileSync(WEAPONS_FILE, 'utf-8'));
      memoryDB.armor = JSON.parse(fs.readFileSync(ARMOR_FILE, 'utf-8'));
      memoryDB.perks = JSON.parse(fs.readFileSync(PERKS_FILE, 'utf-8'));
      memoryDB.filters = JSON.parse(fs.readFileSync(FILTERS_FILE, 'utf-8'));

      memoryDB.weaponsMap.clear();
      memoryDB.armorMap.clear();
      memoryDB.perkWeaponsMap.clear();

      memoryDB.weapons.forEach(w => memoryDB.weaponsMap.set(String(w.id), w));
      memoryDB.armor.forEach(a => memoryDB.armorMap.set(String(a.id), a));
      memoryDB.perkList = Object.values(memoryDB.perks);

      memoryDB.weapons.forEach(w => {
        if (w.allPerkHashes) {
          w.allPerkHashes.forEach(ph => {
            const strPh = String(ph);
            if (!memoryDB.perkWeaponsMap.has(strPh)) {
              memoryDB.perkWeaponsMap.set(strPh, []);
            }
            memoryDB.perkWeaponsMap.get(strPh).push({
              id: w.id,
              name: w.name,
              icon: w.icon,
              tierTypeName: w.tierTypeName,
              weaponType: w.weaponType,
              damageType: w.damageType,
              damageColor: w.damageColor,
              slot: w.slot,
              isCraftable: w.isCraftable,
              sourceString: w.sourceString,
              sourceCategory: w.sourceCategory
            });
          });
        }
      });

      syncProgress = {
        status: 'ready',
        percent: 100,
        message: 'Manifest loaded and ready',
        totalItems: memoryDB.weapons.length + memoryDB.armor.length,
        weaponsCount: memoryDB.weapons.length,
        armorCount: memoryDB.armor.length,
        perksCount: Object.keys(memoryDB.perks).length,
        version: meta.version,
        lastUpdated: meta.lastUpdated,
        error: null
      };

      console.log(`Loaded ${memoryDB.weapons.length} weapons, ${memoryDB.armor.length} armor pieces, ${Object.keys(memoryDB.perks).length} perks.`);
      return true;
    }
  } catch (err) {
    console.error('Error loading cached data:', err);
  }
  return false;
}

function fetchBungieManifestInfo(apiKey = '') {
  return new Promise((resolve, reject) => {
    const url = 'https://www.bungie.net/Platform/Destiny2/Manifest/';
    const headers = {
      'User-Agent': 'Destiny2ArsenalPerkFinder/1.0'
    };
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.Response) {
            resolve(json.Response);
          } else {
            reject(new Error(json.Message || 'Failed to get manifest info'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function syncManifest(apiKey = '', force = false) {
  try {
    syncProgress.status = 'downloading';
    syncProgress.percent = 5;
    syncProgress.message = 'Fetching Bungie Manifest metadata...';
    syncProgress.error = null;

    const manifestInfo = await fetchBungieManifestInfo(apiKey);
    const remoteVersion = manifestInfo.version;
    const sqlitePath = manifestInfo.mobileWorldContentPaths?.en;

    if (!sqlitePath) {
      throw new Error('English SQLite database path not found in manifest response');
    }

    if (!force && fs.existsSync(MANIFEST_META_FILE) && fs.existsSync(WEAPONS_FILE)) {
      try {
        const meta = JSON.parse(fs.readFileSync(MANIFEST_META_FILE, 'utf-8'));
        if (meta.version === remoteVersion && memoryDB.weapons.length > 0 && memoryDB.weapons[0]?.sourceString) {
          syncProgress.status = 'ready';
          syncProgress.percent = 100;
          syncProgress.message = `Manifest is up to date (v${remoteVersion})`;
          return { success: true, updated: false, version: remoteVersion };
        }
      } catch (e) {}
    }

    if (!fs.existsSync(SQLITE_CACHE_FILE) || force) {
      const downloadUrl = 'https://www.bungie.net' + sqlitePath;
      const tempZipFile = path.join(DATA_DIR, 'manifest_temp.zip');

      syncProgress.percent = 10;
      syncProgress.message = 'Downloading Destiny 2 SQLite Manifest (~37MB)...';

      await downloadFile(downloadUrl, tempZipFile, (pct) => {
        syncProgress.percent = 10 + Math.round(pct * 0.45);
        syncProgress.message = `Downloading Destiny 2 database (${pct}%)...`;
      });

      syncProgress.status = 'extracting';
      syncProgress.percent = 58;
      syncProgress.message = 'Extracting SQLite database...';

      const zip = new AdmZip(tempZipFile);
      const zipEntries = zip.getEntries();
      if (zipEntries.length === 0) {
        throw new Error('Empty zip file received from Bungie');
      }

      zip.extractEntryTo(zipEntries[0], DATA_DIR, false, true);
      const extractedFileName = zipEntries[0].entryName;
      const extractedFilePath = path.join(DATA_DIR, extractedFileName);

      if (fs.existsSync(SQLITE_CACHE_FILE)) {
        try { fs.unlinkSync(SQLITE_CACHE_FILE); } catch (e) {}
      }
      fs.renameSync(extractedFilePath, SQLITE_CACHE_FILE);
      try { fs.unlinkSync(tempZipFile); } catch (e) {}
    }

    syncProgress.status = 'indexing';
    syncProgress.percent = 65;
    syncProgress.message = 'Parsing items, perks, sockets, stats & building database indexes...';

    await parseAndIndexDatabase(SQLITE_CACHE_FILE, remoteVersion);

    syncProgress.status = 'ready';
    syncProgress.percent = 100;
    syncProgress.message = `Manifest ready (v${remoteVersion}) - ${memoryDB.weapons.length} weapons, ${memoryDB.armor.length} armor pieces`;
    syncProgress.version = remoteVersion;
    syncProgress.lastUpdated = new Date().toISOString();

    return { success: true, updated: true, version: remoteVersion };
  } catch (err) {
    console.error('Error syncing manifest:', err);
    syncProgress.status = 'error';
    syncProgress.error = err.message;
    syncProgress.message = `Sync failed: ${err.message}`;
    throw err;
  }
}

function categorizeSource(src = '') {
  const s = (src || '').toLowerCase();
  if (s.includes('raid') || s.includes('last wish') || s.includes('deep stone') || s.includes('vault of glass') || s.includes('vow of the disciple') || s.includes('king\'s fall') || s.includes('root of nightmares') || s.includes('crota') || s.includes('salvation\'s edge')) {
    return 'Raid';
  }
  if (s.includes('dungeon') || s.includes('shattered throne') || s.includes('pit of heresy') || s.includes('prophecy') || s.includes('grasp of avarice') || s.includes('duality') || s.includes('spire of the watcher') || s.includes('ghosts of the deep') || s.includes('warlord') || s.includes('vesper')) {
    return 'Dungeon';
  }
  if (s.includes('trials of osiris') || s.includes('flawless')) {
    return 'Trials of Osiris';
  }
  if (s.includes('iron banner')) {
    return 'Iron Banner';
  }
  if (s.includes('crucible') || s.includes('competitive') || s.includes('glory') || s.includes('shaxx') || s.includes('valor')) {
    return 'Crucible';
  }
  if (s.includes('nightfall') || s.includes('grandmaster') || s.includes('vanguard') || s.includes('strike') || s.includes('zavala')) {
    return 'Nightfall / Vanguard';
  }
  if (s.includes('gambit') || s.includes('drifter')) {
    return 'Gambit';
  }
  if (s.includes('quest') || s.includes('monument') || s.includes('archive') || s.includes('exotic engram') || s.includes('exotic mission') || s.includes('dual destiny')) {
    return 'Exotic Quest / Archive';
  }
  if (s.includes('onslaught') || s.includes('into the light') || s.includes('brave') || s.includes('hall of champions')) {
    return 'Into the Light / Onslaught';
  }
  if (s.includes('season') || s.includes('pass') || s.includes('episode') || s.includes('echoes') || s.includes('revenant') || s.includes('heresy')) {
    return 'Seasonal / Episode';
  }
  if (s.includes('world drop') || s.includes('engram') || s.includes('patrol') || s.includes('vendor') || s.includes('banshee') || s.includes('gunsmith')) {
    return 'World Drop';
  }
  return 'General / Activity';
}

async function parseAndIndexDatabase(sqliteFilePath, version) {
  const db = new Database(sqliteFilePath, { readonly: true });

  console.log('Reading Stat Definitions...');
  const statRows = db.prepare('SELECT id, json FROM DestinyStatDefinition').all();
  const statDefs = {};
  for (const row of statRows) {
    const data = JSON.parse(row.json);
    statDefs[data.hash] = {
      hash: data.hash,
      name: data.displayProperties?.name || '',
      description: data.displayProperties?.description || '',
      icon: data.displayProperties?.icon ? 'https://www.bungie.net' + data.displayProperties.icon : null,
      aggregationType: data.aggregationType,
      statCategory: data.statCategory
    };
  }

  console.log('Reading Damage Type Definitions...');
  const damageRows = db.prepare('SELECT id, json FROM DestinyDamageTypeDefinition').all();
  const damageDefs = {};
  for (const row of damageRows) {
    const data = JSON.parse(row.json);
    damageDefs[data.hash] = {
      hash: data.hash,
      name: data.displayProperties?.name || 'Kinetic',
      icon: data.displayProperties?.icon ? 'https://www.bungie.net' + data.displayProperties.icon : null,
      color: getDamageColor(data.displayProperties?.name)
    };
  }

  console.log('Reading PlugSet Definitions...');
  const plugSetRows = db.prepare('SELECT id, json FROM DestinyPlugSetDefinition').all();
  const plugSetDefs = {};
  for (const row of plugSetRows) {
    const data = JSON.parse(row.json);
    plugSetDefs[data.hash] = data;
  }

  console.log('Reading Sandbox Perk Definitions...');
  const sandboxRows = db.prepare('SELECT id, json FROM DestinySandboxPerkDefinition').all();
  const sandboxDefs = {};
  for (const row of sandboxRows) {
    const data = JSON.parse(row.json);
    sandboxDefs[data.hash] = {
      hash: data.hash,
      name: data.displayProperties?.name || '',
      description: data.displayProperties?.description || '',
      icon: data.displayProperties?.icon ? 'https://www.bungie.net' + data.displayProperties.icon : null
    };
  }

  // Armour set bonuses (the 2-piece / 4-piece perks). The table that carries
  // them is found by name rather than hard-coded, and every field is probed
  // rather than assumed, so a manifest that names things differently -- or
  // predates set bonuses entirely -- yields no sets instead of throwing.
  console.log('Reading Armour Set Definitions...');
  const armorSetDefs = {};
  try {
    const tableNames = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
    const setTable = tableNames.find(n => /EquipableItemSet/i.test(n))
      || tableNames.find(n => /ItemSetDefinition$/i.test(n));

    if (setTable) {
      for (const row of db.prepare(`SELECT json FROM ${setTable}`).all()) {
        const data = JSON.parse(row.json);
        const perks = data.setPerks || data.perks || data.setBonuses || [];
        armorSetDefs[data.hash] = {
          hash: data.hash,
          name: data.displayProperties?.name || data.setName || '',
          bonuses: (Array.isArray(perks) ? perks : []).map(perk => {
            const count = perk.requiredSetCount ?? perk.setCount ?? perk.requiredCount ?? null;
            const sandbox = sandboxDefs[perk.sandboxPerkHash ?? perk.perkHash];
            return {
              count,
              name: sandbox?.name || perk.displayProperties?.name || '',
              description: sandbox?.description || perk.displayProperties?.description || ''
            };
          }).filter(b => b.count != null).sort((a, b) => a.count - b.count)
        };
      }
      console.log(`  Found ${Object.keys(armorSetDefs).length} armour sets in ${setTable}`);
    } else {
      console.log('  No armour set table in this manifest; set bonuses unavailable.');
    }
  } catch (err) {
    console.log('  Could not read armour set definitions:', err.message);
  }

  console.log('Reading Socket Type & Category Definitions...');
  const socketCategoryRows = db.prepare('SELECT id, json FROM DestinySocketCategoryDefinition').all();
  const socketCategoryDefs = {};
  for (const row of socketCategoryRows) {
    const data = JSON.parse(row.json);
    socketCategoryDefs[data.hash] = data.displayProperties?.name || '';
  }

  console.log('Reading Collectibles & Acquisition Sources...');
  const collectibleRows = db.prepare('SELECT id, json FROM DestinyCollectibleDefinition').all();
  const itemHashToSource = new Map();
  const nameToSource = new Map();

  for (const row of collectibleRows) {
    const col = JSON.parse(row.json);
    const src = col.sourceString?.trim();
    const name = col.displayProperties?.name?.trim();
    const itemHash = col.itemHash;

    if (src && !src.startsWith('Random Perks') && !src.startsWith('An unlockable') && src !== 'Source: Unknown') {
      if (itemHash) itemHashToSource.set(itemHash, src);
      if (name && !nameToSource.has(name)) nameToSource.set(name, src);
    }
  }

  console.log(`Indexed sources for ${itemHashToSource.size} item hashes and ${nameToSource.size} names.`);

  console.log('Reading all Inventory Items...');
  const itemRows = db.prepare('SELECT id, json FROM DestinyInventoryItemDefinition').all();
  
  const rawItemMap = new Map();
  for (const row of itemRows) {
    const data = JSON.parse(row.json);
    rawItemMap.set(data.hash, data);
  }

  const getItemByHash = (h) => rawItemMap.get(h);

  console.log(`Loaded ${rawItemMap.size} raw item definitions.`);

  const perksCatalog = {};

  function enrichPerk(hash, perkCategory = 'Trait') {
    if (!hash) return null;
    if (perksCatalog[hash]) return perksCatalog[hash];

    const raw = getItemByHash(hash);
    if (!raw) return null;

    const name = raw.displayProperties?.name?.trim();
    if (!name || name.length === 0) return null;

    const icon = raw.displayProperties?.icon ? 'https://www.bungie.net' + raw.displayProperties.icon : null;
    const description = raw.displayProperties?.description || '';
    const itemTypeDisplayName = raw.itemTypeDisplayName || '';
    const isEnhanced = name.startsWith('Enhanced ') || itemTypeDisplayName.includes('Enhanced');
    const isOriginTrait = perkCategory === 'Origin Trait' || itemTypeDisplayName.includes('Origin');
    const isIntrinsic = perkCategory === 'Intrinsic' || itemTypeDisplayName.includes('Intrinsic') || itemTypeDisplayName.includes('Frame');

    const investmentStats = [];
    if (raw.investmentStats) {
      for (const inv of raw.investmentStats) {
        const sDef = statDefs[inv.statTypeHash];
        if (sDef && sDef.name && inv.value !== 0) {
          investmentStats.push({
            name: sDef.name,
            value: inv.value
          });
        }
      }
    }

    const perkObj = {
      hash,
      name,
      description,
      icon,
      itemTypeDisplayName,
      category: perkCategory,
      isEnhanced,
      isOriginTrait,
      isIntrinsic,
      stats: investmentStats
    };

    perksCatalog[hash] = perkObj;
    return perkObj;
  }

  const weaponsList = [];
  const armorList = [];

  const weaponTypesSet = new Set();
  const damageTypesSet = new Set();
  const slotsSet = new Set();
  const ammoTypesSet = new Set();
  const tiersSet = new Set();
  const sourceCategoriesSet = new Set();

  const perkColSets = {
    barrels: new Set(),
    magazines: new Set(),
    column3: new Set(),
    column4: new Set(),
    originTraits: new Set(),
    intrinsics: new Set()
  };

  for (const [hash, item] of rawItemMap) {
    const itemType = item.itemType;
    const tierTypeName = item.inventory?.tierTypeName;
    const name = item.displayProperties?.name?.trim();

    if (!name || !tierTypeName) continue;

    // Resolve Acquisition Source
    let rawSource = itemHashToSource.get(item.hash);
    if (!rawSource && item.collectibleHash) {
      rawSource = itemHashToSource.get(item.collectibleHash);
    }
    if (!rawSource) {
      rawSource = nameToSource.get(name);
    }
    if (!rawSource) {
      if (tierTypeName === 'Exotic') {
        rawSource = 'Source: Exotic Archive / Exotic Engrams / Quests';
      } else {
        rawSource = 'Source: Activity & Destination drop';
      }
    }

    const cleanSourceString = rawSource.replace(/^Source:\s*/i, '').trim();
    const sourceCategory = categorizeSource(cleanSourceString);
    sourceCategoriesSet.add(sourceCategory);

    // --- WEAPONS (itemType === 3) ---
    if (itemType === 3) {
      if (!item.stats?.stats || Object.keys(item.stats.stats).length === 0) continue;

      const weaponType = getWeaponTypeName(item);
      if (!weaponType) continue;

      const slot = getSlotName(item.inventory?.bucketTypeHash);
      const damageTypeHash = item.defaultDamageTypeHash || (item.damageTypeHashes && item.damageTypeHashes[0]);
      const damageInfo = damageDefs[damageTypeHash] || { name: 'Kinetic', icon: null, color: '#e2e8f0' };
      const ammoType = getAmmoTypeName(item.equippingBlock?.ammoType);

      weaponTypesSet.add(weaponType);
      damageTypesSet.add(damageInfo.name);
      slotsSet.add(slot);
      ammoTypesSet.add(ammoType);
      tiersSet.add(tierTypeName);

      // Parse Weapon Stats
      const stats = {};
      const statsList = [];
      for (const [sHash, sVal] of Object.entries(item.stats.stats)) {
        const sDef = statDefs[sHash];
        if (sDef && sDef.name && !['Attack', 'Power', 'Ammo Generation'].includes(sDef.name)) {
          const statData = {
            hash: Number(sHash),
            name: sDef.name,
            value: sVal.value,
            max: sVal.maximum || 100
          };
          stats[sDef.name] = sVal.value;
          statsList.push(statData);
        }
      }

      // Parse Weapon Sockets & Perk Columns
      const socketEntries = item.sockets?.socketEntries || [];
      const socketCategories = item.sockets?.socketCategories || [];

      const cosmeticIndices = new Set();
      const perkIndices = new Set();
      const intrinsicIndices = new Set();
      const modIndices = new Set();

      for (const sc of socketCategories) {
        const cHash = sc.socketCategoryHash;
        const cName = socketCategoryDefs[cHash] || '';
        if (cName.toLowerCase().includes('cosmetic') || cHash === 2048875504 || cHash === 2068417997) {
          sc.socketIndexes?.forEach(idx => cosmeticIndices.add(idx));
        } else if (cName.toLowerCase().includes('perk') || cHash === 4241085061) {
          sc.socketIndexes?.forEach(idx => perkIndices.add(idx));
        } else if (cName.toLowerCase().includes('intrinsic') || cHash === 3956125808 || cHash === 2048873281) {
          sc.socketIndexes?.forEach(idx => intrinsicIndices.add(idx));
        } else if (cName.toLowerCase().includes('mod') || cHash === 2685412949) {
          sc.socketIndexes?.forEach(idx => modIndices.add(idx));
        }
      }

      const socketColumns = [];
      const allPerkNames = new Set();
      const allPerkHashes = new Set();
      let intrinsic = null;
      const originTraits = [];
      let isCraftable = false;

      const frameIndices = intrinsicIndices.size > 0 ? Array.from(intrinsicIndices) : [0];
      for (const sIdx of frameIndices) {
        const entry = socketEntries[sIdx];
        if (!entry) continue;
        const plugHashes = [entry.singleInitialItemHash, ...(entry.reusablePlugItems?.map(r => r.plugItemHash) || [])].filter(Boolean);
        for (const ph of plugHashes) {
          const p = enrichPerk(ph, 'Intrinsic');
          if (p && !p.name.startsWith('Empty') && !p.name.includes('Tracker')) {
            intrinsic = p;
            allPerkNames.add(p.name);
            allPerkHashes.add(p.hash);
            perkColSets.intrinsics.add(p.name);
            break;
          }
        }
      }

      for (let sIdx = 0; sIdx < socketEntries.length; sIdx++) {
        const entry = socketEntries[sIdx];
        const plugHashes = [
          entry.singleInitialItemHash,
          ...(entry.reusablePlugItems?.map(r => r.plugItemHash) || [])
        ];
        if (entry.reusablePlugSetHash && plugSetDefs[entry.reusablePlugSetHash]) {
          plugSetDefs[entry.reusablePlugSetHash].reusablePlugItems?.forEach(r => plugHashes.push(r.plugItemHash));
        }
        for (const ph of plugHashes) {
          const plugItem = getItemByHash(ph);
          if (plugItem) {
            const pName = plugItem.displayProperties?.name || '';
            if (pName.includes('Deepsight') || pName.includes('Pattern') || pName.includes('Weapon Level')) {
              isCraftable = true;
            }
          }
        }
      }

      let perkColCount = 0;
      for (let sIdx = 0; sIdx < socketEntries.length; sIdx++) {
        if (cosmeticIndices.has(sIdx)) continue;
        if (frameIndices.includes(sIdx)) continue;

        const entry = socketEntries[sIdx];
        const plugHashes = new Set();

        if (entry.singleInitialItemHash) {
          plugHashes.add(entry.singleInitialItemHash);
        }
        if (entry.reusablePlugItems) {
          entry.reusablePlugItems.forEach(r => plugHashes.add(r.plugItemHash));
        }
        if (entry.reusablePlugSetHash && plugSetDefs[entry.reusablePlugSetHash]) {
          plugSetDefs[entry.reusablePlugSetHash].reusablePlugItems?.forEach(r => plugHashes.add(r.plugItemHash));
        }
        if (entry.randomizedPlugSetHash && plugSetDefs[entry.randomizedPlugSetHash]) {
          plugSetDefs[entry.randomizedPlugSetHash].reusablePlugItems?.forEach(r => plugHashes.add(r.plugItemHash));
        }

        if (plugHashes.size === 0) continue;

        const enrichedPlugs = [];
        for (const ph of plugHashes) {
          const plugItem = getItemByHash(ph);
          if (!plugItem) continue;

          const pName = plugItem.displayProperties?.name?.trim();
          if (!pName || pName.length === 0) continue;

          if (
            pName.startsWith('Default ') ||
            pName.startsWith('Empty ') ||
            pName.includes('Tracker') ||
            pName.includes('Memento') ||
            pName.includes('Keepsake') ||
            pName.includes('Shader') ||
            pName.includes('Ornament') ||
            pName.includes('Combat Flair') ||
            pName.includes('Tier ') ||
            pName.includes('Weapon Level') ||
            pName.includes('Deepsight') ||
            pName.includes('Masterwork Tier') ||
            pName.includes('Locked Artifice') ||
            pName.includes('Upgrade Armor')
          ) {
            continue;
          }

          let pCategory = 'Trait';
          const pTypeDisplay = plugItem.itemTypeDisplayName || '';
          if (pTypeDisplay.includes('Barrel') || pTypeDisplay.includes('Sight') || pTypeDisplay.includes('Scope') || pTypeDisplay.includes('Launcher Barrel') || pTypeDisplay.includes('Bowstring')) {
            pCategory = 'Barrel';
          } else if (pTypeDisplay.includes('Magazine') || pTypeDisplay.includes('Battery') || pTypeDisplay.includes('Arrow') || pTypeDisplay.includes('Blade') || pTypeDisplay.includes('Guard') || pTypeDisplay.includes('Haft')) {
            pCategory = 'Magazine';
          } else if (pTypeDisplay.includes('Origin') || pName.includes('Origin') || sIdx === 8 || sIdx === 9) {
            pCategory = 'Origin Trait';
          } else if (pTypeDisplay.includes('Intrinsic') || pTypeDisplay.includes('Frame')) {
            pCategory = 'Intrinsic';
          } else if (pTypeDisplay.includes('Mod') || pName.includes('Mod')) {
            pCategory = 'Mod';
          }

          const enriched = enrichPerk(ph, pCategory);
          if (enriched) {
            enrichedPlugs.push(enriched);
            allPerkNames.add(enriched.name);
            allPerkHashes.add(enriched.hash);

            if (pCategory === 'Barrel') perkColSets.barrels.add(enriched.name);
            if (pCategory === 'Magazine') perkColSets.magazines.add(enriched.name);
            if (pCategory === 'Origin Trait') {
              perkColSets.originTraits.add(enriched.name);
              if (!originTraits.some(ot => ot.name === enriched.name)) {
                originTraits.push(enriched);
              }
            }
          }
        }

        if (enrichedPlugs.length > 0) {
          let colType = 'Trait';
          if (enrichedPlugs.some(p => p.category === 'Barrel')) {
            colType = 'Barrel/Sight';
          } else if (enrichedPlugs.some(p => p.category === 'Magazine')) {
            colType = 'Magazine/Battery';
          } else if (enrichedPlugs.some(p => p.category === 'Origin Trait')) {
            colType = 'Origin Trait';
          } else if (perkColCount === 0) {
            colType = 'Perk Column 3';
            perkColCount++;
            enrichedPlugs.forEach(p => perkColSets.column3.add(p.name));
          } else if (perkColCount === 1) {
            colType = 'Perk Column 4';
            perkColCount++;
            enrichedPlugs.forEach(p => perkColSets.column4.add(p.name));
          }

          socketColumns.push({
            socketIndex: sIdx,
            type: colType,
            perks: enrichedPlugs
          });
        }
      }

      if (!intrinsic && item.itemTypeDisplayName) {
        intrinsic = {
          name: item.itemTypeDisplayName,
          description: item.displayProperties?.description || '',
          icon: null,
          category: 'Intrinsic'
        };
      }

      weaponsList.push({
        id: item.hash,
        name: item.displayProperties.name,
        flavorText: item.flavorText || '',
        icon: item.displayProperties.icon ? 'https://www.bungie.net' + item.displayProperties.icon : null,
        iconWatermark: item.iconWatermark ? 'https://www.bungie.net' + item.iconWatermark : null,
        screenshot: item.screenshot ? 'https://www.bungie.net' + item.screenshot : null,
        itemTypeDisplayName: item.itemTypeDisplayName || weaponType,
        weaponType,
        slot,
        bucketTypeHash: item.inventory?.bucketTypeHash ?? null,
        damageType: damageInfo.name,
        damageTypeIcon: damageInfo.icon,
        damageColor: damageInfo.color,
        ammoType,
        tierTypeName,
        tierType: item.inventory?.tierType || 0,
        isCraftable,
        sourceString: cleanSourceString,
        sourceCategory,
        intrinsic,
        originTraits,
        stats,
        statsList,
        socketColumns,
        allPerkNames: Array.from(allPerkNames),
        allPerkHashes: Array.from(allPerkHashes)
      });
    }

    // --- ARMOR (itemType === 2) ---
    else if (itemType === 2) {
      if (item.inventory?.tierTypeName !== 'Exotic' && item.inventory?.tierTypeName !== 'Legendary') continue;

      const armorSlot = getArmorSlotName(item.inventory?.bucketTypeHash, item.itemSubType);
      if (!armorSlot) continue;

      const classType = getClassTypeName(item.classType);

      let exoticPerk = null;
      if (tierTypeName === 'Exotic') {
        for (const entry of (item.sockets?.socketEntries || [])) {
          const ph = entry.singleInitialItemHash;
          if (ph) {
            const pDef = getItemByHash(ph);
            const pName = pDef?.displayProperties?.name?.trim();
            const pDesc = pDef?.displayProperties?.description?.trim();
            if (pName && pDesc && !pName.startsWith('Empty') && !pName.includes('Shader') && !pName.includes('Ornament') && !pName.includes('Mod') && !pName.includes('Upgrade') && !pName.includes('Tuning') && !pName.includes('Masterwork')) {
              exoticPerk = {
                hash: ph,
                name: pName,
                description: pDesc,
                icon: pDef.displayProperties?.icon ? 'https://www.bungie.net' + pDef.displayProperties.icon : null
              };
              enrichPerk(ph, 'Exotic Perk');
              break;
            }
          }
        }
      }

      // Armour stats are stored under their current names. Definitions from an
      // older manifest snapshot still use the pre-Edge-of-Fate names, so both
      // are accepted and folded onto the same canonical labels.
      const stats = {};
      let totalStats = 0;
      if (item.stats?.stats) {
        for (const [sHash, sVal] of Object.entries(item.stats.stats)) {
          const label = ARMOR_STAT_LABELS[statDefs[sHash]?.name];
          if (label) {
            stats[label] = sVal.value;
            totalStats += sVal.value;
          }
        }
      }
      stats.Total = totalStats;

      // Which set this piece belongs to. The field naming has moved around, so
      // each known spelling is tried and an unknown one simply means no set.
      const setHash = item.equippingBlock?.equipableItemSetHash
        ?? item.equippingBlock?.itemSetHash
        ?? item.equipableItemSetHash
        ?? item.itemSetHash
        ?? null;
      const armorSet = setHash != null ? armorSetDefs[setHash] : null;

      armorList.push({
        id: item.hash,
        name: item.displayProperties.name,
        flavorText: item.flavorText || '',
        icon: item.displayProperties.icon ? 'https://www.bungie.net' + item.displayProperties.icon : null,
        iconWatermark: item.iconWatermark ? 'https://www.bungie.net' + item.iconWatermark : null,
        screenshot: item.screenshot ? 'https://www.bungie.net' + item.screenshot : null,
        itemTypeDisplayName: item.itemTypeDisplayName || `${classType} ${armorSlot}`,
        classType,
        armorSlot,
        bucketTypeHash: item.inventory?.bucketTypeHash ?? null,
        tierTypeName,
        tierType: item.inventory?.tierType || 0,
        sourceString: cleanSourceString,
        sourceCategory,
        setHash: armorSet?.hash ?? null,
        setName: armorSet?.name || null,
        setBonuses: armorSet?.bonuses || [],
        exoticPerk,
        stats
      });
    }
  }

  db.close();

  const uniqueWeapons = deduplicateWeapons(weaponsList);
  const uniqueArmor = deduplicateArmor(armorList);

  const filtersData = {
    weaponTypes: Array.from(weaponTypesSet).sort(),
    damageTypes: Array.from(damageTypesSet).sort(),
    slots: Array.from(slotsSet).sort(),
    ammoTypes: Array.from(ammoTypesSet).sort(),
    tiers: Array.from(tiersSet).sort(),
    sourceCategories: Array.from(sourceCategoriesSet).sort(),
    perkColumns: {
      barrels: Array.from(perkColSets.barrels).sort(),
      magazines: Array.from(perkColSets.magazines).sort(),
      column3: Array.from(perkColSets.column3).sort(),
      column4: Array.from(perkColSets.column4).sort(),
      originTraits: Array.from(perkColSets.originTraits).sort(),
      intrinsics: Array.from(perkColSets.intrinsics).sort()
    },
    popularPerks: [
      'Incandescent', 'Voltshot', 'Kinetic Tremors', 'Bait and Switch',
      'Destabilizing Rounds', 'Precision Instrument', 'Reconstruction', 'Rewind Rounds',
      'Heal Clip', 'Firefly', 'Explosive Payload', 'Demolitionist',
      'Frenzy', 'Target Lock', 'Hatchling', 'Headstone',
      'Cascade Point', 'Envious Assassin', 'Auto-Loading Holster', 'Subsistence',
      'Outlaw', 'Rapid Hit', 'Desperado', 'Kill Clip'
    ],
    classes: ['Hunter', 'Titan', 'Warlock'],
    armorSlots: ['Helmet', 'Gauntlets', 'Chest Armor', 'Leg Armor', 'Class Item']
  };

  const metaData = {
    version,
    lastUpdated: new Date().toISOString(),
    weaponsCount: uniqueWeapons.length,
    armorCount: uniqueArmor.length,
    perksCount: Object.keys(perksCatalog).length
  };

  console.log(`Saving ${uniqueWeapons.length} weapons, ${uniqueArmor.length} armor pieces, ${Object.keys(perksCatalog).length} perks to data files...`);

  fs.writeFileSync(MANIFEST_META_FILE, JSON.stringify(metaData));
  fs.writeFileSync(WEAPONS_FILE, JSON.stringify(uniqueWeapons));
  fs.writeFileSync(ARMOR_FILE, JSON.stringify(uniqueArmor));
  fs.writeFileSync(PERKS_FILE, JSON.stringify(perksCatalog));
  fs.writeFileSync(FILTERS_FILE, JSON.stringify(filtersData));

  loadCachedData();
}

function deduplicateWeapons(list) {
  const map = new Map();
  for (const w of list) {
    const key = `${w.name}__${w.damageType}__${w.weaponType}__${w.tierTypeName}`;
    if (!map.has(key)) {
      map.set(key, w);
    } else {
      const existing = map.get(key);
      const scoreExisting = (existing.isCraftable ? 100 : 0) + existing.allPerkNames.length;
      const scoreCurrent = (w.isCraftable ? 100 : 0) + w.allPerkNames.length;
      if (scoreCurrent > scoreExisting) {
        map.set(key, w);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function deduplicateArmor(list) {
  const map = new Map();
  for (const a of list) {
    const key = `${a.name}__${a.classType}__${a.armorSlot}__${a.tierTypeName}`;
    if (!map.has(key)) {
      map.set(key, a);
    } else {
      const existing = map.get(key);
      if (a.exoticPerk && !existing.exoticPerk) {
        map.set(key, a);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function getWeaponTypeName(item) {
  const typeDisplay = (item.itemTypeDisplayName || '').toLowerCase();
  const cats = item.itemCategoryHashes || [];

  if (typeDisplay.includes('rocket launcher') || cats.includes(13)) return 'Rocket Launcher';
  if (typeDisplay.includes('linear fusion rifle') || cats.includes(1504914827)) return 'Linear Fusion Rifle';
  if (typeDisplay.includes('fusion rifle') || cats.includes(9)) return 'Fusion Rifle';
  if (typeDisplay.includes('grenade launcher') || cats.includes(55)) return 'Grenade Launcher';
  if (typeDisplay.includes('submachine gun') || cats.includes(3954685534)) return 'Submachine Gun';
  if (typeDisplay.includes('hand cannon') || cats.includes(6)) return 'Hand Cannon';
  if (typeDisplay.includes('auto rifle') || cats.includes(5)) return 'Auto Rifle';
  if (typeDisplay.includes('pulse rifle') || cats.includes(7)) return 'Pulse Rifle';
  if (typeDisplay.includes('scout rifle') || cats.includes(8)) return 'Scout Rifle';
  if (typeDisplay.includes('sidearm') || cats.includes(14)) return 'Sidearm';
  if (typeDisplay.includes('bow') || cats.includes(3317538576)) return 'Bow';
  if (typeDisplay.includes('shotgun') || cats.includes(11)) return 'Shotgun';
  if (typeDisplay.includes('sniper rifle') || cats.includes(10)) return 'Sniper Rifle';
  if (typeDisplay.includes('trace rifle') || cats.includes(3879778845)) return 'Trace Rifle';
  if (typeDisplay.includes('glaive') || cats.includes(1537574825)) return 'Glaive';
  if (typeDisplay.includes('machine gun') || cats.includes(12)) return 'Machine Gun';
  if (typeDisplay.includes('sword') || cats.includes(54)) return 'Sword';

  return item.itemTypeDisplayName || 'Weapon';
}

function getSlotName(bucketHash) {
  switch (bucketHash) {
    case BUCKET_HASHES.kinetic: return 'Kinetic';
    case BUCKET_HASHES.energy: return 'Energy';
    case BUCKET_HASHES.power: return 'Power';
    default: return 'Kinetic';
  }
}

/**
 * Armour slot for a definition. ItemSubType is the primary source because it
 * cannot be typo'd into silently dropping a whole slot from the dataset; the
 * equipment bucket backs it up for anything that predates those subtypes.
 */
function getArmorSlotName(bucketHash, itemSubType) {
  switch (itemSubType) {
    case ITEM_SUB_TYPES.helmet: return 'Helmet';
    case ITEM_SUB_TYPES.gauntlets: return 'Gauntlets';
    case ITEM_SUB_TYPES.chest: return 'Chest Armor';
    case ITEM_SUB_TYPES.legs: return 'Leg Armor';
    case ITEM_SUB_TYPES.classItem: return 'Class Item';
    default: break;
  }

  switch (bucketHash) {
    case BUCKET_HASHES.helmet: return 'Helmet';
    case BUCKET_HASHES.gauntlets: return 'Gauntlets';
    case BUCKET_HASHES.chest: return 'Chest Armor';
    case BUCKET_HASHES.legs: return 'Leg Armor';
    case BUCKET_HASHES.classItem: return 'Class Item';
    default: return null;
  }
}

/**
 * Armour stat display name -> canonical label. Both the current names and the
 * ones they replaced map onto the same entry so a manifest built before or
 * after the change produces identical output.
 */
const ARMOR_STAT_LABELS = {
  Weapons: 'Weapons',      Mobility: 'Weapons',
  Health: 'Health',        Resilience: 'Health',
  Class: 'Class',          Recovery: 'Class',
  Grenade: 'Grenade',      Discipline: 'Grenade',
  Super: 'Super',          Intellect: 'Super',
  Melee: 'Melee',          Strength: 'Melee'
};

function getClassTypeName(classType) {
  switch (classType) {
    case 0: return 'Titan';
    case 1: return 'Hunter';
    case 2: return 'Warlock';
    default: return 'Any';
  }
}

function getAmmoTypeName(ammoType) {
  switch (ammoType) {
    case 1: return 'Primary';
    case 2: return 'Special';
    case 3: return 'Heavy';
    default: return 'Primary';
  }
}

function getDamageColor(damageName) {
  switch (damageName?.toLowerCase()) {
    case 'solar': return '#f16c24';
    case 'arc': return '#79b9e7';
    case 'void': return '#b184c5';
    case 'stasis': return '#4d88ff';
    case 'strand': return '#35e385';
    default: return '#e2e8f0';
  }
}

function queryWeapons(params = {}) {
  let list = memoryDB.weapons;

  if (params.search && params.search.trim()) {
    const q = params.search.toLowerCase().trim();
    list = list.filter(w => 
      w.name.toLowerCase().includes(q) ||
      w.weaponType.toLowerCase().includes(q) ||
      w.itemTypeDisplayName?.toLowerCase().includes(q) ||
      (w.sourceString && w.sourceString.toLowerCase().includes(q)) ||
      (w.sourceCategory && w.sourceCategory.toLowerCase().includes(q)) ||
      w.allPerkNames.some(p => p.toLowerCase().includes(q))
    );
  }

  if (params.sourceCategory) {
    const cats = Array.isArray(params.sourceCategory) ? params.sourceCategory : params.sourceCategory.split(',').map(s => s.trim()).filter(Boolean);
    if (cats.length > 0) {
      list = list.filter(w => cats.includes(w.sourceCategory));
    }
  }

  if (params.weaponType) {
    const types = Array.isArray(params.weaponType) ? params.weaponType : params.weaponType.split(',').map(s => s.trim()).filter(Boolean);
    if (types.length > 0) {
      list = list.filter(w => types.includes(w.weaponType));
    }
  }

  if (params.damageType) {
    const dtypes = Array.isArray(params.damageType) ? params.damageType : params.damageType.split(',').map(s => s.trim()).filter(Boolean);
    if (dtypes.length > 0) {
      list = list.filter(w => dtypes.includes(w.damageType));
    }
  }

  if (params.slot) {
    const slots = Array.isArray(params.slot) ? params.slot : params.slot.split(',').map(s => s.trim()).filter(Boolean);
    if (slots.length > 0) {
      list = list.filter(w => slots.includes(w.slot));
    }
  }

  if (params.ammoType) {
    const ammos = Array.isArray(params.ammoType) ? params.ammoType : params.ammoType.split(',').map(s => s.trim()).filter(Boolean);
    if (ammos.length > 0) {
      list = list.filter(w => ammos.includes(w.ammoType));
    }
  }

  if (params.tier) {
    const tiers = Array.isArray(params.tier) ? params.tier : params.tier.split(',').map(s => s.trim()).filter(Boolean);
    if (tiers.length > 0) {
      list = list.filter(w => tiers.includes(w.tierTypeName));
    }
  }

  if (params.craftable === 'true' || params.craftable === true) {
    list = list.filter(w => w.isCraftable);
  }

  if (params.perks) {
    const perks = (Array.isArray(params.perks) ? params.perks : params.perks.split(','))
      .map(p => p.trim())
      .filter(Boolean);

    if (perks.length > 0) {
      const mode = (params.perkMatchMode || 'and').toLowerCase();
      if (mode === 'and') {
        list = list.filter(w => 
          perks.every(targetPerk => 
            w.allPerkNames.some(p => p.toLowerCase() === targetPerk.toLowerCase() || p.toLowerCase().includes(targetPerk.toLowerCase()))
          )
        );
      } else {
        list = list.filter(w => 
          perks.some(targetPerk => 
            w.allPerkNames.some(p => p.toLowerCase() === targetPerk.toLowerCase() || p.toLowerCase().includes(targetPerk.toLowerCase()))
          )
        );
      }
    }
  }

  if (params.column3Perk) {
    list = list.filter(w => {
      const col3 = w.socketColumns.find(c => c.type === 'Perk Column 3');
      return col3 && col3.perks.some(p => p.name.toLowerCase() === params.column3Perk.toLowerCase());
    });
  }

  if (params.column4Perk) {
    list = list.filter(w => {
      const col4 = w.socketColumns.find(c => c.type === 'Perk Column 4');
      return col4 && col4.perks.some(p => p.name.toLowerCase() === params.column4Perk.toLowerCase());
    });
  }

  if (params.originTrait) {
    list = list.filter(w => 
      w.originTraits.some(ot => ot.name.toLowerCase() === params.originTrait.toLowerCase())
    );
  }

  if (params.minRange) list = list.filter(w => (w.stats['Range'] || 0) >= Number(params.minRange));
  if (params.minStability) list = list.filter(w => (w.stats['Stability'] || 0) >= Number(params.minStability));
  if (params.minHandling) list = list.filter(w => (w.stats['Handling'] || 0) >= Number(params.minHandling));
  if (params.minReload) list = list.filter(w => (w.stats['Reload Speed'] || 0) >= Number(params.minReload));
  if (params.minAimAssist) list = list.filter(w => (w.stats['Aim Assistance'] || 0) >= Number(params.minAimAssist));
  if (params.minRPM) list = list.filter(w => (w.stats['Rounds Per Minute'] || 0) >= Number(params.minRPM));
  if (params.maxRPM) list = list.filter(w => (w.stats['Rounds Per Minute'] || 9999) <= Number(params.maxRPM));

  const sortBy = params.sortBy || 'name';
  const sortDir = (params.sortDir || 'asc').toLowerCase();

  list.sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else if (sortBy === 'tier') {
      cmp = b.tierType - a.tierType;
    } else if (sortBy === 'rpm') {
      cmp = (b.stats['Rounds Per Minute'] || 0) - (a.stats['Rounds Per Minute'] || 0);
    } else if (sortBy === 'range') {
      cmp = (b.stats['Range'] || 0) - (a.stats['Range'] || 0);
    } else if (sortBy === 'stability') {
      cmp = (b.stats['Stability'] || 0) - (a.stats['Stability'] || 0);
    } else if (sortBy === 'handling') {
      cmp = (b.stats['Handling'] || 0) - (a.stats['Handling'] || 0);
    } else if (sortBy === 'reload') {
      cmp = (b.stats['Reload Speed'] || 0) - (a.stats['Reload Speed'] || 0);
    } else if (sortBy === 'impact') {
      cmp = (b.stats['Impact'] || 0) - (a.stats['Impact'] || 0);
    }
    return sortDir === 'desc' ? cmp : -cmp;
  });

  const total = list.length;
  const page = Math.max(1, parseInt(params.page || 1, 10));
  const limit = Math.min(200, Math.max(1, parseInt(params.limit || 60, 10)));
  const offset = (page - 1) * limit;
  const paginated = list.slice(offset, offset + limit);

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    items: paginated
  };
}

function queryArmor(params = {}) {
  let list = memoryDB.armor;

  if (params.search && params.search.trim()) {
    const q = params.search.toLowerCase().trim();
    list = list.filter(a => 
      a.name.toLowerCase().includes(q) ||
      a.classType.toLowerCase().includes(q) ||
      a.armorSlot.toLowerCase().includes(q) ||
      (a.sourceString && a.sourceString.toLowerCase().includes(q)) ||
      (a.exoticPerk && (a.exoticPerk.name.toLowerCase().includes(q) || a.exoticPerk.description.toLowerCase().includes(q)))
    );
  }

  if (params.sourceCategory) {
    const cats = Array.isArray(params.sourceCategory) ? params.sourceCategory : params.sourceCategory.split(',').map(s => s.trim()).filter(Boolean);
    if (cats.length > 0) {
      list = list.filter(a => cats.includes(a.sourceCategory));
    }
  }

  if (params.classType) {
    const classes = Array.isArray(params.classType) ? params.classType : params.classType.split(',').map(s => s.trim()).filter(Boolean);
    if (classes.length > 0) {
      list = list.filter(a => classes.includes(a.classType));
    }
  }

  if (params.armorSlot) {
    const slots = Array.isArray(params.armorSlot) ? params.armorSlot : params.armorSlot.split(',').map(s => s.trim()).filter(Boolean);
    if (slots.length > 0) {
      list = list.filter(a => slots.includes(a.armorSlot));
    }
  }

  if (params.tier) {
    const tiers = Array.isArray(params.tier) ? params.tier : params.tier.split(',').map(s => s.trim()).filter(Boolean);
    if (tiers.length > 0) {
      list = list.filter(a => tiers.includes(a.tierTypeName));
    }
  }

  if (params.hasExoticPerk === 'true' || params.hasExoticPerk === true) {
    list = list.filter(a => !!a.exoticPerk);
  }

  if (params.minResilience) list = list.filter(a => (a.stats?.Resilience || 0) >= Number(params.minResilience));
  if (params.minRecovery) list = list.filter(a => (a.stats?.Recovery || 0) >= Number(params.minRecovery));
  if (params.minDiscipline) list = list.filter(a => (a.stats?.Discipline || 0) >= Number(params.minDiscipline));

  list.sort((a, b) => a.name.localeCompare(b.name));

  const total = list.length;
  const page = Math.max(1, parseInt(params.page || 1, 10));
  const limit = Math.min(200, Math.max(1, parseInt(params.limit || 60, 10)));
  const offset = (page - 1) * limit;

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    items: list.slice(offset, offset + limit)
  };
}

function queryPerks(params = {}) {
  let list = memoryDB.perkList;

  if (params.search && params.search.trim()) {
    const q = params.search.toLowerCase().trim();
    list = list.filter(p => 
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
  }

  if (params.category) {
    const cats = Array.isArray(params.category) ? params.category : params.category.split(',').map(s => s.trim()).filter(Boolean);
    if (cats.length > 0) {
      list = list.filter(p => cats.includes(p.category));
    }
  }

  if (params.isEnhanced === 'true' || params.isEnhanced === true) {
    list = list.filter(p => p.isEnhanced);
  }

  list.sort((a, b) => a.name.localeCompare(b.name));

  const total = list.length;
  const page = Math.max(1, parseInt(params.page || 1, 10));
  const limit = Math.min(200, Math.max(1, parseInt(params.limit || 60, 10)));
  const offset = (page - 1) * limit;

  const items = list.slice(offset, offset + limit).map(p => {
    const compatibleWeapons = memoryDB.perkWeaponsMap.get(String(p.hash)) || [];
    return {
      ...p,
      weaponCount: compatibleWeapons.length,
      compatibleWeapons: compatibleWeapons.slice(0, 15)
    };
  });

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    items
  };
}

function getWeaponById(id) {
  return memoryDB.weaponsMap.get(String(id)) || null;
}

function getArmorById(id) {
  return memoryDB.armorMap.get(String(id)) || null;
}

function getPerkByHash(hash) {
  const perk = memoryDB.perks[hash];
  if (!perk) return null;
  const compatibleWeapons = memoryDB.perkWeaponsMap.get(String(hash)) || [];
  return {
    ...perk,
    compatibleWeapons
  };
}

function getSuggestions(query = '') {
  const q = (query || '').toLowerCase().trim();
  if (!q) return { weapons: [], archetypes: [], sources: [], weaponTypes: [] };

  const weapons = [];
  const matchedArchetypes = new Set();
  const matchedSources = new Set();
  const matchedWeaponTypes = new Set();

  for (const w of memoryDB.weapons) {
    if (w.name.toLowerCase().includes(q) && weapons.length < 8) {
      weapons.push({
        id: w.id,
        name: w.name,
        weaponType: w.weaponType,
        damageType: w.damageType,
        tierTypeName: w.tierTypeName,
        icon: w.icon,
        sourceString: w.sourceString,
        sourceCategory: w.sourceCategory
      });
    }
    if (w.intrinsic?.name && w.intrinsic.name.toLowerCase().includes(q)) {
      matchedArchetypes.add(w.intrinsic.name);
    }
    if (w.sourceString && w.sourceString.toLowerCase().includes(q)) {
      matchedSources.add(w.sourceString);
    }
    if (w.weaponType && w.weaponType.toLowerCase().includes(q)) {
      matchedWeaponTypes.add(w.weaponType);
    }
  }

  return {
    weapons,
    archetypes: Array.from(matchedArchetypes).slice(0, 6),
    sources: Array.from(matchedSources).slice(0, 6),
    weaponTypes: Array.from(matchedWeaponTypes).slice(0, 6)
  };
}

function getFilters() {
  return memoryDB.filters;
}

module.exports = {
  loadCachedData,
  syncManifest,
  getSyncStatus,
  queryWeapons,
  queryArmor,
  queryPerks,
  getWeaponById,
  getArmorById,
  getPerkByHash,
  getFilters,
  getSuggestions
};
