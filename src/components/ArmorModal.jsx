import React from 'react';
import { X, Shield, Crown, Sparkles } from 'lucide-react';
import { getTierInfo } from '../utils/destiny-helpers';

export default function ArmorModal({ armor, onClose }) {
  if (!armor) return null;
  const tierInfo = getTierInfo(armor.tierTypeName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#121722] border border-[#28354d] rounded-2xl shadow-2xl overflow-hidden my-8 flex flex-col">
        
        {/* Header */}
        <div className={`p-6 ${tierInfo.headerBg} border-b border-[#20293a]`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/60 hover:bg-black/80 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl bg-black/60 border-2 border-white/20 overflow-hidden flex-shrink-0">
              {armor.icon ? (
                <img src={armor.icon} alt={armor.name} className="w-full h-full object-cover" />
              ) : (
                <Shield className="w-8 h-8 text-slate-500 m-auto" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono px-2 py-0.5 rounded font-bold uppercase ${tierInfo.bg} ${tierInfo.text}`}>
                  {armor.tierTypeName}
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  {armor.classType}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {armor.armorSlot}
                </span>
              </div>

              <h2 className="text-2xl font-bold text-white font-heading tracking-wide mt-1">
                {armor.name}
              </h2>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
          {armor.flavorText && (
            <p className="text-sm italic text-slate-400 border-l-2 border-purple-500/50 pl-3">
              "{armor.flavorText}"
            </p>
          )}

          {/* Exotic Perk Box */}
          {armor.exoticPerk && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-300 font-heading text-base">
                <Crown className="w-4 h-4 text-amber-400" />
                <span>{armor.exoticPerk.name}</span>
                <span className="text-xs font-mono text-slate-400 uppercase font-normal">(Exotic Intrinsic Armor Perk)</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed">
                {armor.exoticPerk.description}
              </p>
            </div>
          )}

          {/* Stats Sheet */}
          {armor.stats && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-heading">
                Base Stat Roll Distribution
              </h3>

              <div className="grid grid-cols-2 gap-3 bg-[#0b0e14] border border-[#20293a] rounded-xl p-4">
                {['Mobility', 'Resilience', 'Recovery', 'Discipline', 'Intellect', 'Strength'].map((stat) => {
                  const val = armor.stats[stat] || 0;
                  const pct = Math.min(100, Math.max(0, (val / 30) * 100));
                  return (
                    <div key={stat} className="space-y-1 text-xs">
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-400">{stat}</span>
                        <span className="text-slate-100 font-bold">{val}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-purple-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {armor.stats.Total > 0 && (
                <div className="p-3 bg-[#0b0e14] border border-[#20293a] rounded-xl flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Total Base Stat Points:</span>
                  <span className="text-lg font-bold text-purple-300">{armor.stats.Total}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#0b0e14] border-t border-[#20293a] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
