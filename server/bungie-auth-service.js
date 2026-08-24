const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');
const manifestService = require('./manifest-service');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const AUTH_SESSION_FILE = path.join(DATA_DIR, 'auth-session.json');

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    }
  } catch (e) {}
  return { apiKey: '', clientId: '', clientSecret: '', autoSync: true };
}

function saveSettings(s) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2));
  } catch (e) {}
}

function loadAuthSession() {
  try {
    if (fs.existsSync(AUTH_SESSION_FILE)) {
      return JSON.parse(fs.readFileSync(AUTH_SESSION_FILE, 'utf-8'));
    }
  } catch (e) {}
  return null;
}

function saveAuthSession(session) {
  try {
    if (!session) {
      if (fs.existsSync(AUTH_SESSION_FILE)) fs.unlinkSync(AUTH_SESSION_FILE);
      return;
    }
    fs.writeFileSync(AUTH_SESSION_FILE, JSON.stringify(session, null, 2));
  } catch (e) {}
}

function getBungieAuthUrl(redirectOrigin = '') {
  const settings = loadSettings();
  if (!settings.clientId) {
    return { error: 'OAuth Client ID is not configured. Please add it in Settings.' };
  }
  const redirectUri = redirectOrigin 
    ? `${redirectOrigin}/oauth/callback`
    : 'http://localhost:5173/oauth/callback';

  const state = Math.random().toString(36).substring(2, 15);
  const url = `https://www.bungie.net/en/OAuth/Authorize?client_id=${settings.clientId}&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  
  return { url, state, redirectUri };
}

async function exchangeAuthCode(code, redirectUri = '') {
  const settings = loadSettings();
  if (!settings.clientId || !settings.clientSecret) {
    throw new Error('OAuth Client ID and Secret are required to complete login.');
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('client_id', settings.clientId);
  params.append('client_secret', settings.clientSecret);
  if (redirectUri) {
    params.append('redirect_uri', redirectUri);
  }

  const response = await axios.post('https://www.bungie.net/Platform/App/OAuth/Token/', params.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-API-Key': settings.apiKey || ''
    }
  });

  const tokenData = response.data;
  const session = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: Date.now() + (tokenData.expires_in * 1000),
    refreshExpiresAt: Date.now() + (tokenData.refresh_expires_in * 1000),
    membershipId: tokenData.membership_id,
    user: null
  };

  // Fetch Bungie Profile & Destiny Memberships
  try {
    const userMemberships = await getMembershipsForCurrentUser(session.accessToken);
    session.user = userMemberships;
  } catch (e) {
    console.error('Error fetching user memberships:', e.message);
  }

  saveAuthSession(session);
  return session;
}

async function getValidAccessToken() {
  const session = loadAuthSession();
  if (!session || !session.accessToken) return null;

  if (Date.now() > session.expiresAt - 60000) {
    // Refresh token
    const settings = loadSettings();
    if (!session.refreshToken || !settings.clientId || !settings.clientSecret) {
      return null;
    }

    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'refresh_token');
      params.append('refresh_token', session.refreshToken);
      params.append('client_id', settings.clientId);
      params.append('client_secret', settings.clientSecret);

      const response = await axios.post('https://www.bungie.net/Platform/App/OAuth/Token/', params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-API-Key': settings.apiKey || ''
        }
      });

      const tokenData = response.data;
      session.accessToken = tokenData.access_token;
      session.refreshToken = tokenData.refresh_token;
      session.expiresAt = Date.now() + (tokenData.expires_in * 1000);
      saveAuthSession(session);
    } catch (err) {
      console.error('Error refreshing Bungie OAuth token:', err.message);
      return null;
    }
  }

  return session.accessToken;
}

async function getMembershipsForCurrentUser(accessToken = null) {
  const token = accessToken || await getValidAccessToken();
  if (!token) throw new Error('Not authenticated');

  const settings = loadSettings();
  const res = await axios.get('https://www.bungie.net/Platform/User/GetMembershipsForCurrentUser/', {
    headers: {
      'X-API-Key': settings.apiKey || '',
      'Authorization': `Bearer ${token}`
    }
  });

  return res.data?.Response;
}

async function getProfileData(membershipType, destinyMembershipId) {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Not authenticated with Bungie.net');

  const settings = loadSettings();
  // Components:
  // 100: Profiles, 102: ProfileInventories (Vault), 200: Characters, 201: CharacterInventories,
  // 205: CharacterEquipment, 300: ItemInstances, 304: ItemSockets, 305: ItemReusablePlugs, 206: CharacterLoadouts
  const components = '100,102,200,201,205,300,304,305,206';
  const url = `https://www.bungie.net/Platform/Destiny2/${membershipType}/Profile/${destinyMembershipId}/?components=${components}`;

  const res = await axios.get(url, {
    headers: {
      'X-API-Key': settings.apiKey || '',
      'Authorization': `Bearer ${token}`
    }
  });

  const rawData = res.data?.Response;
  return formatProfileResponse(rawData);
}

function formatProfileResponse(data) {
  if (!data) return null;

  const charactersMap = data.characters?.data || {};
  const characterEquipmentMap = data.characterEquipment?.data || {};
  const characterInventoriesMap = data.characterInventories?.data || {};
  const characterLoadoutsMap = data.characterLoadouts?.data || {};
  const itemInstancesMap = data.itemComponents?.instances?.data || {};
  const itemSocketsMap = data.itemComponents?.sockets?.data || {};
  const vaultItemsRaw = data.profileInventory?.data?.items || [];

  const characters = Object.values(charactersMap).map(char => {
    const charId = char.characterId;
    const classType = char.classType === 0 ? 'Titan' : char.classType === 1 ? 'Hunter' : 'Warlock';
    const equippedRaw = characterEquipmentMap[charId]?.items || [];
    const bagRaw = characterInventoriesMap[charId]?.items || [];
    const loadoutsRaw = characterLoadoutsMap[charId]?.loadouts || [];

    const equipped = equippedRaw.map(it => enrichInventoryItem(it, itemInstancesMap, itemSocketsMap)).filter(Boolean);
    const bag = bagRaw.map(it => enrichInventoryItem(it, itemInstancesMap, itemSocketsMap)).filter(Boolean);
    const loadouts = loadoutsRaw.map((ld, idx) => ({
      index: idx,
      name: ld.nameId || `Loadout ${idx + 1}`,
      colorHash: ld.colorHash,
      iconHash: ld.iconHash,
      items: ld.items?.map(it => ({
        itemInstanceId: it.itemInstanceId,
        plugItemHashes: it.plugItemHashes
      }))
    }));

    return {
      characterId: charId,
      classType,
      light: char.light,
      emblemPath: char.emblemPath ? 'https://www.bungie.net' + char.emblemPath : null,
      emblemBackgroundPath: char.emblemBackgroundPath ? 'https://www.bungie.net' + char.emblemBackgroundPath : null,
      emblemColor: char.emblemColor,
      stats: char.stats,
      equipped,
      bag,
      loadouts
    };
  });

  const vault = vaultItemsRaw.map(it => enrichInventoryItem(it, itemInstancesMap, itemSocketsMap)).filter(Boolean);

  return {
    profileInfo: data.profile?.data?.userInfo,
    characters,
    vault
  };
}

function enrichInventoryItem(item, instances, sockets) {
  if (!item || !item.itemHash) return null;

  const instance = item.itemInstanceId ? instances[item.itemInstanceId] : null;
  const socketData = item.itemInstanceId ? sockets[item.itemInstanceId] : null;

  const manifestWeapon = manifestService.getWeaponById(item.itemHash);
  const manifestArmor = manifestService.getArmorById(item.itemHash);
  const baseItem = manifestWeapon || manifestArmor;

  if (!baseItem) return null;

  const isWeapon = !!manifestWeapon;
  const perks = [];

  if (socketData?.sockets) {
    socketData.sockets.forEach(s => {
      if (s.plugHash) {
        const perk = manifestService.getPerkByHash(s.plugHash);
        if (perk && !perk.name.startsWith('Default') && !perk.name.startsWith('Empty') && !perk.name.includes('Shader') && !perk.name.includes('Ornament')) {
          perks.push(perk.name);
        }
      }
    });
  }

  return {
    itemInstanceId: item.itemInstanceId,
    itemHash: item.itemHash,
    name: baseItem.name,
    icon: baseItem.icon,
    tierTypeName: baseItem.tierTypeName,
    weaponType: baseItem.weaponType || null,
    armorSlot: baseItem.armorSlot || null,
    // The client groups gear by these, so a proxied profile has to carry them.
    isWeapon,
    isArmor: !isWeapon,
    damageType: baseItem.damageType || null,
    damageColor: baseItem.damageColor || '#e2e8f0',
    slot: baseItem.slot || null,
    power: instance?.primaryStat?.value || instance?.itemLevel || null,
    isEquipped: instance?.isEquipped || false,
    canEquip: instance?.canEquip || true,
    location: item.location,
    bucketHash: item.bucketHash,
    perks,
    sourceString: baseItem.sourceString || null,
    sourceCategory: baseItem.sourceCategory || null,
    isCraftable: baseItem.isCraftable || false,
    baseItem
  };
}

// Actions: Equip Item
async function equipItem(membershipType, characterId, itemInstanceId) {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Not authenticated with Bungie.net');

  const settings = loadSettings();
  const url = 'https://www.bungie.net/Platform/Destiny2/Actions/Items/EquipItem/';
  
  const res = await axios.post(url, {
    itemId: itemInstanceId,
    characterId,
    membershipType
  }, {
    headers: {
      'X-API-Key': settings.apiKey || '',
      'Authorization': `Bearer ${token}`
    }
  });

  return res.data;
}

// Actions: Transfer Item
async function transferItem(membershipType, characterId, itemReferenceHash, itemInstanceId, transferToVault = false) {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Not authenticated with Bungie.net');

  const settings = loadSettings();
  const url = 'https://www.bungie.net/Platform/Destiny2/Actions/Items/TransferItem/';
  
  const res = await axios.post(url, {
    itemReferenceHash,
    itemId: itemInstanceId,
    stackSize: 1,
    transferToVault,
    characterId,
    membershipType
  }, {
    headers: {
      'X-API-Key': settings.apiKey || '',
      'Authorization': `Bearer ${token}`
    }
  });

  return res.data;
}

// Actions: Equip Loadout
async function equipLoadout(membershipType, characterId, loadoutIndex) {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Not authenticated with Bungie.net');

  const settings = loadSettings();
  const url = 'https://www.bungie.net/Platform/Destiny2/Actions/Loadouts/EquipLoadout/';
  
  const res = await axios.post(url, {
    loadoutIndex,
    characterId,
    membershipType
  }, {
    headers: {
      'X-API-Key': settings.apiKey || '',
      'Authorization': `Bearer ${token}`
    }
  });

  return res.data;
}

module.exports = {
  loadSettings,
  saveSettings,
  loadAuthSession,
  saveAuthSession,
  getBungieAuthUrl,
  exchangeAuthCode,
  getMembershipsForCurrentUser,
  getProfileData,
  equipItem,
  transferItem,
  equipLoadout
};
