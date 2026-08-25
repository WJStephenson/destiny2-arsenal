import React from 'react';
import { 
  Crosshair, 
  Shield, 
  Bookmark, 
  Settings, 
  LogIn, 
  Zap, 
  User 
} from 'lucide-react';

export default function Header({ 
  activeTab, 
  setActiveTab, 
  onOpenSettings,
  wishlistCount = 0,
  authSession,
  onLogin
}) {
  const sessionUser = authSession?.session?.user;
  
  // Resolve real Bungie Global Name (e.g. "WJStephenson#1234" or gamer tag)
  const displayName = sessionUser?.bungieGlobalName || 
    sessionUser?.displayName || 
    sessionUser?.bungieNetUser?.uniqueName || 
    sessionUser?.bungieNetUser?.displayName || 
    sessionUser?.destinyMemberships?.[0]?.bungieGlobalDisplayName || 
    sessionUser?.destinyMemberships?.[0]?.displayName || 
    (authSession?.authenticated ? 'Guardian' : null);

  return (
    <header className="sticky top-0 z-40 bg-[#0b0e14]/90 backdrop-blur-md border-b border-[#20293a] px-3 sm:px-4 lg:px-8 py-2.5 sm:py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        
        {/* Left: Signed-in Bungie Account (or Connect Button) */}
        <div className="flex items-center gap-2">
          {authSession?.authenticated ? (
            <button
              onClick={() => setActiveTab('guardian')}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#121722] hover:bg-[#182030] border border-amber-500/30 text-left transition-colors shadow-sm"
              title="Open Guardian"
            >
              <div className="relative">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xs">
                  <User className="w-4 h-4" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#121722] animate-pulse" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-bold text-white font-heading tracking-wide block truncate max-w-[170px] sm:max-w-[240px]">
                  {displayName}
                </span>
              </div>
            </button>
          ) : (
            <button
              onClick={onLogin}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs sm:text-sm font-bold text-amber-300 font-heading tracking-wide transition-colors shadow-sm"
            >
              <LogIn className="w-4 h-4 text-amber-400" />
              <span>Connect Bungie Account</span>
            </button>
          )}
        </div>

        {/* Desktop Tab Navigation (Hidden on mobile) */}
        <nav className="hidden md:flex items-center gap-1 bg-[#121722] p-1 rounded-xl border border-[#20293a]">
          
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
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Guardian</span>
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

        {/* Right: Settings Cog */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-xl bg-[#121722] hover:bg-slate-800 border border-[#20293a] text-slate-400 hover:text-amber-300 transition-colors shadow-sm"
          title="Settings & API Credentials"
        >
          <Settings className="w-4 h-4" />
        </button>

      </div>
    </header>
  );
}
