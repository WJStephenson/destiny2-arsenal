import React, { useEffect, useState } from 'react';
import { Shield, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { getStoredSettings, saveStoredAuthSession } from '../utils/auth-storage';

export default function OAuthCallback({ onComplete }) {
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) {
      setError('No authorization code found in URL');
      setStatus('error');
      return;
    }

    exchangeCode(code);
  }, []);

  const exchangeCode = async (code) => {
    const redirectUri = `${window.location.origin}/oauth/callback`;

    // 1. Try local Express backend API
    try {
      const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirectUri })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.session) {
          saveStoredAuthSession(data.session);
          setStatus('success');
          setTimeout(() => {
            window.history.replaceState({}, document.title, '/');
            onComplete(data.session);
          }, 1000);
          return;
        }
      }
    } catch (e) {}

    // 2. Direct Bungie Token Exchange Fallback (for Cloudflare / static hosts)
    try {
      const settings = getStoredSettings();
      if (!settings.clientId || !settings.clientSecret) {
        throw new Error('OAuth Client ID and Secret are missing from Settings. Please add them.');
      }

      const bodyParams = new URLSearchParams();
      bodyParams.append('grant_type', 'authorization_code');
      bodyParams.append('code', code);
      bodyParams.append('client_id', settings.clientId);
      bodyParams.append('client_secret', settings.clientSecret);

      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
      };
      if (settings.apiKey) {
        headers['X-API-Key'] = settings.apiKey;
      }

      const tokenRes = await fetch('https://www.bungie.net/Platform/App/OAuth/Token/', {
        method: 'POST',
        headers,
        body: bodyParams.toString()
      });

      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        const session = {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt: Date.now() + (tokenData.expires_in * 1000),
          membershipId: tokenData.membership_id,
          user: {
            membershipId: tokenData.membership_id,
            bungieNetUser: {
              displayName: `Guardian #${tokenData.membership_id}`
            }
          }
        };

        saveStoredAuthSession(session);
        setStatus('success');
        setTimeout(() => {
          window.history.replaceState({}, document.title, '/');
          onComplete(session);
        }, 1000);
      } else {
        throw new Error(tokenData.error_description || tokenData.Message || 'Failed to exchange token with Bungie');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#121722] border border-[#28354d] rounded-2xl p-8 text-center space-y-5 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
          <Shield className="w-8 h-8 text-amber-400" />
        </div>

        {status === 'processing' && (
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white font-heading">
              Authenticating with Bungie.net...
            </h2>
            <p className="text-xs text-slate-400">Exchanging authorization token & syncing Guardian data</p>
            <div className="pt-3 flex justify-center">
              <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white font-heading">
              Successfully Connected!
            </h2>
            <p className="text-xs text-slate-400">Loading your Guardian inventory and Vault...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white font-heading">
              Authentication Failed
            </h2>
            <p className="text-xs text-rose-300/80 bg-rose-500/10 p-3 rounded-lg border border-rose-500/30">
              {error}
            </p>
            <button
              onClick={() => {
                window.location.href = '/';
              }}
              className="mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg"
            >
              Return to Arsenal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
