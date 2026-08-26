import React, { useEffect, useState } from 'react';
import { Sparkles, RefreshCw, Check, X, Search, Zap, Shield } from 'lucide-react';
import { getDamageInfo } from '../utils/destiny-helpers';
import { resolveSocketOptions, ROLE_LABELS } from '../utils/subclass';
import LongPressable from './LongPressable';

/**
 * The Class screen: the Guardian's subclass and everything fitted to it.
 *
 * Every tile here is one socket on the subclass item. Tapping one opens the
 * list of plugs that socket will take, and choosing from that list is the same
 * action in each case -- only the socket index differs.
 */

/** The tiles' sizes, so a Super reads as bigger than a Fragment. */
const ROLE_TILE = {
  super: 'w-20 h-20 sm:w-24 sm:h-24',
  aspect: 'w-16 h-16',
  fragment: 'w-14 h-14',
  default: 'w-14 h-14'
};

function PlugTile({ socket, size, onClick, disabled, busy }) {
  const plug = socket.plug;
  const isEmpty = !plug || plug.isEmpty;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={plug?.name || `Empty ${ROLE_LABELS[socket.role] || 'socket'}`}
      className={`relative ${size} rounded-xl bg-black/70 border ${
        isEmpty ? 'border-dashed border-slate-700' : 'border-slate-600'
      } overflow-hidden flex items-center justify-center flex-shrink-0 transition-all shadow-sm ${
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:border-amber-400 hover:scale-105 active:scale-95 cursor-pointer'
      }`}
    >
      {plug?.icon && !isEmpty ? (
        <img src={plug.icon} alt="" className="w-full h-full object-cover" />
      ) : (
        <Sparkles className="w-5 h-5 text-slate-600" />
      )}

      {busy && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
          <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
        </div>
      )}
    </button>
  );
}

function SocketGroup({ title, sockets, size, onPick, actionLoading, pendingSocket, children }) {
  if (!sockets?.length && !children) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-heading font-bold uppercase tracking-wider text-slate-400">
          {title}
        </h4>
        {children}
      </div>

      <div className="flex flex-wrap items-start gap-2">
        {sockets.map(socket => (
          <div key={socket.index} className="space-y-1 w-[4.5rem] sm:w-20">
            <PlugTile
              socket={socket}
              size={size}
              busy={pendingSocket === socket.index}
              disabled={!!actionLoading && pendingSocket !== socket.index}
              onClick={() => onPick(socket)}
            />
            <div className="text-[9px] font-mono text-slate-400 leading-tight text-center break-words">
              {socket.plug && !socket.plug.isEmpty ? socket.plug.name : 'Empty'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The list of plugs one socket will take. */
function PlugPickerSheet({ socket, onClose, onSelect, applying }) {
  const [options, setOptions] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setOptions(null);
    resolveSocketOptions(socket).then(res => {
      if (!cancelled) setOptions(res);
    });
    return () => { cancelled = true; };
  }, [socket]);

  const roleLabel = ROLE_LABELS[socket.role] || 'Socket';
  const filtered = (options || []).filter(opt => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return opt.name.toLowerCase().includes(q) || (opt.description || '').toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-2xl max-h-[85vh] sm:max-h-[80vh] bg-[#121722] border border-[#20293a] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col animate-slideUp sm:animate-fadeIn">

        <div className="p-4 border-b border-[#20293a] space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-heading font-bold text-white text-lg">Choose {roleLabel}</h3>
              <p className="text-xs text-slate-400">
                {options === null
                  ? 'Loading what you have unlocked...'
                  : `${options.length} available`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {(options?.length || 0) > 8 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${roleLabel.toLowerCase()}s...`}
                className="w-full pl-9 pr-3 py-2 bg-[#0b0e14] border border-[#20293a] rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {options === null && (
            <div className="py-10 flex items-center justify-center gap-2 text-slate-400 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              <span>Reading your unlocks from Bungie...</span>
            </div>
          )}

          {options !== null && filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-400">
              Nothing available for this socket.
            </p>
          )}

          {filtered.map(opt => {
            const isCurrent = opt.hash === socket.plugHash;
            return (
              <button
                key={opt.hash}
                disabled={!!applying}
                onClick={() => onSelect(opt)}
                className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-amber-500/10 border-amber-500/50'
                    : 'bg-[#0b0e14] border-[#20293a] hover:border-amber-500/40'
                } ${applying ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="w-11 h-11 rounded-lg bg-black/60 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {opt.icon ? (
                    <img src={opt.icon} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-slate-600" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white font-heading">{opt.name}</span>
                    {isCurrent && (
                      <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-amber-300">
                        <Check className="w-3 h-3" /> Fitted
                      </span>
                    )}
                  </div>
                  {opt.description && (
                    <p className="text-[11px] text-slate-400 leading-snug mt-0.5 line-clamp-3">
                      {opt.description}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function SubclassPanel({
  subclass,
  subclassOptions = [],
  onInsertPlug,
  onEquipSubclass,
  actionLoading,
  onOpenInfo
}) {
  const [pickerSocket, setPickerSocket] = useState(null);
  const [pendingSocket, setPendingSocket] = useState(null);

  if (!subclass) {
    return (
      <div className="bg-[#121722] border border-[#20293a] rounded-2xl p-8 text-center space-y-3">
        <Shield className="w-8 h-8 text-slate-600 mx-auto" />
        <p className="text-sm text-slate-400">
          No subclass found on this Guardian yet. Refresh once you have logged into the game on this
          character.
        </p>
      </div>
    );
  }

  const damageInfo = getDamageInfo(subclass.damageType);

  const handleSelect = async (option) => {
    const socket = pickerSocket;
    if (!socket) return;

    setPickerSocket(null);
    setPendingSocket(socket.index);
    try {
      await onInsertPlug?.(socket, option);
    } finally {
      setPendingSocket(null);
    }
  };

  const fragmentsFitted = subclass.fragments.filter(s => s.plug && !s.plug.isEmpty).length;
  const aspectsFitted = subclass.aspects.filter(s => s.plug && !s.plug.isEmpty).length;

  return (
    <div className="space-y-4">

      {/* The subclass itself, and the others this Guardian can switch to. */}
      <div className={`bg-[#121722] border ${damageInfo.border} rounded-2xl overflow-hidden shadow-lg`}>
        <div className={`p-4 ${damageInfo.bg} flex items-center gap-4`}>
          <div className="w-16 h-16 rounded-xl bg-black/60 border border-white/10 overflow-hidden flex-shrink-0">
            {subclass.icon && <img src={subclass.icon} alt="" className="w-full h-full object-cover" />}
          </div>

          <div className="min-w-0 flex-1">
            <span className={`text-[10px] font-mono font-bold uppercase ${damageInfo.text}`}>
              {damageInfo.name} Subclass
            </span>
            <h3 className="font-heading font-bold text-white text-xl truncate">{subclass.name}</h3>
            <p className="text-[11px] text-slate-400 font-mono">
              {aspectsFitted}/{subclass.aspects.length} Aspects • {fragmentsFitted}/{subclass.fragments.length} Fragments
            </p>
          </div>
        </div>

        {subclassOptions.length > 0 && (
          <div className="p-3 bg-[#0b0e14] border-t border-[#1e2638] space-y-2">
            <div className="text-[11px] font-heading font-bold uppercase tracking-wider text-slate-400">
              Switch Subclass
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {subclassOptions.map(option => {
                const optionDamage = getDamageInfo(option.damageType);
                const isBusy = actionLoading === option.itemInstanceId;
                const blocked = !!actionLoading && !isBusy;

                return (
                  <LongPressable
                    key={option.itemInstanceId}
                    onClick={() => { if (!blocked) onEquipSubclass?.(option.itemInstanceId); }}
                    onLongPress={() => onOpenInfo?.({ ...option, type: 'subclass' })}
                    title={`${option.name} - Tap to equip`}
                    className={`relative w-12 h-12 rounded-xl bg-black/70 border ${optionDamage.border} overflow-hidden flex-shrink-0 flex items-center justify-center transition-all ${
                      blocked
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:border-amber-400 hover:scale-105 active:scale-95 cursor-pointer'
                    }`}
                  >
                    {option.icon ? (
                      <img src={option.icon} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Zap className="w-4 h-4 text-slate-500" />
                    )}
                    {isBusy && (
                      <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                        <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                      </div>
                    )}
                  </LongPressable>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Super and abilities */}
      <div className="bg-[#121722] border border-[#1e2638] rounded-2xl p-4 space-y-5">
        {subclass.super && (
          <SocketGroup
            title="Super"
            sockets={[subclass.super]}
            size={ROLE_TILE.super}
            onPick={setPickerSocket}
            actionLoading={actionLoading}
            pendingSocket={pendingSocket}
          />
        )}

        <SocketGroup
          title="Abilities"
          sockets={subclass.abilities}
          size={ROLE_TILE.default}
          onPick={setPickerSocket}
          actionLoading={actionLoading}
          pendingSocket={pendingSocket}
        />
      </div>

      {/* Aspects and Fragments */}
      <div className="bg-[#121722] border border-[#1e2638] rounded-2xl p-4 space-y-5">
        <SocketGroup
          title={`Aspects (${aspectsFitted}/${subclass.aspects.length})`}
          sockets={subclass.aspects}
          size={ROLE_TILE.aspect}
          onPick={setPickerSocket}
          actionLoading={actionLoading}
          pendingSocket={pendingSocket}
        />

        <SocketGroup
          title={`Fragments (${fragmentsFitted}/${subclass.fragments.length})`}
          sockets={subclass.fragments}
          size={ROLE_TILE.fragment}
          onPick={setPickerSocket}
          actionLoading={actionLoading}
          pendingSocket={pendingSocket}
        />

        <p className="text-[11px] text-slate-500 font-mono">
          Fragment slots come from the Aspects you fit -- swap an Aspect and the game re-counts them.
        </p>
      </div>

      {pickerSocket && (
        <PlugPickerSheet
          socket={pickerSocket}
          applying={pendingSocket !== null}
          onClose={() => setPickerSocket(null)}
          onSelect={handleSelect}
        />
      )}

    </div>
  );
}
