import React from 'react';
import { X, Shield, Crown, Sparkles, Award, Layers } from 'lucide-react';
import { getTierInfo } from '../utils/destiny-helpers';
import { STAT_META, normaliseStats } from '../utils/armor-stats';
import LongPressable from './LongPressable';
import ItemTransferControls from './ItemTransferControls';

export default function ArmorModal({ 
  armor, 
  onClose, 
  onOpenInfo,
  profileData,
  onProfileUpdate,
  onShowToast
}) {
  if (!armor) return null;
  const tierInfo = getTierInfo(armor.tierTypeName);

  // Bar colours per stat; the stat list itself comes from the shared model so
  // this modal and the optimizer can never drift apart.
  const STAT_COLOURS = {
    weapons: { text: 'text-sky-400', bar: 'bg-sky-400' },
    health: { text: 'text-emerald-400', bar: 'bg-emerald-400' },
    classAbility: { text: 'text-amber-400', bar: 'bg-amber-400' },
    grenade: { text: 'text-indigo-400', bar: 'bg-indigo-400' },
    superAbility: { text: 'text-purple-400', bar: 'bg-purple-400' },
    melee: { text: 'text-rose-400', bar: 'bg-rose-400' }
  };

  const stats = normaliseStats(armor.armorStats || armor.statsList || armor.stats);
  const statTotal = stats.total;

  // Scale the bars against this piece's own best roll rather than a fixed
  // ceiling -- a single piece's stat has no hard cap, and the old fixed 35
  // made every good roll render as a full bar.
  const barCeiling = Math.max(10, ...STAT_META.map(st => stats[st.key] || 0));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      
      {/* Mobile Bottom Sheet / Desktop Centered Card */}
      <div className="relative w-full max-w-2xl bg-[#121722] border-t sm:border border-[#28354d] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] sm:max-h-[90vh] flex flex-col">
        
        {/* Mobile Pull/Drag Handle */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-600/70 rounded-full mx-auto my-2.5 flex-shrink-0" />

        {/* Header */}
        <div className={`p-4 sm:p-5 ${tierInfo.headerBg} border-b border-[#20293a] relative flex-shrink-0`}>
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-2 rounded-full bg-black/60 hover:bg-black/90 text-slate-300 hover:text-white transition-colors z-10"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-3.5 pr-10">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-black/60 border-2 border-white/20 overflow-hidden flex-shrink-0 shadow-md">
              {armor.icon ? (
                <img src={armor.icon} alt={armor.name} className="w-full h-full object-cover" />
              ) : (
                <Shield className="w-8 h-8 text-slate-500 m-auto" />
              )}
              {armor.isArtifice && (
                <div className="absolute top-0 right-0 w-4 h-4 bg-indigo-500 rounded-bl text-[8px] flex items-center justify-center font-bold text-white">
                  A
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-[10px] sm:text-xs font-mono px-2 py-0.5 rounded font-bold uppercase ${tierInfo.bg} ${tierInfo.text}`}>
                  {armor.tierTypeName}
                </span>
                <span className="text-[10px] sm:text-xs font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold">
                  {armor.classType}
                </span>
                <span className="text-[10px] sm:text-xs font-mono text-slate-400">
                  {armor.armorSlot || armor.itemTypeDisplayName}
                </span>
                {armor.power && (
                  <span className="text-[10px] sm:text-xs font-mono text-amber-400 font-bold">
                    ✧ {armor.power}
                  </span>
                )}
              </div>

              <h2 className="text-lg sm:text-xl font-bold text-white font-heading tracking-wide truncate">
                {armor.name}
              </h2>

              {armor.setName && (
                <div className="flex items-center gap-1.5 text-xs font-mono text-amber-400 truncate">
                  <Layers className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{armor.setName}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          
          {/* Live Inventory & Transfer Controls (If player owns instance(s) of this armor) */}
          {profileData && (
            <ItemTransferControls
              item={armor}
              profileData={profileData}
              onProfileUpdate={onProfileUpdate}
              onShowToast={onShowToast}
            />
          )}

          {/* Flavor Text */}
          {armor.flavorText && (
            <p className="text-xs sm:text-sm italic text-slate-400 border-l-2 border-amber-500/60 pl-3 leading-relaxed">
              "{armor.flavorText}"
            </p>
          )}

          {/* Armor Set Intrinsic Perk (if present) */}
          {armor.setIntrinsicPerk && (
            <div className="p-3 rounded-xl bg-[#0b0e14] border border-amber-500/30 space-y-1">
              <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider block">
                ✧ Set Intrinsic Perk
              </span>
              <p className="text-xs font-mono text-slate-200 leading-relaxed">
                {armor.setIntrinsicPerk}
              </p>
            </div>
          )}

          {/* Exotic Perk Box */}
          {armor.exoticPerk && (
            <div className="p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-300 font-heading text-sm sm:text-base">
                <Crown className="w-4 h-4 text-amber-400" />
                <span>{armor.exoticPerk.name}</span>
                <span className="text-[10px] font-mono text-slate-400 uppercase font-normal">(Exotic Perk)</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                {armor.exoticPerk.description}
              </p>
            </div>
          )}

          {/* Active Rolled Perks / Mods (if on character) */}
          {armor.perks && armor.perks.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-heading">
                Equipped Perks & Mods
              </h3>
              <div className="flex flex-wrap gap-2">
                {armor.perks.map((p, pIdx) => {
                  const pObj = typeof p === 'object' ? p : { name: p };
                  return (
                    <LongPressable
                      key={pIdx}
                      onClick={() => onOpenInfo?.({ ...pObj, type: 'perk' })}
                      onLongPress={() => onOpenInfo?.({ ...pObj, type: 'perk' })}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0b0e14] text-slate-200 text-xs font-mono border border-slate-700/80 hover:border-amber-500/50 cursor-pointer group shadow-sm"
                      title={pObj.name}
                    >
                      {pObj.icon && <img src={pObj.icon} alt="" className="w-4 h-4 rounded" />}
                      <span className="group-hover:text-amber-300">{pObj.name}</span>
                    </LongPressable>
                  );
                })}
              </div>
            </div>
          )}

          {/* Armour stat sheet */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-heading">
                Armour Stat Distribution
              </h3>
              {statTotal > 0 && (
                <span className="text-xs font-mono font-bold text-amber-400">
                  Total: {statTotal}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-[#0b0e14] border border-[#20293a] rounded-xl p-3.5">
              {STAT_META.map((st) => {
                const val = stats[st.key] || 0;
                const colours = STAT_COLOURS[st.key];
                const pct = Math.min(100, Math.max(0, (val / barCeiling) * 100));
                return (
                  <div key={st.key} className="space-y-1 text-xs">
                    <div className="flex justify-between font-mono">
                      <span className={`font-bold ${colours.text}`}>{st.short} • {st.label}</span>
                      <span className="text-white font-bold tabular-nums">{val}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colours.bar}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Source Info */}
          {armor.sourceString && (
            <p className="text-xs text-slate-400 italic">
              Source: {armor.sourceString}
            </p>
          )}

        </div>

      </div>
    </div>
  );
}
