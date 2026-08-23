import React from 'react';
import { 
  Crosshair, 
  Shield, 
  BookOpen, 
  Scale, 
  Bookmark, 
  Settings, 
  RefreshCw, 
  ExternalLink,
  LogIn,
  UserCheck
} from 'lucide-react';

export default function Header({ 
  activeTab, 
  setActiveTab, 
  manifestStatus, 
  onOpenSettings,
  compareCount = 0,
  wishlistCount = 0,
  authSession,
  onLogin
}) {
  const isManifestReady = manifestStatus?.status === 'ready';

  const displayName = authSession?.session?.user?.bungieNetUser?.displayName || 
    authSession?.session?.user?.destinyMemberships?.[0]?.displayName || null;

  return (
    <header className="sticky top-0 z-40 bg-[#0b0e14]/90 backdrop-blur-md border-b border-[#20293a] px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Brand & Manifest Indicator */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold font-heading text-lg shadow-sm shadow-amber-500/20">
            ⬡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-wide font-heading">
                DESTINY 2 ARSENAL
              </h1>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono border border-amber-500/40">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
              <span className={`w-1.5 h-1.5 rounded-full ${isManifestReady ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
              <span>{isManifestReady ? `${manifestStatus?.weaponsCount || 1392} weapons live` : 'Syncing database...'}</span>
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex items-center gap-1 bg-[#121722] p-1 rounded-xl border border-[#20293a]">
          
          <button
            onClick={() => setActiveTab('weapons')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-heading tracking-wide transition-all ${
              activeTab === 'weapons'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Weapons</span>
          </button>

          <button
            onClick={() => setActiveTab('armor')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-heading tracking-wide transition-all ${
              activeTab === 'armor'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Armor</span>
          </button>

          <button
            onClick={() => setActiveTab('guardian')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-heading tracking-wide transition-all ${
              activeTab === 'guardian'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Guardian & Vault</span>
            {authSession?.authenticated && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('perks')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-heading tracking-wide transition-all ${
              activeTab === 'perks'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Perks</span>
          </button>

          <button
            onClick={() => setActiveTab('compare')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-heading tracking-wide transition-all ${
              activeTab === 'compare'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Compare</span>
            {compareCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-900 text-[10px] font-mono font-bold text-amber-400">
                {compareCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('wishlist')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-heading tracking-wide transition-all ${
              activeTab === 'wishlist'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Wishlist</span>
            {wishlistCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-900 text-[10px] font-mono font-bold text-pink-400">
                {wishlistCount}
              </span>
            )}
          </button>

        </nav>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
          
          {/* User / Login Pill */}
          {authSession?.authenticated ? (
            <button
              onClick={() => setActiveTab('guardian')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-mono text-emerald-300 font-bold truncate max-w-[120px]">
                {displayName || 'Connected'}
              </span>
            </button>
          ) : (
            <button
              onClick={onLogin}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-medium text-amber-300 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Connect Bungie</span>
            </button>
          )}

          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg bg-[#121722] hover:bg-slate-800 border border-[#20293a] text-slate-400 hover:text-slate-200 transition-colors"
            title="Settings & Manifest Sync"
          >
            <Settings className="w-4 h-4" />
          </button>

        </div>

      </div>
    </header>
  );
}
