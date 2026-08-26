import React, { useEffect, useState } from 'react';
import { Zap, Shield, Sparkles, Save, Trash2, Pencil, Check, X, RefreshCw, Bookmark } from 'lucide-react';
import { batchResolveDefinitions, displayOf } from '../utils/definition-api';
import { describePlugs } from '../utils/subclass';
import { getDamageInfo } from '../utils/destiny-helpers';
import {
  getLoadoutsForClass,
  buildLoadoutFromCharacter,
  saveCustomLoadout,
  removeCustomLoadout,
  renameCustomLoadout
} from '../utils/custom-loadouts';

/**
 * The Loadouts screen: the ten the game stores, and any number the app does.
 *
 * A game loadout carries its subclass configuration as bare plug hashes, so the
 * Super, Aspects and Fragments it would equip are resolved here and shown next
 * to the gear -- otherwise two loadouts holding the same weapons look identical
 * when they play nothing alike.
 */

/** Group a loadout's resolved plugs the way the subclass screen lays them out. */
function groupPlugs(plugs) {
  const groups = { super: [], aspect: [], fragment: [], ability: [] };
  (plugs || []).forEach(plug => {
    if (plug.role === 'super') groups.super.push(plug);
    else if (plug.role === 'aspect') groups.aspect.push(plug);
    else if (plug.role === 'fragment') groups.fragment.push(plug);
    else if (plug.role) groups.ability.push(plug);
  });
  return groups;
}

/** The stats a plug moves, as the game writes them: "+10 Melee". */
function formatStats(stats) {
  return (stats || []).map(stat => `${stat.value > 0 ? '+' : ''}${stat.value} ${stat.name}`);
}

/**
 * What a loadout's Fragments add up to.
 *
 * Fragments pay for themselves in stats, and the total is the thing a player
 * weighs one loadout against another by -- reading it off five separate
 * tooltips is not the same as seeing it.
 */
function StatTotals({ plugs }) {
  const totals = new Map();
  (plugs || []).forEach(plug => {
    (plug.stats || []).forEach(stat => {
      totals.set(stat.name, (totals.get(stat.name) || 0) + stat.value);
    });
  });

  const entries = [...totals.entries()].filter(([, value]) => value !== 0);
  if (!entries.length) return null;

  return (
    <div className="flex items-start gap-2">
      <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 w-16 flex-shrink-0 pt-0.5">
        Stats
      </span>
      <div className="flex flex-wrap items-center gap-1">
        {entries.map(([name, value]) => (
          <span
            key={name}
            className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${
              value > 0
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {value > 0 ? '+' : ''}{value} {name}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Resolve a list of plug hashes to what they are and what they do.
 *
 * Both kinds of card need this -- a game loadout stores bare hashes, and a
 * saved one stores only enough to redraw itself offline -- and the definitions
 * are cached, so asking twice costs nothing after the first card.
 */
function usePlugDetails(hashes) {
  const [plugs, setPlugs] = useState(null);
  const key = (hashes || []).filter(Boolean).join(',');

  useEffect(() => {
    if (!key) {
      setPlugs([]);
      return undefined;
    }
    let cancelled = false;
    describePlugs(key.split(',')).then(res => {
      if (!cancelled) setPlugs(res);
    });
    return () => { cancelled = true; };
  }, [key]);

  return plugs;
}

function PlugRow({ label, plugs, onOpenInfo, size = 'w-8 h-8' }) {
  if (!plugs?.length) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 w-16 flex-shrink-0">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1">
        {plugs.map(plug => (
          <button
            key={plug.hash}
            onClick={() => onOpenInfo?.({ ...plug, type: 'perk' })}
            title={[plug.name, ...formatStats(plug.stats)].join(' • ')}
            className={`${size} rounded-lg bg-black/60 border border-slate-700 hover:border-amber-500/60 overflow-hidden flex items-center justify-center transition-colors`}
          >
            {plug.icon ? (
              <img src={plug.icon} alt="" className="w-full h-full object-cover" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-slate-600" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/** One of the game's own loadout slots. */
function GameLoadoutCard({ loadout, onEquip, actionLoading, onOpenInfo }) {
  const plugs = usePlugDetails(loadout.subclassPlugHashes);
  const groups = groupPlugs(plugs);
  const damageInfo = getDamageInfo(loadout.subclass?.damageType);
  const isEquipping = actionLoading === `loadout_${loadout.index}`;

  return (
    <div className="bg-[#121722] border border-[#20293a] hover:border-amber-500/40 rounded-xl p-4 space-y-3 transition-all shadow-lg flex flex-col justify-between">
      <div className="space-y-3">

        {/* Name, in-game icon, and the subclass it runs */}
        <div className="flex items-center gap-3 pb-3 border-b border-[#20293a]">
          <div
            className="relative w-10 h-10 rounded-lg border flex items-center justify-center overflow-hidden flex-shrink-0"
            style={{
              backgroundColor: loadout.colorImage ? undefined : 'rgba(245, 158, 11, 0.15)',
              borderColor: 'rgba(245, 158, 11, 0.4)'
            }}
          >
            {loadout.colorImage && (
              <img src={loadout.colorImage} alt="" className="absolute w-10 h-10 object-cover opacity-70" />
            )}
            {loadout.iconImage ? (
              <img src={loadout.iconImage} alt="" className="relative w-7 h-7 object-contain" />
            ) : (
              <span className="relative font-bold text-amber-300 font-heading">#{loadout.index + 1}</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-white text-base font-heading truncate">{loadout.name}</h4>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              {loadout.subclass?.name
                ? <span className={damageInfo.text}>{loadout.subclass.name}</span>
                : `${loadout.items.length} items`}
              {loadout.subclass?.name ? ` • ${loadout.items.length} items` : ''}
            </p>
          </div>
        </div>

        {/* Gear */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {loadout.items.map((it, idx) => (
            <div
              key={it.itemInstanceId || idx}
              className="relative rounded-lg bg-black/50 border border-slate-800 p-1 flex flex-col items-center justify-center overflow-hidden"
              title={it.name}
            >
              <div className="w-10 h-10 rounded overflow-hidden bg-slate-900 flex items-center justify-center">
                {it.icon ? (
                  <img src={it.icon} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Shield className="w-5 h-5 text-slate-600" />
                )}
              </div>
              <span className="text-[9px] text-slate-300 font-mono truncate w-full text-center mt-1">
                {it.name}
              </span>
            </div>
          ))}
        </div>

        {/* Subclass configuration */}
        {plugs === null && (
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-600" />
        )}

        {plugs !== null && plugs.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-[#20293a]">
            <PlugRow label="Super" plugs={groups.super} onOpenInfo={onOpenInfo} size="w-9 h-9" />
            <PlugRow label="Abilities" plugs={groups.ability} onOpenInfo={onOpenInfo} />
            <PlugRow label="Aspects" plugs={groups.aspect} onOpenInfo={onOpenInfo} />
            <PlugRow label="Fragments" plugs={groups.fragment} onOpenInfo={onOpenInfo} />
            <StatTotals plugs={groups.fragment} />
          </div>
        )}
      </div>

      <button
        disabled={!!actionLoading}
        onClick={() => onEquip(loadout.index)}
        className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs font-mono flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-md"
      >
        <Zap className="w-4 h-4" />
        <span>{isEquipping ? 'Equipping...' : 'Equip in game'}</span>
      </button>
    </div>
  );
}

/** One of the app's own saved loadouts. */
function CustomLoadoutCard({ loadout, onApply, onRemove, onRename, applying, disabled, onOpenInfo }) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(loadout.name);

  // A saved loadout stores a plug by the socket it belongs in, so its hash is
  // under `plugHash` rather than `hash` -- the row keys off the plug itself.
  const savedPlugs = (loadout.subclass?.plugs || []).map(p => ({ ...p, hash: p.plugHash }));

  // The snapshot carries a name and an icon, which is enough to draw the card
  // without a network. What each plug *does* is not stored -- keeping a copy
  // would go stale the first time Bungie tunes a Fragment -- so it is resolved
  // from the manifest and merged over the snapshot when it arrives.
  const resolved = usePlugDetails(savedPlugs.map(p => p.plugHash));
  const byHash = new Map((resolved || []).map(plug => [String(plug.hash), plug]));
  const plugs = savedPlugs.map(plug => ({ ...plug, ...(byHash.get(String(plug.plugHash)) || {}) }));

  const groups = groupPlugs(plugs);
  const damageInfo = getDamageInfo(loadout.subclass?.damageType);

  const commitRename = () => {
    setEditing(false);
    if (draftName.trim() && draftName.trim() !== loadout.name) onRename(loadout.id, draftName);
  };

  return (
    <div className="bg-[#121722] border border-[#20293a] hover:border-amber-500/40 rounded-xl p-4 space-y-3 transition-all shadow-lg flex flex-col justify-between">
      <div className="space-y-3">

        <div className="flex items-center gap-3 pb-3 border-b border-[#20293a]">
          <div className="w-10 h-10 rounded-lg bg-black/60 border border-slate-700 overflow-hidden flex items-center justify-center flex-shrink-0">
            {loadout.subclass?.icon ? (
              <img src={loadout.subclass.icon} alt="" className="w-full h-full object-cover" />
            ) : (
              <Bookmark className="w-4 h-4 text-amber-400" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') { setDraftName(loadout.name); setEditing(false); }
                  }}
                  className="flex-1 min-w-0 px-2 py-1 bg-[#0b0e14] border border-amber-500/50 rounded text-sm text-white focus:outline-none"
                />
                <button onClick={commitRename} className="p-1 rounded bg-amber-500/20 text-amber-300">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { setDraftName(loadout.name); setEditing(false); }}
                  className="p-1 rounded bg-slate-800 text-slate-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <h4 className="font-bold text-white text-base font-heading truncate">{loadout.name}</h4>
            )}

            <p className="text-[11px] text-slate-400 font-mono truncate">
              {loadout.classType || 'Guardian'} • {loadout.items.length} items
              {loadout.subclass?.name && <span className={`ml-1 ${damageInfo.text}`}>• {loadout.subclass.name}</span>}
            </p>
          </div>

          {!editing && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setEditing(true)}
                title="Rename"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onRemove(loadout.id)}
                title="Delete"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {loadout.items.map((it, idx) => (
            <div
              key={it.itemInstanceId || idx}
              className="rounded-lg bg-black/50 border border-slate-800 p-1 flex flex-col items-center justify-center overflow-hidden"
              title={it.name}
            >
              <div className="w-10 h-10 rounded overflow-hidden bg-slate-900 flex items-center justify-center">
                {it.icon ? (
                  <img src={it.icon} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Shield className="w-5 h-5 text-slate-600" />
                )}
              </div>
              <span className="text-[9px] text-slate-300 font-mono truncate w-full text-center mt-1">
                {it.name}
              </span>
            </div>
          ))}
        </div>

        {loadout.subclass?.plugs?.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-[#20293a]">
            <PlugRow label="Super" plugs={groups.super} onOpenInfo={onOpenInfo} size="w-9 h-9" />
            <PlugRow label="Abilities" plugs={groups.ability} onOpenInfo={onOpenInfo} />
            <PlugRow label="Aspects" plugs={groups.aspect} onOpenInfo={onOpenInfo} />
            <PlugRow label="Fragments" plugs={groups.fragment} onOpenInfo={onOpenInfo} />
            <StatTotals plugs={groups.fragment} />
          </div>
        )}
      </div>

      <button
        disabled={disabled}
        onClick={() => onApply(loadout)}
        className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs font-mono flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-md"
      >
        <Zap className="w-4 h-4" />
        <span>{applying ? 'Applying...' : 'Apply loadout'}</span>
      </button>
    </div>
  );
}

export default function LoadoutsPanel({
  loadouts = [],
  activeChar,
  subclass,
  onEquipLoadout,
  onApplyCustomLoadout,
  actionLoading,
  onOpenInfo
}) {
  const [view, setView] = useState('game'); // 'game' | 'saved'
  const [saved, setSaved] = useState(() => getLoadoutsForClass(activeChar?.classType));
  const [newName, setNewName] = useState('');
  const [nameLookup, setNameLookup] = useState({});

  useEffect(() => {
    setSaved(getLoadoutsForClass(activeChar?.classType));
  }, [activeChar?.classType]);

  // Game loadouts name themselves through a definition, not a string.
  useEffect(() => {
    const nameHashes = loadouts.map(ld => ld.nameHash).filter(Boolean);
    const iconHashes = loadouts.map(ld => ld.iconHash).filter(Boolean);
    const colorHashes = loadouts.map(ld => ld.colorHash).filter(Boolean);
    if (!nameHashes.length && !iconHashes.length) return undefined;

    let cancelled = false;
    (async () => {
      const [names, icons, colors] = await Promise.all([
        batchResolveDefinitions('DestinyLoadoutNameDefinition', nameHashes),
        batchResolveDefinitions('DestinyLoadoutIconDefinition', iconHashes),
        batchResolveDefinitions('DestinyLoadoutColorDefinition', colorHashes)
      ]);
      if (!cancelled) setNameLookup({ names, icons, colors });
    })();

    return () => { cancelled = true; };
  }, [loadouts]);

  const decorated = loadouts.map(ld => {
    const nameDef = nameLookup.names?.[ld.nameHash];
    const iconDef = nameLookup.icons?.[ld.iconHash];
    const colorDef = nameLookup.colors?.[ld.colorHash];
    // A loadout name definition carries its name at the top level rather than
    // in display properties, which is where every other definition keeps it.
    return {
      ...ld,
      name: nameDef?.name || displayOf(nameDef).name || ld.name,
      iconImage: iconDef?.iconImagePath ? `https://www.bungie.net${iconDef.iconImagePath}` : null,
      colorImage: colorDef?.colorImagePath ? `https://www.bungie.net${colorDef.colorImagePath}` : null
    };
  });

  const handleSaveCurrent = () => {
    if (!activeChar) return;
    const loadout = buildLoadoutFromCharacter(
      activeChar,
      subclass,
      newName || `${activeChar.classType} loadout ${saved.length + 1}`
    );
    saveCustomLoadout(loadout);
    setSaved(getLoadoutsForClass(activeChar.classType));
    setNewName('');
    setView('saved');
  };

  const handleRemove = (id) => {
    removeCustomLoadout(id);
    setSaved(getLoadoutsForClass(activeChar?.classType));
  };

  const handleRename = (id, name) => {
    renameCustomLoadout(id, name);
    setSaved(getLoadoutsForClass(activeChar?.classType));
  };

  return (
    <div className="space-y-4">

      {/* In-game slots vs the app's own */}
      <div className="flex items-center justify-between flex-wrap gap-2 bg-[#121722] border border-[#1e2638] p-2 rounded-2xl">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView('game')}
            className={`px-3 py-1.5 rounded-xl text-xs font-heading font-bold tracking-wide transition-all ${
              view === 'game' ? 'bg-amber-500 text-black shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            In-Game ({loadouts.length})
          </button>
          <button
            onClick={() => setView('saved')}
            className={`px-3 py-1.5 rounded-xl text-xs font-heading font-bold tracking-wide transition-all flex items-center gap-1.5 ${
              view === 'saved' ? 'bg-amber-500 text-black shadow-sm' : 'text-slate-400 hover:text-amber-400'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Saved ({saved.length})</span>
          </button>
        </div>

        {view === 'saved' && (
          <div className="flex items-center gap-2 flex-1 sm:flex-none min-w-0">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCurrent(); }}
              placeholder="Name this loadout..."
              className="flex-1 sm:w-52 min-w-0 px-3 py-1.5 bg-[#0b0e14] border border-[#20293a] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={handleSaveCurrent}
              disabled={!activeChar}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold font-mono transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save current</span>
            </button>
          </div>
        )}
      </div>

      {view === 'game' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {decorated.map(ld => (
            <GameLoadoutCard
              key={ld.index}
              loadout={ld}
              onEquip={onEquipLoadout}
              actionLoading={actionLoading}
              onOpenInfo={onOpenInfo}
            />
          ))}

          {decorated.length === 0 && (
            <p className="text-sm text-slate-400 py-8 text-center col-span-full">
              This Guardian has no loadouts saved in game yet.
            </p>
          )}
        </div>
      )}

      {view === 'saved' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {saved.map(ld => (
            <CustomLoadoutCard
              key={ld.id}
              loadout={ld}
              onApply={onApplyCustomLoadout}
              onRemove={handleRemove}
              onRename={handleRename}
              applying={actionLoading === `custom_${ld.id}`}
              disabled={!!actionLoading}
              onOpenInfo={onOpenInfo}
            />
          ))}

          {saved.length === 0 && (
            <div className="col-span-full bg-[#121722] border border-dashed border-[#20293a] rounded-2xl p-8 text-center space-y-2">
              <Bookmark className="w-7 h-7 text-slate-600 mx-auto" />
              <p className="text-sm text-slate-400">
                Nothing saved for your {activeChar?.classType || 'Guardian'} yet.
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
