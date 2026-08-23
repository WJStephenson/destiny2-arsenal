import React, { useEffect, useState } from 'react';
import { Shield, Check, AlertCircle, RefreshCw } from 'lucide-react';

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
    try {
      const redirectUri = `${window.location.origin}/oauth/callback`;
      const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirectUri })
      });
      const data = await res.json();

      if (data.success) {
        setStatus('success');
        setTimeout(() => {
          window.history.replaceState({}, document.title, window.location.pathname.replace('/oauth/callback', ''));
          onComplete(data.session);
        }, 1200);
      } else {
        setError(data.error || 'Failed to exchange authorization code');
        setStatus('error');
      }
    } catch (e) {
      setError(e.message || 'Error connecting to server');
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
          <div className="space-y-2 animate-fadeIn">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <Check className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-emerald-400 font-heading">
              Connected Successfully!
            </h2>
            <p className="text-xs text-slate-400">Loading your character inventory & vault...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-rose-400 font-heading">
              Authentication Failed
            </h2>
            <p className="text-xs text-slate-400 bg-[#0b0e14] p-3 rounded border border-rose-500/30">
              {error}
            </p>
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
            >
              Back to Armory
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
