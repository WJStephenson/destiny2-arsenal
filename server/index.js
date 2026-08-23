const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const manifestService = require('./manifest-service');
const bungieAuth = require('./bungie-auth-service');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Settings file
const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'settings.json');
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    }
  } catch (e) {}
  return { apiKey: '', autoSync: true };
}
function saveSettings(s) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2));
  } catch (e) {}
}

// Load cached data on boot
const loaded = manifestService.loadCachedData();
if (!loaded) {
  console.log('No cache found. Starting initial manifest sync in background...');
  const settings = loadSettings();
  manifestService.syncManifest(settings.apiKey || '', false).catch(err => {
    console.error('Initial sync background error:', err.message);
  });
}

// Routes
// 1. Status
app.get('/api/status', (req, res) => {
  res.json(manifestService.getSyncStatus());
});

// 2. Sync Manifest
app.post('/api/manifest/sync', async (req, res) => {
  const { apiKey, force } = req.body || {};
  try {
    const result = await manifestService.syncManifest(apiKey || loadSettings().apiKey, !!force);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Filters Metadata
app.get('/api/filters', (req, res) => {
  res.json(manifestService.getFilters());
});

// 3.5 Suggestions / Autocomplete
app.get('/api/suggestions', (req, res) => {
  const query = req.query.q || '';
  res.json(manifestService.getSuggestions(query));
});

// 4. Query Weapons
app.get('/api/weapons', (req, res) => {
  try {
    const results = manifestService.queryWeapons(req.query);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Single Weapon Detail
app.get('/api/weapons/:id', (req, res) => {
  const weapon = manifestService.getWeaponById(req.params.id);
  if (!weapon) {
    return res.status(404).json({ error: 'Weapon not found' });
  }
  res.json(weapon);
});

// 6. Query Armor
app.get('/api/armor', (req, res) => {
  try {
    const results = manifestService.queryArmor(req.query);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Single Armor Detail
app.get('/api/armor/:id', (req, res) => {
  const armor = manifestService.getArmorById(req.params.id);
  if (!armor) {
    return res.status(404).json({ error: 'Armor not found' });
  }
  res.json(armor);
});

// 8. Query Perks Encyclopedia
app.get('/api/perks', (req, res) => {
  try {
    const results = manifestService.queryPerks(req.query);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Single Perk Detail with compatible weapons
app.get('/api/perks/:hash', (req, res) => {
  const perk = manifestService.getPerkByHash(req.params.hash);
  if (!perk) {
    return res.status(404).json({ error: 'Perk not found' });
  }
  res.json(perk);
});

// 10. Weapon Comparison Endpoint
app.post('/api/compare', (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Please provide array of weapon IDs' });
  }
  const weapons = ids.map(id => manifestService.getWeaponById(id)).filter(Boolean);
  res.json({ weapons });
});

// 11. Generate DIM Query String
app.post('/api/dim-query', (req, res) => {
  const { name, perks, element, weaponType, craftable } = req.body || {};
  let query = '';
  if (name) query += `name:"${name}" `;
  if (element) query += `element:${element.toLowerCase()} `;
  if (weaponType) query += `is:${weaponType.toLowerCase().replace(/\s+/g, '')} `;
  if (craftable) query += `is:craftable `;
  if (Array.isArray(perks)) {
    perks.forEach(p => {
      if (p) query += `perk:"${p}" `;
    });
  }
  res.json({ query: query.trim() });
});

// 12. Settings
app.get('/api/settings', (req, res) => {
  res.json(bungieAuth.loadSettings());
});

app.post('/api/settings', (req, res) => {
  const settings = { ...bungieAuth.loadSettings(), ...req.body };
  bungieAuth.saveSettings(settings);
  res.json({ success: true, settings });
});

// 13. OAuth Auth URL
app.get('/api/auth/url', (req, res) => {
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const origin = req.query.origin || req.headers.origin || `${proto}://${host}`;
  const result = bungieAuth.getBungieAuthUrl(origin);
  res.json(result);
});

// 14. OAuth Exchange Code
app.post('/api/auth/token', async (req, res) => {
  const { code, redirectUri } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Authorization code is required' });
  try {
    const session = await bungieAuth.exchangeAuthCode(code, redirectUri);
    res.json({ success: true, session });
  } catch (err) {
    console.error('OAuth exchange error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error_description || err.message });
  }
});

// 15. Get Auth Session
app.get('/api/auth/session', async (req, res) => {
  try {
    const session = bungieAuth.loadAuthSession();
    if (!session) return res.json({ authenticated: false });
    
    // Check if token valid
    const token = await bungieAuth.getValidAccessToken();
    if (!token) return res.json({ authenticated: false });

    res.json({ authenticated: true, session });
  } catch (err) {
    res.json({ authenticated: false, error: err.message });
  }
});

// 16. Logout
app.post('/api/auth/logout', (req, res) => {
  bungieAuth.saveAuthSession(null);
  res.json({ success: true });
});

// 17. Live Profile & Inventory Data
app.get('/api/inventory/profile', async (req, res) => {
  try {
    let { membershipType, membershipId } = req.query;
    if (!membershipType || !membershipId) {
      const session = bungieAuth.loadAuthSession();
      if (!session || !session.user) {
        return res.status(401).json({ error: 'Not authenticated with Bungie. Please log in.' });
      }
      const primary = session.user.destinyMemberships?.[0];
      if (!primary) return res.status(404).json({ error: 'No Destiny 2 accounts found' });
      membershipType = primary.membershipType;
      membershipId = primary.membershipId;
    }

    const data = await bungieAuth.getProfileData(membershipType, membershipId);
    res.json(data);
  } catch (err) {
    console.error('Error fetching live inventory profile:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.Message || err.message });
  }
});

// 18. Equip Item Action
app.post('/api/inventory/equip', async (req, res) => {
  const { membershipType, characterId, itemInstanceId } = req.body || {};
  if (!membershipType || !characterId || !itemInstanceId) {
    return res.status(400).json({ error: 'Missing membershipType, characterId, or itemInstanceId' });
  }
  try {
    const result = await bungieAuth.equipItem(membershipType, characterId, itemInstanceId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.Message || err.message });
  }
});

// 19. Transfer Item Action (Character <-> Vault)
app.post('/api/inventory/transfer', async (req, res) => {
  const { membershipType, characterId, itemReferenceHash, itemInstanceId, transferToVault } = req.body || {};
  if (!membershipType || !characterId || !itemReferenceHash || !itemInstanceId) {
    return res.status(400).json({ error: 'Missing required transfer parameters' });
  }
  try {
    const result = await bungieAuth.transferItem(membershipType, characterId, itemReferenceHash, itemInstanceId, !!transferToVault);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.Message || err.message });
  }
});

// 20. Equip Loadout Action
app.post('/api/inventory/equip-loadout', async (req, res) => {
  const { membershipType, characterId, loadoutIndex } = req.body || {};
  if (membershipType === undefined || !characterId || loadoutIndex === undefined) {
    return res.status(400).json({ error: 'Missing membershipType, characterId, or loadoutIndex' });
  }
  try {
    const result = await bungieAuth.equipLoadout(membershipType, characterId, loadoutIndex);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.Message || err.message });
  }
});

// Serve frontend in production
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Destiny 2 Arsenal API Server running on http://0.0.0.0:${PORT}`);
});
