import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Copy, 
  Check, 
  Bookmark, 
  Scale, 
  Hammer, 
  ExternalLink,
  Flame,
  Zap,
  Moon,
  Snowflake,
  Wind,
  CircleDot,
  Info,
  MapPin,
  Trophy,
  Compass
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
  const [hoveredPerk, setHoveredPerk] = useState(null);
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
      id: `wish_${weapon.id}_${Date.now()}`,
      weaponId: weapon.id,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#121722] border border-[#28354d] rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        
        {/* Header Art / Screenshot Banner */}
        <div className="relative h-44 md:h-52 bg-slate-900 overflow-hidden flex-shrink-0">
          {weapon.screenshot ? (
            <img src={weapon.screenshot} alt="" className="w-full h-full object-cover opacity-60" />
          ) : (
            <div className={`w-full h-full ${tierInfo.headerBg}`} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#121722] via-[#121722]/50 to-transparent" />
          
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/60 hover:bg-black/80 text-slate-300 hover:text-white border border-white/10 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header Weapon Info */}
          <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between gap-4">
            <div className="flex items-center gap-4">
              
              {/* Icon */}
              <div className="relative w-20 h-20 rounded-xl bg-black/70 border-2 border-white/20 overflow-hidden flex-shrink-0 shadow-2xl">
                {weapon.icon ? (
                  <img src={weapon.icon} alt={weapon.name} className="w-full h-full object-cover" />
                ) : null}
                {weapon.iconWatermark && (
                  <img src={weapon.iconWatermark} alt="" className="absolute inset-0 w-full h-full pointer-events-none opacity-80" />
                )}
                {weapon.isCraftable && (
                  <div className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-bl" title="Craftable weapon" />
                )}
              </div>

              {/* Title & Badges */}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-mono px-2 py-0.5 rounded font-bold uppercase ${tierInfo.bg} ${tierInfo.text}`}>
                    {weapon.tierTypeName}
                  </span>
                  
                  <LongPressable
                    onLongPress={() => onOpenInfo?.({ name: weapon.damageType, type: 'element' })}
                    className={`text-xs font-mono px-2 py-0.5 rounded font-bold ${damageInfo.bg} ${damageInfo.text}`}
                  >
                    {weapon.damageType}
                  </LongPressable>

                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {weapon.slot} Slot
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {weapon.ammoType} Ammo
                  </span>
                  {weapon.isCraftable && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1 font-bold">
                      <Hammer className="w-3 h-3" /> Craftable
                    </span>
                  )}
                </div>

                <h2 className="text-2xl md:text-3xl font-bold text-white tracking-wide mt-1 font-heading">
                  {weapon.name}
                </h2>
                <p className="text-sm text-slate-300">
                  {weapon.itemTypeDisplayName || weapon.weaponType}
                </p>
              </div>

            </div>

            {/* Quick Actions in Header */}
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={copyDim}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-medium text-slate-200 transition-colors"
                title="Copy DIM search string"
              >
                {copiedDim ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-400" />}
                <span>{copiedDim ? 'Copied DIM!' : 'Copy DIM'}</span>
              </button>

              <button
                onClick={() => onAddToCompare(weapon)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  isCompared 
                    ? 'bg-emerald-500 text-black font-bold border-emerald-400' 
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200'
                }`}
              >
                <Scale className="w-4 h-4" />
                <span>{isCompared ? 'Comparing' : 'Compare'}</span>
              </button>

              <button
                onClick={handleSaveToWishlist}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/40 text-xs font-medium text-pink-300 transition-colors"
              >
                <Bookmark className="w-4 h-4" />
                <span>Wishlist</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* How to Acquire / Source Banner */}
          {weapon.sourceString && (
            <LongPressable
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
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono font-bold uppercase tracking-wider ${sourceBadge.text}`}>
                    How to Acquire • {weapon.sourceCategory}
                  </span>
                  {weapon.isCraftable && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                      5 Deepsight Patterns needed to craft
                    </span>
                  )}
                </div>
                <h4 className="text-base font-bold text-white font-heading tracking-wide">
                  {weapon.sourceString}
                </h4>
                <p className="text-xs text-slate-300">
                  {weapon.tierTypeName === 'Exotic' 
                    ? 'Can be unlocked from its dedicated quest, exotic mission, or Monument to Lost Lights in the Tower.'
                    : weapon.isCraftable 
                      ? 'Drop chances exist from encounter chests, secret chests, and weekly red border vendor focusing.'
                      : 'Obtainable from activity completions, rank-up reputation engrams, and targeted vendor focusing.'}
                </p>
              </div>
            </LongPressable>
          )}

          {/* Flavor Text */}
          {weapon.flavorText && (
            <p className="text-sm italic text-slate-400 border-l-2 border-amber-500/50 pl-3">
              "{weapon.flavorText}"
            </p>
          )}

          {/* Intrinsic Frame Box */}
          {weapon.intrinsic && (
            <LongPressable
              onLongPress={() => onOpenInfo?.({
                name: weapon.intrinsic.name,
                category: 'Intrinsic Frame Archetype',
                description: weapon.intrinsic.description,
                icon: weapon.intrinsic.icon,
                type: 'intrinsic'
              })}
              className="p-3.5 rounded-xl bg-[#0b0e14] border border-amber-500/30 flex items-start gap-3 w-full text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-amber-300 font-heading tracking-wide">
                    {weapon.intrinsic.name}
                  </h4>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                    Intrinsic Frame Archetype
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

          {/* Sockets Matrix (Perk Columns with Long Press!) */}
          {(weapon.socketColumns && weapon.socketColumns.length > 0) ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-heading flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Perk & Trait Roll Matrix
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  Tap to assemble roll • Long press for info
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
          ) : weapon.perks && weapon.perks.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-heading flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Active Rolled Perks on Weapon
              </h3>
              <div className="flex flex-wrap gap-2.5">
                {weapon.perks.map((p, pIdx) => {
                  const pObj = typeof p === 'object' ? p : { name: p };
                  return (
                    <LongPressable
                      key={pIdx}
                      onClick={() => onOpenInfo?.({ ...pObj, type: 'perk' })}
                      onLongPress={() => onOpenInfo?.({ ...pObj, type: 'perk' })}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-[#0b0e14] border border-[#20293a] hover:border-amber-400 transition-all cursor-pointer shadow-sm"
                    >
                      {pObj.icon ? (
                        <img src={pObj.icon} alt="" className="w-6 h-6 rounded object-cover" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-amber-400" />
                      )}
                      <span className="text-xs font-mono text-slate-200 font-bold">{pObj.name}</span>
                    </LongPressable>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Weapon Stats Sheet (Long pressable on any stat bar!) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-heading">
                Base Weapon Statistics
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                Hold stat for mechanics & scaling info
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 bg-[#0b0e14] border border-[#20293a] rounded-xl p-4">
              {weapon.statsList?.map((s) => {
                const pct = Math.min(100, Math.max(0, (s.value / (s.max || 100)) * 100));
                return (
                  <LongPressable
                    key={s.hash}
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

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#0b0e14] border-t border-[#20293a] flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          <div className="text-xs text-slate-400 font-mono">
            {selectedPerkNames.length > 0 ? (
              <span className="text-amber-400">
                Selected Roll: {selectedPerkNames.join(' • ')}
              </span>
            ) : (
              <span>Select perks above to copy exact god roll DIM query</span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={copyDim}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors"
            >
              {copiedDim ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedDim ? 'Copied DIM Query!' : 'Copy DIM Search'}</span>
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
