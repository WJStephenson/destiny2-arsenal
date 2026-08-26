import React from 'react';
import { 
  X, 
  Sparkles, 
  Bookmark, 
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
import { getDamageInfo, getTierInfo, getSourceCategoryBadge, getAcquisitionHint, withoutDuplicateEnhancedPerks, rollColumns } from '../utils/destiny-helpers';
import LongPressable from './LongPressable';
import PerkIcon from './PerkIcon';
import ItemTransferControls from './ItemTransferControls';

/**
 * Column headers have one line at roughly seven characters before they
 * truncate, and the raw names collapse into unreadable stubs there -- two
 * different sockets both render as "PERK CO...". These are the short forms;
 * anything unlisted falls back to its own name.
 */
const COLUMN_LABELS = {
  'Barrel/Sight': 'BARREL',
  'Magazine/Battery': 'MAG',
  'Perk Column 3': 'PERK 1',
  'Perk Column 4': 'PERK 2',
  'Trait': 'TRAIT',
  'Origin Trait': 'ORIGIN'
};

export default function WeaponModal({ 
  weapon, 
  onClose, 
  onSaveWishlist,
  onOpenInfo,
  profileData,
  onProfileUpdate,
  onShowToast
}) {
  if (!weapon) return null;

  const tierInfo = getTierInfo(weapon.tierTypeName);
  const damageInfo = getDamageInfo(weapon.damageType);
  const sourceBadge = getSourceCategoryBadge(weapon.sourceCategory);

  const handleSaveToWishlist = () => {
    onSaveWishlist({
      id: `wish_${weapon.id || weapon.hash}_${Date.now()}`,
      weaponId: weapon.id || weapon.hash,
      name: weapon.name,
      icon: weapon.icon,
      weaponType: weapon.weaponType,
      damageType: weapon.damageType,
      tierTypeName: weapon.tierTypeName,
      selectedPerks: [],
      notes: `Source: ${weapon.sourceString || 'Destiny 2'}`,
      savedAt: new Date().toISOString()
    });
  };

  // Check if weapon has active rolled perks from live Guardian inventory
  const livePerks = weapon.perks && weapon.perks.length > 0 ? weapon.perks : [];

  // Separate discrete stats (RPM, Charge Time, Magazine, Zoom, Draw Time) from 0-100 bar stats
  const discreteStatNames = ['Rounds Per Minute', 'RPM', 'Charge Time', 'Magazine', 'Zoom', 'Draw Time', 'Inventory Size'];
  const allStats = weapon.statsList || [];
  
  const discreteStats = allStats.filter(s => discreteStatNames.includes(s.name));
  const barStats = allStats.filter(s => !discreteStatNames.includes(s.name));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#121722] border-t sm:border border-[#28354d] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] sm:max-h-[90vh] flex flex-col animate-fadeIn">
        
        {/* Mobile Pull/Drag Handle */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-600/70 rounded-full mx-auto my-2.5 flex-shrink-0 z-30" />

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

              {weapon.seasonNumber != null && (
                <span
                  className="text-[10px] sm:text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                  title={weapon.seasonName ? `${weapon.seasonName} (Season ${weapon.seasonNumber})` : `Season ${weapon.seasonNumber}`}
                >
                  S{weapon.seasonNumber}
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
          
          {/* Live Inventory & Transfer Controls (If player owns instance(s) of this weapon) */}
          {profileData && (
            <ItemTransferControls
              item={weapon}
              profileData={profileData}
              onProfileUpdate={onProfileUpdate}
              onShowToast={onShowToast}
            />
          )}

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
                  {getAcquisitionHint(weapon)}
                </p>
              </div>
            </LongPressable>
          )}

          {/* Flavor Lore Text */}
          {weapon.flavorText && (
            <p className="text-xs sm:text-sm italic text-slate-400 border-l-2 border-amber-500/50 pl-3 py-1">
              {weapon.flavorText}
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
                  Tap or hold any perk to inspect
                </span>
              </div>

              {/* Laid out the way the roll actually reads: one column per
                  socket, perks as icons only. The column header stays -- without
                  it the grid has no meaning -- but the perks themselves carry
                  their name in `title` and `alt` rather than on screen, so the
                  matrix stays scannable and a tap opens the full detail. */}
              <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1">
                {rollColumns(weapon.socketColumns).map((col, cIdx) => {
                  // Enhanced twins are dropped here rather than in the data, so
                  // an owned weapon's actual enhanced roll still reads correctly
                  // in the section above.
                  const perks = withoutDuplicateEnhancedPerks(col.perks || []);
                  return (
                  <div key={cIdx} className="flex-1 min-w-[52px] space-y-2">
                    <div
                      className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono text-center truncate border-b border-[#20293a] pb-1"
                      title={`${col.type} (${perks.length})`}
                    >
                      {COLUMN_LABELS[col.type] || col.type}
                    </div>

                    <div className="flex flex-col items-center gap-1.5">
                      {perks.map((p) => {
                        const info = {
                          name: p.name,
                          category: p.category || 'Perk',
                          description: p.description,
                          icon: p.icon,
                          stats: p.stats,
                          isEnhanced: p.isEnhanced,
                          type: 'perk'
                        };
                        return (
                          <LongPressable
                            key={p.hash || p.name}
                            title={p.isEnhanced ? `${p.name} (Enhanced)` : p.name}
                            onClick={() => onOpenInfo?.(info)}
                            onLongPress={() => onOpenInfo?.(info)}
                            className={`relative justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-900/90 border transition-all hover:scale-105 active:scale-95 ${
                              p.isEnhanced
                                ? 'border-amber-500/60 hover:border-amber-400'
                                : 'border-slate-700 hover:border-amber-400'
                            }`}
                          >
                            {/* alt carries the name, so the icon is not a dead
                                end for anyone not using a pointer. */}
                            <PerkIcon perk={p} className="w-7 h-7 sm:w-8 sm:h-8" />
                            {p.isEnhanced && (
                              <span
                                className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-[#121722]"
                                aria-hidden="true"
                              />
                            )}
                          </LongPressable>
                        );
                      })}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 4: WEAPON STATISTICS (Clean, Proportional & Never Overlapping) */}
          {allStats.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <h3 className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider font-heading">
                  Weapon Statistics
                </h3>
                <span className="text-[11px] text-slate-500 font-mono">
                  Tap stat for mechanics & scaling info
                </span>
              </div>

              {/* Discrete Numerical Stats Bar (Magazine, RPM, Charge Time, Zoom) */}
              {discreteStats.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#0b0e14] p-3 rounded-xl border border-[#20293a]">
                  {discreteStats.map((s) => (
                    <LongPressable
                      key={s.hash || s.name}
                      onClick={() => onOpenInfo?.({ name: s.name, type: 'stat' })}
                      onLongPress={() => onOpenInfo?.({ name: s.name, type: 'stat' })}
                      className="p-2 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 text-center cursor-pointer transition-colors border border-slate-800"
                    >
                      <div className="text-[10px] font-mono text-slate-400 uppercase truncate">{s.name}</div>
                      <div className="text-sm sm:text-base font-bold font-mono text-amber-300 mt-0.5">
                        {s.value} {s.name === 'Charge Time' ? 'ms' : s.name === 'Draw Time' ? 'ms' : ''}
                      </div>
                    </LongPressable>
                  ))}
                </div>
              )}

              {/* Scaled Bar Stats (Range, Stability, Handling, Reload, Aim Assist, Airborne, Recoil) */}
              {barStats.length > 0 && (
                <div className="space-y-2.5 bg-[#0b0e14] border border-[#20293a] rounded-xl p-4">
                  {barStats.map((s) => {
                    const pct = Math.min(100, Math.max(0, s.value));
                    return (
                      <LongPressable
                        key={s.hash || s.name}
                        onClick={() => onOpenInfo?.({ name: s.name, type: 'stat' })}
                        onLongPress={() => onOpenInfo?.({ name: s.name, type: 'stat' })}
                        className="flex items-center justify-between gap-3 text-xs group cursor-pointer hover:bg-slate-900/60 p-1.5 rounded-lg transition-colors"
                      >
                        {/* Stat Name */}
                        <span className="w-32 sm:w-44 text-slate-300 font-mono truncate group-hover:text-amber-300 text-left">
                          {s.name}
                        </span>

                        {/* Visual Progress Bar Track */}
                        <div className="flex-1 h-2 bg-slate-800/90 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-300 shadow-sm shadow-amber-500/20"
                            style={{ width: `${pct}%` }}
                          />
                        </div>

                        {/* Stat Value Number */}
                        <span className="w-8 text-right font-mono font-bold text-white group-hover:text-amber-300">
                          {s.value}
                        </span>
                      </LongPressable>
                    );
                  })}
                </div>
              )}

            </div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-[#0b0e14] border-t border-[#20293a] flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveToWishlist}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/40 text-xs font-medium text-pink-300 transition-colors"
            >
              <Bookmark className="w-4 h-4" />
              <span>Wishlist</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
