import React from 'react';
import { 
  X, 
  Sparkles, 
  Filter, 
  HelpCircle, 
  ExternalLink, 
  Layers, 
  TrendingUp, 
  Zap, 
  Check, 
  Tag, 
  MapPin, 
  Info 
} from 'lucide-react';
import { STAT_DESCRIPTIONS, ELEMENT_DESCRIPTIONS } from '../utils/info-catalog';
import { getDamageInfo, getTierInfo, getSourceCategoryBadge } from '../utils/destiny-helpers';
import { getPerkByName, getPerkByHash } from '../utils/client-manifest';
import useBodyScrollLock from '../utils/useBodyScrollLock';

export default function InfoDrawer({ 
  item, 
  onClose, 
  onFilterByPerk, 
  onFilterBySource,
  onFilterByElement 
}) {
  // The page behind stays put while this is open.
  useBodyScrollLock();

  if (!item) return null;

  // Resolve definition from client manifest if perk definition is incomplete
  let perkDef = null;
  if (item.hash) {
    perkDef = getPerkByHash(item.hash);
  }
  if (!perkDef && item.name) {
    perkDef = getPerkByName(item.name);
  }

  let title = perkDef?.name || item.name || 'Information';
  let category = perkDef?.category || perkDef?.itemTypeDisplayName || item.category || (perkDef ? 'Perk Trait' : 'Details');
  let description = perkDef?.description || item.description || '';
  let icon = perkDef?.icon || item.icon || null;
  let stats = (perkDef?.stats && perkDef.stats.length > 0) ? perkDef.stats : (item.stats || []);
  let isEnhanced = perkDef?.isEnhanced || item.isEnhanced || false;
  let tips = item.tips || null;
  let synergies = item.synergies || null;
  let color = item.color || '#f59e0b';

  // If item is a stat name string or matches STAT_DESCRIPTIONS
  if (STAT_DESCRIPTIONS[item.name]) {
    const s = STAT_DESCRIPTIONS[item.name];
    title = s.name;
    category = s.category;
    description = s.description;
    tips = s.tips;
    icon = null;
  }

  // If item is an element name
  const cleanElemName = item.name?.replace(' Damage', '');
  if (ELEMENT_DESCRIPTIONS[cleanElemName]) {
    const el = ELEMENT_DESCRIPTIONS[cleanElemName];
    title = el.name;
    category = el.category;
    description = el.description;
    synergies = el.synergies;
    color = el.color;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-hidden overscroll-none" data-no-swipe>
      
      {/* Background click to dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal / Bottom Sheet Container */}
      <div className="sheet-panel relative w-full sm:max-w-lg bg-[#121722] border-t sm:border border-[#28354d] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 animate-slideUp">
        
        {/* Mobile Drag Indicator Handle */}
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

        {/* Header */}
        <div className="p-5 bg-slate-900/90 border-b border-[#20293a] flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            
            {/* Icon */}
            <div className="w-12 h-12 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-md">
              {icon ? (
                <img src={icon} alt="" className="w-full h-full object-cover" />
              ) : (
                <Sparkles className="w-6 h-6 text-amber-400" />
              )}
            </div>

            {/* Title & Category */}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold uppercase tracking-wider">
                  {category}
                </span>
                {isEnhanced && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-500/40">
                    Enhanced
                  </span>
                )}
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-wide font-heading mt-0.5">
                {title}
              </h3>
            </div>

          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="sheet-scroll p-5 sm:p-6 space-y-4 flex-1">
          
          {/* Main Description */}
          {description ? (
            <div className="p-4 rounded-xl bg-[#0b0e14] border border-[#20293a] text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
              {description}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[#0b0e14] border border-[#20293a] text-xs text-slate-400 italic">
              Destiny 2 perk metadata and socket trait.
            </div>
          )}

          {/* Investment Stats Modifiers */}
          {stats && stats.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 font-heading uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Stat Modifiers
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {stats.map((s, idx) => (
                  <div 
                    key={idx} 
                    className="p-2.5 rounded-lg bg-[#0b0e14] border border-[#20293a] flex items-center justify-between text-xs font-mono"
                  >
                    <span className="text-slate-400">{s.name}</span>
                    <span className={`font-bold ${s.value > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {s.value > 0 ? `+${s.value}` : s.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Synergies / Subclass Keywords */}
          {synergies && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1">
              <span className="font-bold text-amber-300 font-heading uppercase tracking-wide block">
                Subclass & Combat Synergies
              </span>
              <p className="text-slate-300 leading-relaxed">{synergies}</p>
            </div>
          )}

          {/* Tips */}
          {tips && (
            <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/30 text-xs space-y-1">
              <span className="font-bold text-sky-300 font-heading uppercase tracking-wide block">
                Combat Tip
              </span>
              <p className="text-slate-300 leading-relaxed">{tips}</p>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="sheet-safe-bottom p-4 bg-slate-900 border-t border-[#20293a] flex items-center justify-between gap-3 flex-shrink-0">
          {(item.type === 'perk' || perkDef) && onFilterByPerk && (
            <button
              onClick={() => {
                onFilterByPerk(title);
                onClose();
              }}
              className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center justify-center gap-2 font-mono transition-colors"
            >
              <Filter className="w-4 h-4" />
              <span>Filter Weapons with {title}</span>
            </button>
          )}

          {item.type === 'element' && onFilterByElement && (
            <button
              onClick={() => {
                onFilterByElement(cleanElemName);
                onClose();
              }}
              className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center justify-center gap-2 font-mono transition-colors"
            >
              <Filter className="w-4 h-4" />
              <span>Filter {cleanElemName} Weapons</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
