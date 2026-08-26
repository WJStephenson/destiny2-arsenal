import React from 'react';
import { 
  Crosshair, 
  Shield, 
  Bookmark, 
  Zap 
} from 'lucide-react';

export default function MobileBottomNav({ 
  activeTab, 
  setActiveTab, 
  wishlistCount = 0,
  authSession 
}) {
  const tabs = [
    { id: 'guardian', label: 'Guardian', icon: Zap, isLive: authSession?.authenticated },
    { id: 'weapons', label: 'Weapons', icon: Crosshair },
    { id: 'armor', label: 'Armor', icon: Shield },
    { id: 'wishlist', label: 'Saved', icon: Bookmark, count: wishlistCount }
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0b0e14]/95 backdrop-blur-lg border-t border-[#20293a] pb-[var(--sab)] px-2 py-1.5 shadow-2xl">
      <div className="flex items-center justify-around">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;

          return (
            <button
              key={t.id}
              onClick={() => {
                if (navigator.vibrate) {
                  try { navigator.vibrate(15); } catch (e) {}
                }
                setActiveTab(t.id);
              }}
              className={`relative flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-150 min-w-[50px] ${
                isActive 
                  ? 'text-amber-400 font-bold' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {/* Active Glow Pill */}
              {isActive && (
                <div className="absolute -top-1.5 w-6 h-1 bg-amber-400 rounded-full shadow-sm shadow-amber-400/80" />
              )}

              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 text-amber-400' : ''}`} />
                
                {/* Live Connected Dot */}
                {t.isLive && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#0b0e14] animate-pulse" />
                )}

                {/* Badge Count */}
                {t.count > 0 && (
                  <span className="absolute -top-1.5 -right-2 px-1 rounded-full bg-amber-500 text-black text-[9px] font-mono font-bold">
                    {t.count}
                  </span>
                )}
              </div>

              <span className="text-[10px] font-mono tracking-tight mt-0.5">
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
