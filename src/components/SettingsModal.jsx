import React, { useState, useEffect } from 'react';
import { 
  X, 
  RefreshCw, 
  Database, 
  Key, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  AlertCircle,
  Copy,
  Lock
} from 'lucide-react';

export default function SettingsModal({ 
  onClose, 
  manifestStatus, 
  onTriggerSync, 
  isSyncing 
}) {
  const [apiKey, setApiKey] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [savedSettings, setSavedSettings] = useState(false);
  const [copiedRedirect, setCopiedRedirect] = useState(false);

  const redirectUri = `${window.location.origin}/oauth/callback`;

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.apiKey) setApiKey(data.apiKey);
        if (data.clientId) setClientId(data.clientId);
        if (data.clientSecret) setClientSecret(data.clientSecret);
      })
      .catch(console.error);
  }, []);

  const handleSaveSettings = async () => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, clientId, clientSecret })
      });
      setSavedSettings(true);
      setTimeout(() => setSavedSettings(false), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  const copyRedirect = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopiedRedirect(true);
    setTimeout(() => setCopiedRedirect(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-[#121722] border border-[#28354d] rounded-2xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 bg-slate-900 border-b border-[#20293a] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <Database className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-heading">Settings & API Configuration</h2>
              <p className="text-xs text-slate-400">Bungie.net Manifest Synchronization & OAuth Credentials</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* Bungie OAuth 2.0 Credentials (For Live Inventory & Loadouts) */}
          <div className="space-y-4 p-5 rounded-xl bg-[#0b0e14] border border-[#20293a]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white font-heading">
                  Bungie API & OAuth Credentials
                </h3>
              </div>
              <a
                href="https://www.bungie.net/en/Application"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 font-mono"
              >
                <span>bungie.net/en/Application</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Required for live inventory querying, Vault transfer, and in-game loadout switching. Create a free confidential app on Bungie.net and paste your credentials below:
            </p>

            {/* Redirect URL Helper */}
            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                Redirect URL to put in Bungie.net App:
              </div>
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs text-amber-300 font-mono select-all truncate">
                  {redirectUri}
                </code>
                <button
                  onClick={copyRedirect}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 flex items-center gap-1"
                >
                  {copiedRedirect ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedRedirect ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* API Key */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-mono">Bungie API Key (X-API-Key):</label>
              <input
                type="password"
                placeholder="e.g. 38f7a94b2c1..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            {/* OAuth Client ID */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-mono">OAuth Client ID:</label>
              <input
                type="text"
                placeholder="e.g. 48219"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            {/* OAuth Client Secret */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-mono">OAuth Client Secret:</label>
              <input
                type="password"
                placeholder="e.g. k8F9...2xL"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <button
              onClick={handleSaveSettings}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors"
            >
              {savedSettings ? <Check className="w-4 h-4" /> : null}
              <span>{savedSettings ? 'Saved Credentials!' : 'Save Credentials'}</span>
            </button>
          </div>

          {/* Manifest Status Card */}
          <div className="p-4 rounded-xl bg-[#0b0e14] border border-[#20293a] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 font-heading uppercase tracking-wider">
                Destiny 2 Manifest Status
              </span>
              <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${manifestStatus?.status === 'ready' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {manifestStatus?.status?.toUpperCase() || 'OFFLINE'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              <div className="bg-slate-900/80 p-2 rounded">
                <div className="text-[10px] text-slate-500">Weapons</div>
                <div className="font-bold text-slate-200">{manifestStatus?.weaponsCount?.toLocaleString() || 0}</div>
              </div>
              <div className="bg-slate-900/80 p-2 rounded">
                <div className="text-[10px] text-slate-500">Armor Pieces</div>
                <div className="font-bold text-slate-200">{manifestStatus?.armorCount?.toLocaleString() || 0}</div>
              </div>
              <div className="bg-slate-900/80 p-2 rounded">
                <div className="text-[10px] text-slate-500">Perks & Mods</div>
                <div className="font-bold text-slate-200">{manifestStatus?.perksCount?.toLocaleString() || 0}</div>
              </div>
            </div>

            <div className="text-[11px] font-mono text-slate-400 space-y-1">
              <div>Version: <span className="text-slate-200">{manifestStatus?.version || 'N/A'}</span></div>
              <div>Last Updated: <span className="text-slate-200">{manifestStatus?.lastUpdated ? new Date(manifestStatus.lastUpdated).toLocaleString() : 'N/A'}</span></div>
            </div>

            {/* Trigger Sync Button */}
            <button
              disabled={isSyncing}
              onClick={() => onTriggerSync(true)}
              className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs font-mono transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Synchronizing Manifest...' : 'Re-download & Sync Latest Manifest'}</span>
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900 border-t border-[#20293a] flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
