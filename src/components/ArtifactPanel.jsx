import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Check, Lock, Sparkles, RotateCcw, Info } from 'lucide-react';
import { getDefinition, displayOf, batchResolveDefinitions } from '../utils/definition-api';
import { batchResolveItemDefinitions } from '../utils/item-definition-cache';
import LongPressable from './LongPressable';

/**
 * The Artifact screen.
 *
 * Bungie exposes an artifact as tiers of mods with an unlock state per mod, and
 * offers no endpoint for unlocking one -- that only happens in game. So this
 * screen reads the live artifact and lets a player mark the mods they mean to
 * run, which is kept here in the browser as a plan next to the real unlocks.
 */

const PLAN_STORAGE_KEY = 'destiny2_arsenal_artifact_plans';

function loadPlans() {
  try {
    const raw = localStorage.getItem(PLAN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function savePlan(artifactHash, itemHashes) {
  const plans = loadPlans();
  plans[artifactHash] = itemHashes;
  try {
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plans));
  } catch (e) {
    console.error('Error saving artifact plan:', e);
  }
  return plans;
}

export default function ArtifactPanel({ artifacts = [], activeCharacterId, onOpenInfo }) {
  const [selectedHash, setSelectedHash] = useState(null);
  const [artifactDefs, setArtifactDefs] = useState({});
  const [modDefs, setModDefs] = useState({});
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState(() => loadPlans());

  // Whichever artifact the Guardian on screen is running, unless the player has
  // picked another one to look at.
  const current = useMemo(() => {
    if (selectedHash) {
      const found = artifacts.find(a => String(a.artifactHash) === String(selectedHash));
      if (found) return found;
    }
    return artifacts.find(a => a.characterId === activeCharacterId) || artifacts[0] || null;
  }, [artifacts, selectedHash, activeCharacterId]);

  // Artifact names and icons, for the selector along the top.
  useEffect(() => {
    const hashes = [...new Set(artifacts.map(a => a.artifactHash).filter(Boolean))];
    if (!hashes.length) return;
    let cancelled = false;

    batchResolveDefinitions('DestinyArtifactDefinition', hashes).then(defs => {
      if (!cancelled) setArtifactDefs(defs);
    });

    return () => { cancelled = true; };
  }, [artifacts]);

  // The mods on the artifact being looked at. These are ordinary inventory
  // items, so they come from the item definitions rather than the artifact's.
  useEffect(() => {
    if (!current) return undefined;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const def = await getDefinition('DestinyArtifactDefinition', current.artifactHash);
      if (cancelled) return;
      if (def) setArtifactDefs(prev => ({ ...prev, [current.artifactHash]: def }));

      const itemHashes = (current.tiers || []).flatMap(tier => (tier.items || []).map(it => it.itemHash));
      const defs = await batchResolveItemDefinitions(itemHashes);
      if (!cancelled) {
        setModDefs(defs);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [current]);

  if (!artifacts.length) {
    return (
      <div className="bg-[#121722] border border-[#20293a] rounded-2xl p-8 text-center space-y-3">
        <Sparkles className="w-8 h-8 text-slate-600 mx-auto" />
        <p className="text-sm text-slate-400">
          No artifact reported for this account yet. It appears once the season's artifact has been
          picked up in game.
        </p>
      </div>
    );
  }

  const artifactDef = current ? artifactDefs[current.artifactHash] : null;
  const artifactDisplay = artifactDef ? displayOf(artifactDef) : { name: 'Seasonal Artifact', icon: null, description: '' };
  const tierTitles = artifactDef?.tiers || [];

  const plan = plans[current?.artifactHash] || [];
  const planSet = new Set(plan);

  const togglePlanned = (itemHash) => {
    const next = planSet.has(itemHash)
      ? plan.filter(h => h !== itemHash)
      : [...plan, itemHash];
    setPlans(savePlan(current.artifactHash, next));
  };

  const clearPlan = () => setPlans(savePlan(current.artifactHash, []));

  const unlockedCount = (current?.tiers || []).reduce(
    (total, tier) => total + (tier.items || []).filter(it => it.isActive).length,
    0
  );

  return (
    <div className="space-y-4">

      {/* Which artifact is being looked at */}
      {artifacts.length > 1 && (
        <div className="bg-[#121722] border border-[#20293a] rounded-2xl p-3 space-y-2">
          <div className="text-[11px] font-heading font-bold uppercase tracking-wider text-slate-400">
            Artifacts on this account
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {artifacts.map(a => {
              const display = artifactDefs[a.artifactHash] ? displayOf(artifactDefs[a.artifactHash]) : null;
              const isCurrent = current?.artifactHash === a.artifactHash && current?.characterId === a.characterId;
              return (
                <button
                  key={`${a.characterId}_${a.artifactHash}`}
                  onClick={() => setSelectedHash(a.artifactHash)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border whitespace-nowrap transition-all ${
                    isCurrent
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                      : 'bg-[#0b0e14] border-[#20293a] text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {display?.icon && (
                    <img src={display.icon} alt="" className="w-6 h-6 rounded object-cover" />
                  )}
                  <span className="text-xs font-mono">
                    {display?.name || `Artifact ${a.artifactHash}`}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">{a.classType}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-[#121722] border border-[#20293a] rounded-2xl p-4 flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-black/60 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {artifactDisplay.icon ? (
            <img src={artifactDisplay.icon} alt="" className="w-full h-full object-cover" />
          ) : (
            <Sparkles className="w-5 h-5 text-amber-400" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-heading font-bold text-white text-lg truncate">{artifactDisplay.name}</h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-slate-400 mt-1">
            <span>{unlockedCount} unlocked</span>
            <span>{current?.pointsUsed ?? 0} points used</span>
            {current?.resetCount ? <span>{current.resetCount} resets</span> : null}
            {plan.length > 0 && <span className="text-amber-400">{plan.length} planned</span>}
          </div>
        </div>

        {plan.length > 0 && (
          <button
            onClick={clearPlan}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono border border-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear plan</span>
          </button>
        )}
      </div>

      {loading && (
        <div className="py-6 flex items-center justify-center gap-2 text-slate-400 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
          <span>Reading artifact perks...</span>
        </div>
      )}

      {/* Tiers */}
      <div className="space-y-4">
        {(current?.tiers || []).map((tier, tierIdx) => {
          const title = tierTitles[tierIdx]?.displayTitle || `Column ${tierIdx + 1}`;

          return (
            <div key={tier.tierHash || tierIdx} className="bg-[#121722] border border-[#1e2638] rounded-2xl overflow-hidden">
              <div className="px-4 py-2 bg-[#0b0e14] border-b border-[#1e2638] flex items-center justify-between">
                <span className="text-xs font-heading font-bold uppercase tracking-wider text-slate-300">
                  {title}
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {tier.isUnlocked ? 'Unlocked' : `${tier.pointsToUnlock ?? 0} points to unlock`}
                </span>
              </div>

              <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {(tier.items || []).map(item => {
                  const def = modDefs[item.itemHash];
                  const planned = planSet.has(item.itemHash);

                  return (
                    <LongPressable
                      key={item.itemHash}
                      onClick={() => togglePlanned(item.itemHash)}
                      onLongPress={() => def && onOpenInfo?.({ ...def, type: 'perk' })}
                      title={def?.name || `Mod ${item.itemHash}`}
                      className={`flex items-start gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                        planned
                          ? 'bg-amber-500/10 border-amber-500/50'
                          : 'bg-[#0b0e14] border-[#20293a] hover:border-slate-600'
                      } ${item.isActive ? '' : 'opacity-70'}`}
                    >
                      <div className="relative w-9 h-9 rounded-lg bg-black/60 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {def?.icon ? (
                          <img src={def.icon} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-slate-600" />
                        )}
                        {!item.isActive && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <Lock className="w-3 h-3 text-slate-400" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-bold text-white truncate">
                            {def?.name || `Mod ${item.itemHash}`}
                          </span>
                          {planned && <Check className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                        </div>
                        <span className="text-[9px] font-mono text-slate-500">
                          {item.isActive ? 'Unlocked in game' : 'Not unlocked'}
                        </span>
                      </div>
                    </LongPressable>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-500 font-mono flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
        <span>
          Bungie's API cannot unlock artifact perks -- that only happens in game. Tap a perk to plan
          it here; hold one to read what it does.
        </span>
      </p>

    </div>
  );
}
