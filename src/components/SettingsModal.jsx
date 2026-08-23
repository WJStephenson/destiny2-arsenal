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
  Lock,
  Sparkles,
  Globe,
  Info
} from 'lucide-react';
import { getStoredSettings, saveStoredSettings } from '../utils/auth-storage';

export default function SettingsModal({ 
  onClose, 
  manifestStatus, 
  onTriggerSync, 
  isSyncing 
}) {
  const initial = getStoredSettings();
  const [apiKey, setApiKey] = useState(initial.apiKey || '');
  const [clientId, setClientId] = useState(initial.clientId || '');
  const [clientSecret, setClientSecret] = useState(initial.clientSecret || '');
  const [savedSettings, setSavedSettings] = useState(false);
  const [copiedRedirect, setCopiedRedirect] = useState(false);
  const [copiedOrigin, setCopiedOrigin] = useState(false);

  const originUrl = window.location.origin;
  const redirectUri = `${window.location.origin}/oauth/callback`;

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data) {
          if (data.apiKey && !apiKey) setApiKey(data.apiKey);
          if (data.clientId && !clientId) setClientId(data.clientId);
          if (data.clientSecret && !clientSecret) setClientSecret(data.clientSecret);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveSettings = () => {
    saveStoredSettings({ apiKey: apiKey.trim(), clientId: clientId.trim(), clientSecret: clientSecret.trim() });
    setSavedSettings(true);
    setTimeout(() => setSavedSettings(false), 2500);
  };

  const copyRedirect = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopiedRedirect(true);
    setTimeout(() => setCopiedRedirect(false), 2000);
  };

  const copyOrigin = () => {
    navigator.clipboard.writeText(originUrl);
    setCopiedOrigin(true);
    setTimeout(() => setCopiedOrigin(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      
      {/* Mobile Bottom Sheet / Desktop Centered Dialog */}
      <div className="relative w-full max-w-xl bg-[#121722] border-t sm:border border-[#28354d] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] sm:max-h-[90vh] flex flex-col">
        
        {/* Mobile Pull Handle */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-600/70 rounded-full mx-auto my-2.5 flex-shrink-0" />

        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 border-b border-[#20293a] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <Database className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white font-heading">Settings & API Credentials</h2>
              <p className="text-xs text-slate-400">Bungie.net Manifest & OAuth Configuration</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          
          {/* Bungie OAuth 2.0 Credentials (Persistent!) */}
          <div className="space-y-4 p-4 rounded-xl bg-[#0b0e14] border border-[#20293a]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs sm:text-sm font-bold text-white font-heading">
                  Bungie API & OAuth Credentials
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                Persistent
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Create a free application at{' '}
              <a 
                href="https://www.bungie.net/en/Application" 
                target="_blank" 
                rel="noreferrer"
                className="text-amber-400 hover:underline font-mono inline-flex items-center gap-0.5"
              >
                bungie.net/en/Application <ExternalLink className="w-3 h-3" />
              </a>{' '}
              with OAuth Client Type set to <strong>Confidential</strong>.
            </p>

            {/* Input Fields */}
            <div className="space-y-3 font-mono text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 block font-semibold">Bungie API Key (X-API-Key):</label>
                <input
                  type="password"
                  placeholder="e.g. 1a2b3c4d5e6f..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 block font-semibold">OAuth Client ID:</label>
                <input
                  type="text"
                  placeholder="e.g. 12345"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 block font-semibold">OAuth Client Secret:</label>
                <input
                  type="password"
                  placeholder="e.g. 9z8y7x6w..."
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Helper Copy Box for OAuth Redirect */}
            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5 text-xs font-mono">
              <div className="text-slate-400 text-[11px]">Redirect URL to put in Bungie App Portal:</div>
              <div className="flex items-center justify-between gap-2 bg-black/60 p-2 rounded border border-slate-800">
                <span className="text-amber-300 text-[11px] truncate">{redirectUri}</span>
                <button
                  onClick={copyRedirect}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded flex items-center gap-1 text-[11px] flex-shrink-0"
                >
                  {copiedRedirect ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedRedirect ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveSettings}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold font-heading text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-colors"
            >
              {savedSettings ? <Check className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
              <span>{savedSettings ? 'Credentials Saved!' : 'Save & Persist Credentials'}</span>
            </button>
          </div>

          {/* Local Manifest Status */}
          <div className="space-y-3 p-4 rounded-xl bg-[#0b0e14] border border-[#20293a]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold text-white font-heading">
                Client Manifest & Caching
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                Offline Ready
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Total Weapons</span>
                <span className="text-sm font-bold text-white">1,029</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Total Armour</span>
                <span className="text-sm font-bold text-white">1,071</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
