import React, { useState, useMemo } from 'react';
import { 
  ArrowRightLeft, 
  Box, 
  Shield, 
  Zap, 
  RefreshCw, 
  Check, 
  AlertCircle,
  ChevronRight,
  User
} from 'lucide-react';
import { 
  findOwnedInstances, 
  findItemLocation, 
  executeItemTransfer,
  executeEquipItem 
} from '../utils/destiny-inventory-actions';
import { isSameSlot } from '../utils/destiny-buckets';
import { getTierInfo } from '../utils/destiny-helpers';

export default function ItemTransferControls({
  item,
  profileData,
  onProfileUpdate,
  onShowToast
}) {
  const [activeInstanceId, setActiveInstanceId] = useState(() => item?.itemInstanceId || null);
  const [actionTarget, setActionTarget] = useState(null); // 'vault' | 'char_<id>' | 'equip_<id>'
  const [feedback, setFeedback] = useState(null); // { message, type: 'success' | 'error' }

  // Find all owned instances of this item across all characters & vault
  const ownedInstances = useMemo(() => {
    return findOwnedInstances(item, profileData);
  }, [item, profileData]);

  // Selected instance to manage
  const selectedInstance = useMemo(() => {
    if (!ownedInstances.length) return null;
    if (activeInstanceId) {
      const found = ownedInstances.find(it => it.itemInstanceId === activeInstanceId);
      if (found) return found;
    }
    return ownedInstances[0];
  }, [ownedInstances, activeInstanceId]);

  // Find location of selected instance
  const locationInfo = useMemo(() => {
    if (!selectedInstance || !profileData) return null;
    return findItemLocation(selectedInstance, profileData);
  }, [selectedInstance, profileData]);

  if (!profileData?.characters?.length || !ownedInstances.length || !selectedInstance) {
    return null; // Not owned or no profile loaded
  }

  const handleTransfer = async (target) => {
    const targetKey = target.type === 'vault' 
      ? 'vault' 
      : `${target.equip ? 'equip' : 'char'}_${target.characterId}`;
    
    setActionTarget(targetKey);
    setFeedback(null);

    try {
      const result = await executeItemTransfer({
        item: selectedInstance,
        target,
        profileData,
        onOptimisticUpdate: onProfileUpdate
      });

      if (result.ok) {
        setFeedback({ message: result.message, type: 'success' });
        onShowToast?.(result.message, 'success');
      } else {
        setFeedback({ message: result.message, type: 'error' });
        onShowToast?.(result.message, 'warning');
      }
    } catch (err) {
      setFeedback({ message: err.message || 'Transfer failed', type: 'error' });
    } finally {
      setActionTarget(null);
    }
  };

  const handleEquipOnly = async (characterId) => {
    setActionTarget(`equip_${characterId}`);
    setFeedback(null);

    try {
      const result = await executeEquipItem({
        item: selectedInstance,
        characterId,
        profileData,
        onOptimisticUpdate: onProfileUpdate
      });

      if (result.ok) {
        setFeedback({ message: result.message, type: 'success' });
        onShowToast?.(result.message, 'success');
      } else {
        setFeedback({ message: result.message, type: 'error' });
        onShowToast?.(result.message, 'warning');
      }
    } catch (err) {
      setFeedback({ message: err.message || 'Equip failed', type: 'error' });
    } finally {
      setActionTarget(null);
    }
  };

  const currentLoc = locationInfo?.location; // 'equipped' | 'bag' | 'vault'
  const currentChar = locationInfo?.character;

  return (
    <div className="bg-[#0b0e14] border border-[#20293a] rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
      
      {/* Header & Ownership Count */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#20293a] pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <ArrowRightLeft className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white font-heading uppercase tracking-wider">
              Inventory & Real-Time Transfer
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">
              You own {ownedInstances.length} roll{ownedInstances.length === 1 ? '' : 's'} across your account
            </span>
          </div>
        </div>

        {/* Current Location Badge */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          {currentLoc === 'vault' && (
            <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-amber-300 text-xs font-mono font-semibold flex items-center gap-1.5 shadow-sm">
              <Box className="w-3.5 h-3.5 text-amber-400" />
              <span>In Vault</span>
            </span>
          )}
          {currentLoc === 'equipped' && currentChar && (
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-semibold flex items-center gap-1.5 shadow-sm">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Equipped on {currentChar.classType}</span>
            </span>
          )}
          {currentLoc === 'bag' && currentChar && (
            <span className="px-2.5 py-1 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-300 text-xs font-mono font-semibold flex items-center gap-1.5 shadow-sm">
              <User className="w-3.5 h-3.5 text-sky-400" />
              <span>In {currentChar.classType}'s Inventory</span>
            </span>
          )}
        </div>
      </div>

      {/* Multiple Instances Picker (if player owns more than 1 roll) */}
      {ownedInstances.length > 1 && (
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-slate-400 font-heading uppercase">
            Select Owned Roll to Transfer:
          </span>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {ownedInstances.map((inst, idx) => {
              const isSelected = inst.itemInstanceId === selectedInstance.itemInstanceId;
              const instLoc = inst.location === 'vault' ? 'Vault' : `${inst.character?.classType} (${inst.location})`;
              return (
                <button
                  key={inst.itemInstanceId || idx}
                  onClick={() => setActiveInstanceId(inst.itemInstanceId)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-2 border whitespace-nowrap ${
                    isSelected
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 font-bold shadow-sm'
                      : 'bg-[#121722] text-slate-400 hover:text-slate-200 border-[#20293a]'
                  }`}
                >
                  <span>Roll #{idx + 1}</span>
                  {inst.power && <span className="text-amber-400">✧ {inst.power}</span>}
                  <span className="text-[10px] opacity-70">[{instLoc}]</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Destination Buttons Grid */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold text-slate-400 font-heading uppercase">
          Transfer Or Equip:
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          
          {/* 1. VAULT DESTINATION BUTTON */}
          <div className="bg-[#121722] border border-[#20293a] rounded-xl p-3 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white font-heading">Vault</span>
              </div>
              {currentLoc === 'vault' && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">
                  Here
                </span>
              )}
            </div>

            {currentLoc === 'vault' ? (
              <button
                disabled
                className="w-full py-2 rounded-lg bg-slate-800/40 text-slate-500 border border-slate-800 text-xs font-mono font-medium cursor-default"
              >
                In Vault
              </button>
            ) : currentLoc === 'equipped' ? (
              <button
                disabled
                title="Equip another item on this Guardian first to move this piece"
                className="w-full py-2 rounded-lg bg-slate-800/40 text-slate-500 border border-slate-800 text-xs font-mono font-medium cursor-not-allowed"
              >
                Equipped (Unequip first)
              </button>
            ) : (
              <button
                disabled={!!actionTarget}
                onClick={() => handleTransfer({ type: 'vault' })}
                className="w-full py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {actionTarget === 'vault' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Box className="w-3.5 h-3.5" />
                )}
                <span>Move to Vault</span>
              </button>
            )}
          </div>

          {/* 2. GUARDIAN CHARACTER BUTTONS */}
          {profileData.characters.map((char) => {
            const isCharHere = currentChar?.characterId === char.characterId;
            const isEquippedHere = isCharHere && currentLoc === 'equipped';
            const isInBagHere = isCharHere && currentLoc === 'bag';

            // Armor class lock check
            const isClassLocked = selectedInstance.isArmor && 
              selectedInstance.classType && 
              selectedInstance.classType !== 'Any' && 
              selectedInstance.classType !== char.classType;

            // Bag space on this character
            const charSlotItems = (char.bag || []).filter(it => isSameSlot(it, selectedInstance));
            const isCharBagFull = charSlotItems.length >= 9;

            const isTransferringToChar = actionTarget === `char_${char.characterId}`;
            const isEquippingOnChar = actionTarget === `equip_${char.characterId}`;
            const isBusy = isTransferringToChar || isEquippingOnChar;

            return (
              <div 
                key={char.characterId}
                className="bg-[#121722] border border-[#20293a] rounded-xl p-3 flex flex-col justify-between space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-300" />
                    <span className="text-xs font-bold text-white font-heading">{char.classType}</span>
                  </div>
                  <span className="text-[10px] text-amber-400 font-mono">
                    ✧ {char.light}
                  </span>
                </div>

                {isClassLocked ? (
                  <button
                    disabled
                    className="w-full py-2 rounded-lg bg-slate-800/30 text-slate-600 border border-slate-800 text-[11px] font-mono cursor-not-allowed"
                  >
                    {selectedInstance.classType} Only
                  </button>
                ) : isEquippedHere ? (
                  <div className="w-full py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold flex items-center justify-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Equipped</span>
                  </div>
                ) : isInBagHere ? (
                  <button
                    disabled={!!actionTarget}
                    onClick={() => handleEquipOnly(char.characterId)}
                    className="w-full py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isEquippingOnChar ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5" />
                    )}
                    <span>Equip on {char.classType}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={!!actionTarget || isCharBagFull}
                      onClick={() => handleTransfer({ type: 'character', characterId: char.characterId })}
                      className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold transition-colors flex items-center justify-center gap-1 disabled:opacity-40"
                      title={isCharBagFull ? 'Inventory is full (9/9)' : `Transfer to ${char.classType}`}
                    >
                      {isTransferringToChar ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      ) : (
                        <ArrowRightLeft className="w-3 h-3 text-amber-400" />
                      )}
                      <span>{isCharBagFull ? 'Inventory Full' : `To ${char.classType}`}</span>
                    </button>

                    <button
                      disabled={!!actionTarget || (isCharBagFull && currentLoc !== 'vault')}
                      onClick={() => handleTransfer({ type: 'character', characterId: char.characterId, equip: true })}
                      className="p-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold transition-colors disabled:opacity-40"
                      title={`Transfer & Equip on ${char.classType}`}
                    >
                      {isEquippingOnChar ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-2.5 rounded-xl text-xs font-mono flex items-center gap-2 animate-fadeIn ${
          feedback.type === 'success' 
            ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' 
            : 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
        }`}>
          {feedback.type === 'success' ? (
            <Check className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-rose-400" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

    </div>
  );
}
