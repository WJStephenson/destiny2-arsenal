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

/**
 * The profile exactly as Bungie sends it.
 *
 * Reshaping it here used to mean two different pipelines producing two
 * different profiles -- the proxied one silently dropped any item missing from
 * this server's manifest snapshot and carried no armour stats. The client has
 * one enrichment path; this route only lends it the credentials.
 */
async function getProfileData(membershipType, destinyMembershipId) {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Not authenticated with Bungie.net');

  const settings = loadSettings();
  // Components:
  // 100: Profiles, 102: ProfileInventories (Vault), 200: Characters,
  // 201: CharacterInventories, 202: CharacterProgressions (seasonal artifact),
  // 205: CharacterEquipment, 206: CharacterLoadouts, 300: ItemInstances,
  // 304: ItemStats, 305: ItemSockets (and the profile's plug sets),
  // 310: ItemReusablePlugs -- the subclass options this player actually owns.
  const components = '100,102,200,201,202,205,206,300,304,305,310';
  const url = `https://www.bungie.net/Platform/Destiny2/${membershipType}/Profile/${destinyMembershipId}/?components=${components}`;

  const res = await axios.get(url, {
    headers: {
      'X-API-Key': settings.apiKey || '',
      'Authorization': `Bearer ${token}`
    }
  });

  return res.data?.Response;
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

/**
 * Actions: insert a plug into a socket.
 *
 * The "free" insertion covers subclass plugs -- Supers, abilities, Aspects and
 * Fragments -- and armour mods. Bungie answers with its own verdict in the
 * body, which is passed back untouched so the client reads one error shape.
 */
async function insertSocketPlug(membershipType, characterId, itemInstanceId, socketIndex, plugItemHash) {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Not authenticated with Bungie.net');

  const settings = loadSettings();
  const url = 'https://www.bungie.net/Platform/Destiny2/Actions/Items/InsertSocketPlugFree/';

  const res = await axios.post(url, {
    plug: {
      socketIndex,
      socketArrayType: 0,
      plugItemHash
    },
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
  equipLoadout,
  insertSocketPlug
};
