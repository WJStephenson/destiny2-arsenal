const SETTINGS_STORAGE_KEY = 'destiny2_arsenal_settings';
const AUTH_SESSION_STORAGE_KEY = 'destiny2_arsenal_auth_session';

export function getStoredSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {
    console.error('Error reading settings from localStorage:', e);
  }
  return { apiKey: '', clientId: '', clientSecret: '', autoSync: true };
}

export function saveStoredSettings(settings) {
  try {
    const current = getStoredSettings();
    const merged = { ...current, ...settings };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
    
    // Also sync to server in background if API is accessible
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged)
    }).catch(() => {});

    return merged;
  } catch (e) {
    console.error('Error saving settings to localStorage:', e);
    return settings;
  }
}

export function getStoredAuthSession() {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.accessToken) {
        return { authenticated: true, session: parsed };
      }
    }
  } catch (e) {
    console.error('Error reading auth session from localStorage:', e);
  }
  return { authenticated: false, session: null };
}

export function saveStoredAuthSession(sessionData) {
  try {
    if (!sessionData) {
      localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      return { authenticated: false, session: null };
    }

    const sessionObj = sessionData.session || sessionData;
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(sessionObj));
    return { authenticated: true, session: sessionObj };
  } catch (e) {
    console.error('Error saving auth session to localStorage:', e);
    return { authenticated: false, session: null };
  }
}

export function clearStoredAuthSession() {
  try {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  } catch (e) {}
  return { authenticated: false, session: null };
}

export async function fetchBungieCurrentUser(token, apiKey = '') {
  try {
    const headers = { 'Authorization': `Bearer ${token}` };
    if (apiKey) headers['X-API-Key'] = apiKey;

    const res = await fetch('https://www.bungie.net/Platform/User/GetMembershipsForCurrentUser/', { headers });
    const data = await res.json();
    if (data.Response) {
      const bNet = data.Response.bungieNetUser;
      const primaryMem = data.Response.destinyMemberships?.[0];
      
      // Determine real Bungie Global Name (e.g. 'WJStephenson#1234') or Gamer Tag
      const bungieGlobalName = primaryMem?.bungieGlobalDisplayName 
        ? `${primaryMem.bungieGlobalDisplayName}${primaryMem.bungieGlobalDisplayNameCode != null ? '#' + String(primaryMem.bungieGlobalDisplayNameCode).padStart(4, '0') : ''}`
        : null;

      const realName = bungieGlobalName || bNet?.uniqueName || bNet?.displayName || primaryMem?.displayName || 'Guardian';

      return {
        ...data.Response,
        displayName: realName,
        bungieGlobalName,
        bungieNetUser: bNet,
        destinyMemberships: data.Response.destinyMemberships
      };
    }
  } catch (e) {
    console.error('Error fetching Bungie user profile:', e);
  }
  return null;
}

let apiKeyHydration = null;

/**
 * Make sure the browser has an API key before it talks to Bungie directly.
 *
 * A self-hosted setup configures its keys on the server, so the browser can be
 * running without one; without a key every direct call to Bungie fails. The
 * server is asked once, and only for the key -- nothing else is copied here.
 */
export async function ensureApiKey() {
  const current = getStoredSettings();
  if (current.apiKey) return current;

  if (!apiKeyHydration) {
    apiKeyHydration = (async () => {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) return current;
        const data = await res.json();
        if (data?.apiKey) return saveStoredSettings({ apiKey: data.apiKey });
      } catch (e) {
        // No local server (or it served the app shell): nothing to hydrate.
      }
      return current;
    })();
  }

  return apiKeyHydration;
}

export async function getValidAuthToken() {
  const { session } = getStoredAuthSession();
  if (!session || !session.accessToken) return null;

  // Check if token is still valid (with 60 second buffer)
  const isExpired = session.expiresAt && Date.now() > session.expiresAt - 60000;
  if (!isExpired) {
    return session.accessToken;
  }

  // Token is expired, try to refresh
  const settings = getStoredSettings();
  if (!session.refreshToken) return null;

  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', session.refreshToken);
    if (settings.clientId) params.append('client_id', settings.clientId);
    if (settings.clientSecret) params.append('client_secret', settings.clientSecret);

    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (settings.apiKey) headers['X-API-Key'] = settings.apiKey;

    const res = await fetch('https://www.bungie.net/Platform/App/OAuth/Token/', {
      method: 'POST',
      headers,
      body: params.toString()
    });

    const data = await res.json();
    if (data.access_token) {
      const updated = {
        ...session,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || session.refreshToken,
        expiresAt: Date.now() + (data.expires_in * 1000)
      };
      saveStoredAuthSession(updated);
      return updated.accessToken;
    }
  } catch (err) {
    console.error('Failed to refresh Bungie OAuth token:', err);
  }

  return session.accessToken;
}
