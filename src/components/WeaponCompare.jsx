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
  CircleDot,
  Crown,
  ChevronRight
} from 'lucide-react';
import { getDamageInfo, getTierInfo } from '../utils/destiny-helpers';
import LongPressable from './LongPressable';

export default function WeaponCompare({ 
  compareList, 
  onRemoveFromCompare, 
  onClearCompare, 
  onSelectWeapon,
  onOpenInfo
}) {
  if (!compareList || compareList.length === 0) {
    return (
      <div className="p-10 sm:p-16 text-center bg-[#121722] border border-[#20293a] rounded-2xl max-w-xl mx-auto space-y-4 shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400">
          <Scale className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white font-heading">Comparison Lab is Empty</h2>
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
          Add 2 to 4 weapons by tapping the <span className="text-amber-400 font-bold">Compare (⚖️)</span> icon on any weapon card to inspect their stats and perks side-by-side.
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

  // Extract stat value helper
  const getStat = (w, key) => {
    if (w.stats?.[key] !== undefined) return w.stats[key];
    if (w.statsList) {
      const match = w.statsList.find(s => s.name?.toLowerCase() === key.toLowerCase());
      if (match) return match.value;
    }
    return 0;
  };

  // Find max value in compare list for each stat to highlight the winner
  const maxStats = {};
  statKeys.forEach(key => {
    let max = -Infinity;
    compareList.forEach(w => {
      const val = getStat(w, key);
      if (val > max) max = val;
    });
    maxStats[key] = max;
  });

  return (
    <div className="space-y-4 sm:space-y-6 animate-fadeIn pb-6">
      
      {/* Top Header Bar */}
      <div className="flex items-center justify-between bg-[#121722] border border-[#20293a] rounded-2xl p-3.5 sm:p-4 shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white font-heading">
              Comparing {compareList.length} Weapon{compareList.length === 1 ? '' : 's'}
            </h2>
          </div>
        </div>

        <button
          onClick={onClearCompare}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-mono transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear All</span>
        </button>
      </div>

      {/* Side-by-Side Comparison Matrix */}
      <div className="bg-[#121722] border border-[#20293a] rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-left border-collapse min-w-[540px]">
            
            {/* Table Header: Weapon Cards */}
            <thead>
              <tr className="border-b border-[#20293a] bg-[#0b0e14]">
                <th className="p-3 text-xs font-heading font-bold text-slate-400 uppercase w-32 min-w-[120px]">
                  Stats Matrix
                </th>
                {compareList.map(w => {
                  const tier = getTierInfo(w.tierTypeName);
                  const dmg = getDamageInfo(w.damageType);
                  return (
                    <th key={w.id || w.hash} className="p-3 min-w-[170px] max-w-[220px]">
                      <div className="relative p-2.5 rounded-xl bg-[#121722] border border-slate-800 space-y-2 group shadow-md">
                        
                        {/* Remove Button */}
                        <button
                          onClick={() => onRemoveFromCompare(w.id || w.hash)}
                          className="absolute top-2 right-2 p-1 rounded-md bg-black/60 hover:bg-rose-500/30 text-slate-400 hover:text-rose-300 border border-white/10 transition-colors"
                          title="Remove weapon"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>

                        <div 
                          onClick={() => onSelectWeapon(w)}
                          className="flex items-start gap-2 cursor-pointer"
                        >
                          <div className="w-10 h-10 rounded-lg bg-black/60 border border-white/10 overflow-hidden flex-shrink-0">
                            {w.icon && <img src={w.icon} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div className="min-w-0 flex-1 pr-4">
                            <span className={`text-[9px] font-mono font-bold uppercase block ${tier.text}`}>
                              {w.tierTypeName}
                            </span>
                            <h4 className="text-xs font-bold text-white truncate group-hover:text-amber-300 font-heading">
                              {w.name}
                            </h4>
                            <span className={`text-[10px] font-mono ${dmg.text} truncate block`}>
                              {w.damageType} • {w.weaponType}
                            </span>
                          </div>
                        </div>

                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Body: Stats Comparison */}
            <tbody className="divide-y divide-[#20293a]/60 text-xs font-mono">
              {statKeys.map(statKey => {
                const maxVal = maxStats[statKey];
                return (
                  <tr key={statKey} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-semibold text-slate-300 whitespace-nowrap bg-[#0d111a]">
                      {statKey}
                    </td>
                    {compareList.map(w => {
                      const val = getStat(w, statKey);
                      const isWinner = val > 0 && val === maxVal && compareList.length > 1;
                      const pct = Math.min(100, Math.max(0, (val / 100) * 100));

                      return (
                        <td key={w.id || w.hash} className="p-3">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className={`font-bold ${isWinner ? 'text-emerald-400 font-extrabold' : 'text-slate-200'}`}>
                                {val || '-'}
                              </span>
                              {isWinner && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold uppercase">
                                  Top
                                </span>
                              )}
                            </div>
                            {val > 0 && !['Rounds Per Minute', 'RPM', 'Charge Time', 'Magazine', 'Draw Time'].includes(statKey) && (
                              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all ${isWinner ? 'bg-emerald-400' : 'bg-amber-400/80'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>

          </table>
        </div>
      </div>

    </div>
  );
}
