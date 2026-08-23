import React, { useState } from 'react';
import { 
  Bookmark, 
  Trash2, 
  Copy, 
  Check, 
  Download, 
  Upload, 
  Crosshair, 
  Sparkles 
} from 'lucide-react';
import { getDamageInfo, getTierInfo, generateDimQuery } from '../utils/destiny-helpers';

export default function WishlistManager({ 
  wishlists, 
  onRemoveRoll, 
  onSelectWeapon,
  onImportWishlist 
}) {
  const [copiedId, setCopiedId] = useState(null);

  const copyDim = (roll) => {
    const q = generateDimQuery({ name: roll.name, damageType: roll.damageType }, roll.selectedPerks);
    navigator.clipboard.writeText(q);
    setCopiedId(roll.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(wishlists, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", "destiny2_saved_rolls.json");
    dlAnchor.click();
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121722] border border-[#20293a] rounded-xl p-5 shadow-xl">
        <div>
          <h2 className="text-xl font-bold text-white font-heading flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-pink-400" />
            Saved God Rolls & Wishlist ({wishlists.length})
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Store and organize favorite weapon rolls with perk combinations and copy directly to Destiny Item Manager (DIM).
          </p>
        </div>

        {wishlists.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={exportJson}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 font-mono"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>
        )}
      </div>

      {/* Rolls List */}
      {wishlists.length === 0 ? (
        <div className="p-16 text-center bg-[#121722] border border-[#20293a] rounded-2xl max-w-xl mx-auto space-y-3">
          <Bookmark className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-slate-200 font-heading">No saved rolls yet</h3>
          <p className="text-xs text-slate-400">
            Click the bookmark icon on any weapon card or modal to save your desired rolls here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {wishlists.map((roll) => {
            const tierInfo = getTierInfo(roll.tierTypeName);
            const damageInfo = getDamageInfo(roll.damageType);

            return (
              <div
                key={roll.id}
                className="bg-[#121722] border border-[#20293a] rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-lg hover:border-pink-500/40 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 border-b border-[#20293a] pb-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-black/60 border border-white/10 overflow-hidden flex-shrink-0">
                        {roll.icon && <img src={roll.icon} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${tierInfo.bg} ${tierInfo.text}`}>
                            {roll.tierTypeName}
                          </span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${damageInfo.bg} ${damageInfo.text}`}>
                            {roll.damageType}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white font-heading mt-0.5">{roll.name}</h3>
                        <p className="text-xs text-slate-400">{roll.weaponType}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => onRemoveRoll(roll.id)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Selected Perks */}
                  <div className="pt-2 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-400 font-heading uppercase">
                      Target Perks:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {roll.selectedPerks?.map((p, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/40 text-xs font-mono font-medium"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  {roll.notes && (
                    <div className="text-xs text-slate-400 italic pt-2">
                      "{roll.notes}"
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="pt-2 border-t border-[#20293a] flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(roll.savedAt).toLocaleDateString()}
                  </span>

                  <button
                    onClick={() => copyDim(roll)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700 transition-colors"
                  >
                    {copiedId === roll.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === roll.id ? 'Copied DIM!' : 'Copy DIM'}</span>
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
