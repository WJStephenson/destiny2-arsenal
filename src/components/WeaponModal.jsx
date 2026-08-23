import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Copy, 
  Check, 
  Bookmark, 
  Scale, 
  Hammer, 
  Flame, 
  Zap, 
  Moon, 
  Snowflake, 
  Wind, 
  CircleDot, 
  Info, 
  MapPin, 
  Award,
  ShieldAlert
} from 'lucide-react';
import { getDamageInfo, getTierInfo, getSourceCategoryBadge, generateDimQuery } from '../utils/destiny-helpers';
import LongPressable from './LongPressable';

export default function WeaponModal({ 
  weapon, 
  onClose, 
  onAddToCompare, 
  isCompared, 
  onSaveWishlist,
  onOpenInfo 
}) {
  if (!weapon) return null;

  const tierInfo = getTierInfo(weapon.tierTypeName);
  const damageInfo = getDamageInfo(weapon.damageType);
  const sourceBadge = getSourceCategoryBadge(weapon.sourceCategory);

  const [selectedPlugs, setSelectedPlugs] = useState({});
  const [copiedDim, setCopiedDim] = useState(false);

  const togglePlugSelection = (colIdx, perk) => {
    setSelectedPlugs(prev => {
      const next = { ...prev };
      if (next[colIdx]?.hash === perk.hash) {
        delete next[colIdx];
      } else {
        next[colIdx] = perk;
      }
      return next;
    });
  };

  const selectedPerkNames = Object.values(selectedPlugs).map(p => p.name);

  const copyDim = () => {
    const perksToInclude = selectedPerkNames.length > 0 ? selectedPerkNames : [];
    const query = generateDimQuery(weapon, perksToInclude);
    navigator.clipboard.writeText(query);
    setCopiedDim(true);
    setTimeout(() => setCopiedDim(false), 2000);
  };

  const handleSaveToWishlist = () => {
    onSaveWishlist({
      id: `wish_${weapon.id || weapon.hash}_${Date.now()}`,
      weaponId: weapon.id || weapon.hash,
      name: weapon.name,
      icon: weapon.icon,
      weaponType: weapon.weaponType,
      damageType: weapon.damageType,
      tierTypeName: weapon.tierTypeName,
      selectedPerks: selectedPerkNames,
      notes: `Source: ${weapon.sourceString || 'Destiny 2'}`,
      savedAt: new Date().toISOString()
    });
  };

  // Check if weapon has active rolled perks from live Guardian inventory
  const livePerks = weapon.perks && weapon.perks.length > 0 ? weapon.perks : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#121722] border border-[#28354d] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-fadeIn">
        
        {/* Top Header Card with Screenshot / Gradient Background */}
        <div className="relative bg-slate-900 overflow-hidden flex-shrink-0 border-b border-[#20293a]">
          {weapon.screenshot && (
            <img 
              src={weapon.screenshot} 
              alt="" 
              className="absolute inset-0 w-full h-full object-cover opacity-40 pointer-events-none" 
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#121722] via-[#121722]/80 to-black/40 pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-2 rounded-full bg-black/70 hover:bg-black/90 text-slate-300 hover:text-white border border-white/10 transition-colors z-20"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Weapon Identity Info */}
          <div className="relative z-10 p-4 sm:p-6 space-y-3">
            
            {/* Top Badges Row */}
            <div className="flex items-center gap-1.5 flex-wrap pr-10">
              <span className={`text-[10px] sm:text-xs font-mono px-2 py-0.5 rounded font-bold uppercase ${tierInfo.bg} ${tierInfo.text}`}>
                {weapon.tierTypeName || 'Legendary'}
              </span>
              
              {weapon.damageType && (
                <LongPressable
                  onClick={() => onOpenInfo?.({ name: weapon.damageType, type: 'element' })}
                  onLongPress={() => onOpenInfo?.({ name: weapon.damageType, type: 'element' })}
                  className={`text-[10px] sm:text-xs font-mono px-2 py-0.5 rounded font-bold cursor-pointer ${damageInfo.bg} ${damageInfo.text}`}
                >
                  {weapon.damageType}
                </LongPressable>
              )}

              {weapon.slot && (
                <span className="text-[10px] sm:text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {weapon.slot} Slot
                </span>
              )}

              {weapon.ammoType && (
                <span className="text-[10px] sm:text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {weapon.ammoType} Ammo
                </span>
              )}

              {weapon.isCraftable && (
                <span className="text-[10px] sm:text-xs font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1 font-bold">
                  <Hammer className="w-3 h-3" /> Craftable
                </span>
              )}
            </div>

            {/* Title & Icon Main Block */}
            <div className="flex items-start sm:items-center gap-4">
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-black/70 border-2 border-white/20 overflow-hidden flex-shrink-0 shadow-2xl">
                {weapon.icon ? (
                  <img src={weapon.icon} alt={weapon.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600 font-bold font-mono">D2</div>
                )}
                {weapon.iconWatermark && (
                  <img src={weapon.iconWatermark} alt="" className="absolute inset-0 w-full h-full pointer-events-none opacity-80" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-wide font-heading leading-snug">
                  {weapon.name}
                </h2>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-300 mt-0.5">
                  <span>{weapon.itemTypeDisplayName || weapon.weaponType}</span>
                  {weapon.power && (
                    <span className="text-amber-400 font-mono font-bold">
                      ✧ {weapon.power} Power
                    </span>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* SECTION 1: LIVE ROLLED PERKS ON YOUR WEAPON (If inspecting Guardian item) */}
          {livePerks.length > 0 && (
            <div className="p-4 rounded-xl bg-[#0e131e] border-2 border-amber-500/40 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-bold text-amber-300 uppercase tracking-wider font-heading flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Your Weapon's Active Rolled Perks
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">Tap for perk info</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {livePerks.map((p, pIdx) => {
                  const pObj = typeof p === 'object' ? p : { name: p };
                  return (
                    <LongPressable
                      key={pIdx}
                      onClick={() => onOpenInfo?.({ ...pObj, type: 'perk' })}
                      onLongPress={() => onOpenInfo?.({ ...pObj, type: 'perk' })}
                      className="flex items-center gap-2 p-2 px-3 rounded-lg bg-black/60 border border-slate-700/80 hover:border-amber-400 transition-all cursor-pointer shadow-sm group"
                    >
                      {pObj.icon ? (
                        <img src={pObj.icon} alt="" className="w-6 h-6 rounded object-cover" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-amber-400" />
                      )}
                      <span className="text-xs font-mono text-slate-200 font-bold group-hover:text-amber-300">
                        {pObj.name}
                      </span>
                      {pObj.isEnhanced && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-900/60 text-amber-300 font-mono border border-amber-500/40">
                          Enhanced
                        </span>
                      )}
                    </LongPressable>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 2: HOW TO ACQUIRE BANNER */}
          {weapon.sourceString && (
            <LongPressable
              onClick={() => onOpenInfo?.({
                name: weapon.sourceString,
                category: 'Acquisition Source',
                description: `How to acquire: ${weapon.sourceString}`,
                type: 'source'
              })}
              onLongPress={() => onOpenInfo?.({
                name: weapon.sourceString,
                category: 'Acquisition Source',
                description: `How to acquire: ${weapon.sourceString}`,
                type: 'source'
              })}
              className={`p-4 rounded-xl border flex items-start gap-3.5 shadow-lg w-full ${sourceBadge.bg} ${sourceBadge.border}`}
            >
              <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center flex-shrink-0 text-xl">
                {sourceBadge.icon}
              </div>
              <div className="space-y-1 flex-1 text-left">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-mono font-bold uppercase tracking-wider ${sourceBadge.text}`}>
                    How to Acquire • {weapon.sourceCategory}
                  </span>
                  {weapon.isCraftable && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                      Craftable Pattern
                    </span>
                  )}
                </div>
                <h4 className="text-sm sm:text-base font-bold text-white font-heading tracking-wide">
                  {weapon.sourceString}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {weapon.tierTypeName === 'Exotic' 
                    ? 'Can be unlocked from its dedicated quest, exotic mission, or Monument to Lost Lights in the Tower.'
                    : weapon.isCraftable 
                      ? 'Drop chances exist from encounter chests, secret chests, and weekly red border vendor focusing.'
                      : 'Obtainable from activity completions, rank-up reputation engrams, and targeted vendor focusing.'}
                </p>
              </div>
            </LongPressable>
          )}

          {/* Flavor Lore Text */}
          {weapon.flavorText && (
            <p className="text-xs sm:text-sm italic text-slate-400 border-l-2 border-amber-500/50 pl-3 py-1">
              "{weapon.flavorText}"
            </p>
          )}

          {/* Intrinsic Frame Box */}
          {weapon.intrinsic && (
            <LongPressable
              onClick={() => onOpenInfo?.({
                name: weapon.intrinsic.name,
                category: 'Intrinsic Frame Archetype',
                description: weapon.intrinsic.description,
                icon: weapon.intrinsic.icon,
                type: 'intrinsic'
              })}
              onLongPress={() => onOpenInfo?.({
                name: weapon.intrinsic.name,
                category: 'Intrinsic Frame Archetype',
                description: weapon.intrinsic.description,
                icon: weapon.intrinsic.icon,
                type: 'intrinsic'
              })}
              className="p-3.5 rounded-xl bg-[#0b0e14] border border-amber-500/30 flex items-start gap-3 w-full text-left cursor-pointer hover:border-amber-400 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-amber-300 font-heading tracking-wide">
                    {weapon.intrinsic.name}
                  </h4>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                    Intrinsic Frame
                  </span>
                </div>
                {weapon.intrinsic.description && (
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {weapon.intrinsic.description}
                  </p>
                )}
              </div>
            </LongPressable>
          )}

          {/* SECTION 3: ALL POSSIBLE PERK ROLL MATRIX (Armory Pool) */}
          {weapon.socketColumns && weapon.socketColumns.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <h3 className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider font-heading flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  All Possible Perk Rolls (Armory Matrix)
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  Tap to assemble roll • Hold for details
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {weapon.socketColumns.map((col, cIdx) => (
                  <div key={cIdx} className="bg-[#0b0e14] border border-[#20293a] rounded-xl p-3 space-y-2">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-[#20293a] pb-1 flex justify-between items-center">
                      <span>{col.type}</span>
                      <span className="text-[10px] text-slate-600">({col.perks?.length || 0})</span>
                    </div>

                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {(col.perks || []).map((p) => {
                        const isSelected = selectedPlugs[cIdx]?.hash === p.hash;
                        return (
                          <LongPressable
                            key={p.hash || p.name}
                            onClick={() => togglePlugSelection(cIdx, p)}
                            onLongPress={() => onOpenInfo?.({
                              name: p.name,
                              category: p.category || 'Perk',
                              description: p.description,
                              icon: p.icon,
                              stats: p.stats,
                              isEnhanced: p.isEnhanced,
                              type: 'perk'
                            })}
                            className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium cursor-pointer transition-all w-full ${
                              isSelected
                                ? 'bg-amber-500 text-black font-bold ring-1 ring-amber-400 shadow-md shadow-amber-500/20'
                                : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
                            }`}
                          >
                            {p.icon ? (
                              <img src={p.icon} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0" />
                            ) : (
                              <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
                            )}
                            <span className="truncate flex-1 text-left">{p.name}</span>
                            {p.isEnhanced && (
                              <span className="text-[9px] px-1 rounded bg-amber-900/60 text-amber-300 font-mono">
                                Enhanced
                              </span>
                            )}
                          </LongPressable>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 4: WEAPON STATS SHEET */}
          {weapon.statsList && weapon.statsList.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <h3 className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider font-heading">
                  Base Weapon Statistics
                </h3>
                <span className="text-[11px] text-slate-500 font-mono">
                  Hold stat for scaling info
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 bg-[#0b0e14] border border-[#20293a] rounded-xl p-4">
                {weapon.statsList.map((s) => {
                  const pct = Math.min(100, Math.max(0, (s.value / (s.max || 100)) * 100));
                  return (
                    <LongPressable
                      key={s.hash || s.name}
                      onClick={() => onOpenInfo?.({ name: s.name, type: 'stat' })}
                      onLongPress={() => onOpenInfo?.({ name: s.name, type: 'stat' })}
                      className="space-y-1 text-xs block cursor-pointer group p-1 rounded hover:bg-slate-900/50"
                    >
                      <div className="flex justify-between items-center font-mono">
                        <span className="text-slate-400 group-hover:text-amber-300 transition-colors flex items-center gap-1">
                          {s.name} <Info className="w-3 h-3 opacity-0 group-hover:opacity-60" />
                        </span>
                        <span className="text-slate-100 font-bold">{s.value}</span>
                      </div>
                      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </LongPressable>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-[#0b0e14] border-t border-[#20293a] flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          <div className="text-xs text-slate-400 font-mono truncate w-full sm:w-auto text-center sm:text-left">
            {selectedPerkNames.length > 0 ? (
              <span className="text-amber-400">
                Selected: {selectedPerkNames.join(' • ')}
              </span>
            ) : (
              <span>Select perks to copy DIM query or save wishlist</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={copyDim}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors shadow-sm"
            >
              {copiedDim ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedDim ? 'Copied DIM!' : 'Copy DIM Search'}</span>
            </button>

            <button
              onClick={() => onAddToCompare(weapon)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                isCompared 
                  ? 'bg-emerald-500 text-black font-bold border-emerald-400' 
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
              }`}
            >
              <Scale className="w-4 h-4" />
            </button>

            <button
              onClick={handleSaveToWishlist}
              className="px-3 py-2 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/40 text-xs font-medium text-pink-300 transition-colors"
              title="Save to Wishlist"
            >
              <Bookmark className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
