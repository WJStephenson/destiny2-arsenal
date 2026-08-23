import React from 'react';
import { 
  Scale, 
  X, 
  Trash2, 
  Sparkles, 
  Crosshair, 
  Copy, 
  Check, 
  Flame, 
  Zap, 
  Moon, 
  Snowflake, 
  Wind, 
  CircleDot 
} from 'lucide-react';
import { getDamageInfo, getTierInfo, generateDimQuery } from '../utils/destiny-helpers';

export default function WeaponCompare({ 
  compareList, 
  onRemoveFromCompare, 
  onClearCompare, 
  onSelectWeapon 
}) {
  if (!compareList || compareList.length === 0) {
    return (
      <div className="p-16 text-center bg-[#121722] border border-[#20293a] rounded-2xl max-w-xl mx-auto space-y-4">
        <Scale className="w-16 h-16 text-slate-600 mx-auto" />
        <h2 className="text-xl font-bold text-slate-200 font-heading">Weapon Comparison Lab is Empty</h2>
        <p className="text-sm text-slate-400">
          Add 2 to 4 weapons by clicking the <span className="text-emerald-400 font-bold">Compare (⚖️)</span> icon on any weapon card in the weapon browser.
        </p>
      </div>
    );
  }

  // All compared stats
  const statKeys = [
    'Impact',
    'Range',
    'Stability',
    'Handling',
    'Reload Speed',
    'Aim Assistance',
    'Zoom',
    'Airborne Effectiveness',
    'Rounds Per Minute',
    'Magazine',
    'Recoil Direction',
    'Blast Radius',
    'Velocity',
    'Charge Time',
    'Draw Time'
  ];

  // Find max value in compare list for each stat to highlight the highest
  const maxStats = {};
  statKeys.forEach(key => {
    let max = -Infinity;
    compareList.forEach(w => {
      const val = w.stats?.[key];
      if (val !== undefined && val > max) max = val;
    });
    maxStats[key] = max;
  });

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex items-center justify-between bg-[#121722] border border-[#20293a] rounded-xl p-4">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-white font-heading">
            Comparing {compareList.length} Weapon{compareList.length === 1 ? '' : 's'}
          </h2>
        </div>

        <button
          onClick={onClearCompare}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-lg text-xs font-mono transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear All</span>
        </button>
      </div>

      {/* Comparison Grid */}
      <div className={`grid grid-cols-1 md:grid-cols-${Math.min(4, compareList.length)} gap-4`}>
        {compareList.map((w) => {
          const tierInfo = getTierInfo(w.tierTypeName);
          const damageInfo = getDamageInfo(w.damageType);

          return (
            <div 
              key={w.id} 
              className="bg-[#121722] border border-[#20293a] rounded-xl overflow-hidden flex flex-col space-y-4 p-4 shadow-xl"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2 border-b border-[#20293a] pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-lg bg-black/60 border border-white/10 overflow-hidden flex-shrink-0">
                    {w.icon && <img src={w.icon} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${tierInfo.bg} ${tierInfo.text}`}>
                        {w.tierTypeName}
                      </span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${damageInfo.bg} ${damageInfo.text}`}>
                        {w.damageType}
                      </span>
                    </div>
                    <h3 
                      onClick={() => onSelectWeapon(w)}
                      className="text-base font-bold text-white font-heading hover:text-amber-400 cursor-pointer mt-0.5"
                    >
                      {w.name}
                    </h3>
                    <p className="text-xs text-slate-400">{w.itemTypeDisplayName || w.weaponType}</p>
                  </div>
                </div>

                <button
                  onClick={() => onRemoveFromCompare(w.id)}
                  className="p-1 rounded bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Intrinsic Frame */}
              {w.intrinsic && (
                <div className="p-2.5 rounded-lg bg-[#0b0e14] border border-[#20293a] text-xs">
                  <span className="font-bold text-amber-300 font-heading block">{w.intrinsic.name}</span>
                  <span className="text-[11px] text-slate-400 line-clamp-2">{w.intrinsic.description}</span>
                </div>
              )}

              {/* Stats Comparison */}
              <div className="space-y-2 bg-[#0b0e14] p-3 rounded-xl border border-[#20293a]">
                <div className="text-[11px] font-bold text-slate-400 font-heading uppercase tracking-wider">
                  Comparative Stats
                </div>

                {statKeys.filter(k => w.stats?.[k] !== undefined).map((key) => {
                  const val = w.stats[key];
                  const isWinner = compareList.length > 1 && val === maxStats[key] && maxStats[key] > 0;
                  const pct = Math.min(100, Math.max(0, (val / 100) * 100));

                  return (
                    <div key={key} className="space-y-0.5 text-xs font-mono">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">{key}</span>
                        <span className={`font-bold ${isWinner ? 'text-emerald-400' : 'text-slate-200'}`}>
                          {val} {isWinner && '★'}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            isWinner ? 'bg-emerald-400' : 'bg-slate-600'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Perk Columns Preview */}
              <div className="space-y-2 pt-2 border-t border-[#20293a]">
                <div className="text-[11px] font-bold text-slate-400 font-heading uppercase tracking-wider">
                  Roll Columns
                </div>
                {w.socketColumns?.filter(c => ['Perk Column 3', 'Perk Column 4'].includes(c.type)).map((col, idx) => (
                  <div key={idx} className="text-xs space-y-1">
                    <span className="text-[10px] text-slate-500 font-mono">{col.type}:</span>
                    <div className="flex flex-wrap gap-1">
                      {col.perks.slice(0, 6).map(p => (
                        <span key={p.hash} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-mono">
                          {p.name}
                        </span>
                      ))}
                      {col.perks.length > 6 && (
                        <span className="text-[10px] text-slate-500 font-mono">+{col.perks.length - 6}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
