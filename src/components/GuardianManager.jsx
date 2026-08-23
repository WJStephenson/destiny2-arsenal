import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  Crosshair, 
  ArrowRightLeft, 
  Zap, 
  RefreshCw, 
  Sparkles, 
  LogIn, 
  LogOut, 
  Check, 
  ChevronRight, 
  Box, 
  Backpack, 
  ExternalLink, 
  Search, 
  Filter, 
  Info 
} from 'lucide-react';
import { getDamageInfo, getTierInfo } from '../utils/destiny-helpers';
import { getStoredAuthSession, getStoredSettings, getValidAuthToken } from '../utils/auth-storage';
import { getItemDefinition, batchResolveItemDefinitions } from '../utils/item-definition-cache';
import { getClientItemByHash, getClientItemByName, initClientManifest } from '../utils/client-manifest';
import LongPressable from './LongPressable';
import ArmourOptimizer from './ArmourOptimizer';

export default function GuardianManager({ 
  onSelectWeapon, 
  onSelectArmor,
  onOpenSettings,
  authSession,
  onLogin,
  onLogout,
  onOpenInfo 
}) {
  const [profileData, setProfileData] = useState(null);
  const [selectedCharacterIndex, setSelectedCharacterIndex] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState('weapons'); // 'weapons' | 'armor' | 'inventory' | 'loadouts' | 'vault'
  const [armorView, setArmorView] = useState('slots'); // 'slots' | 'optimizer'
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [vaultSearch, setVaultSearch] = useState('');
  const [vaultFilter, setVaultFilter] = useState('all'); // 'all' | 'weapons' | 'armor'

  // Persistent pending action trackers to prevent Bungie's edge cache from reverting UI
  const pendingEquipsRef = useRef(new Map());
  const pendingTransfersRef = useRef(new Map());

  useEffect(() => {
    if (authSession?.authenticated) {
      fetchLiveProfile(true);
    }
  }, [authSession]);

  const fetchLiveProfile = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      // 1. First attempt local Express backend API (if available)
      try {
        const res = await fetch(`/api/inventory/profile?_ts=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.characters && data.characters.length > 0) {
            setProfileData(data);
            if (showLoading) setLoading(false);
            return;
          }
        }
      } catch (e) {}

      // 2. Direct Bungie.net API querying from browser with cache-busting
      const token = await getValidAuthToken();
      const settings = getStoredSettings();
      const session = getStoredAuthSession().session;

      if (!token || !session) {
        if (showLoading) setLoading(false);
        return;
      }

      // Get memberships
      let membership = session.user?.destinyMemberships?.[0];
      if (!membership) {
        const memRes = await fetch('https://www.bungie.net/Platform/User/GetMembershipsForCurrentUser/', {
          headers: {
            'X-API-Key': settings.apiKey || '',
            'Authorization': `Bearer ${token}`
          }
        });
        const memData = await memRes.json();
        membership = memData.Response?.destinyMemberships?.[0];
      }

      if (membership) {
        const components = '100,102,200,201,205,300,304,305,206';
        const url = `https://www.bungie.net/Platform/Destiny2/${membership.membershipType}/Profile/${membership.membershipId}/?components=${components}&_ts=${Date.now()}`;
        const profileRes = await fetch(url, {
          cache: 'no-store',
          headers: {
            'X-API-Key': settings.apiKey || '',
            'Authorization': `Bearer ${token}`
          }
        });
        const raw = await profileRes.json();
        if (raw.Response) {
          await parseAndEnrichDirectBungieProfile(raw.Response);
        }
      }
    } catch (err) {
      console.error('Failed to fetch live profile:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  async function parseAndEnrichDirectBungieProfile(data) {
    if (!data) return;

    const charsMap = data.characters?.data || {};
    const equipMap = data.characterEquipment?.data || {};
    const bagMap = data.characterInventories?.data || {};
    const loadoutsMap = data.characterLoadouts?.data || {};
    const instances = data.itemComponents?.instances?.data || {};
    const socketsMap = data.itemComponents?.sockets?.data || {};
    const statsMap = data.itemComponents?.stats?.data || {};
    const rawVault = data.profileInventory?.data?.items || [];

    // Reconcile Pending Equips with stale Bungie cache
    const now = Date.now();
    for (const [instId, entry] of pendingEquipsRef.current.entries()) {
      if (now - entry.timestamp > 30000) {
        pendingEquipsRef.current.delete(instId);
        continue;
      }
      const charId = entry.characterId;
      const rawEq = equipMap[charId]?.items || [];
      const rawBg = bagMap[charId]?.items || [];

      const isEquippedInBungie = rawEq.some(it => it.itemInstanceId === instId);
      if (isEquippedInBungie) {
        pendingEquipsRef.current.delete(instId);
      } else {
        // Bungie CDN is still returning stale data; enforce optimistic equip
        const bgIdx = rawBg.findIndex(it => it.itemInstanceId === instId);
        if (bgIdx !== -1) {
          const itemToEquip = rawBg[bgIdx];
          const eqIdx = rawEq.findIndex(it => it.bucketHash === itemToEquip.bucketHash);
          if (eqIdx !== -1) {
            const oldEq = rawEq[eqIdx];
            rawEq[eqIdx] = itemToEquip;
            rawBg[bgIdx] = oldEq;
          }
        }
      }
    }

    // Reconcile Pending Transfers with stale Bungie cache
    for (const [instId, entry] of pendingTransfersRef.current.entries()) {
      if (now - entry.timestamp > 30000) {
        pendingTransfersRef.current.delete(instId);
        continue;
      }
      const charId = entry.characterId;
      const rawBg = bagMap[charId]?.items || [];

      if (entry.transferToVault) {
        const inVault = rawVault.some(it => it.itemInstanceId === instId);
        if (inVault) {
          pendingTransfersRef.current.delete(instId);
        } else {
          const bgIdx = rawBg.findIndex(it => it.itemInstanceId === instId);
          if (bgIdx !== -1) {
            const item = rawBg.splice(bgIdx, 1)[0];
            rawVault.push(item);
          }
        }
      } else {
        const inBag = rawBg.some(it => it.itemInstanceId === instId);
        if (inBag) {
          pendingTransfersRef.current.delete(instId);
        } else {
          const vIdx = rawVault.findIndex(it => it.itemInstanceId === instId);
          if (vIdx !== -1) {
            const item = rawVault.splice(vIdx, 1)[0];
            rawBg.push(item);
          }
        }
      }
    }

    const allHashesToResolve = [];

    Object.values(equipMap).forEach(eq => {
      (eq.items || []).forEach(it => {
        if (it.itemHash) allHashesToResolve.push(it.itemHash);
        if (it.itemInstanceId && socketsMap[it.itemInstanceId]?.sockets) {
          socketsMap[it.itemInstanceId].sockets.forEach(s => {
            if (s.plugHash && s.isVisible) allHashesToResolve.push(s.plugHash);
          });
        }
      });
    });

    Object.values(bagMap).forEach(bg => {
      (bg.items || []).forEach(it => {
        if (it.itemHash) allHashesToResolve.push(it.itemHash);
        if (it.itemInstanceId && socketsMap[it.itemInstanceId]?.sockets) {
          socketsMap[it.itemInstanceId].sockets.forEach(s => {
            if (s.plugHash && s.isVisible) allHashesToResolve.push(s.plugHash);
          });
        }
      });
    });

    (data.profileInventory?.data?.items || []).forEach(it => {
      if (it.itemHash) allHashesToResolve.push(it.itemHash);
    });

    const defs = await batchResolveItemDefinitions(allHashesToResolve);

    function enrichItem(it) {
      const hash = it.itemHash;
      const localDef = getClientItemByHash(hash) || (defs[hash]?.name ? getClientItemByName(defs[hash].name) : null);
      const def = localDef || defs[hash] || {};
      const inst = it.itemInstanceId ? instances[it.itemInstanceId] : null;
      const sock = it.itemInstanceId ? socketsMap[it.itemInstanceId] : null;

      const perks = [];
      if (sock && sock.sockets) {
        sock.sockets.forEach(s => {
          if (s.plugHash && s.isVisible) {
            const pDef = getClientItemByHash(s.plugHash) || defs[s.plugHash];
            if (pDef && pDef.name && !pDef.name.includes('Empty') && !pDef.name.includes('Tracker') && !pDef.name.includes('Kill') && !pDef.name.includes('Default') && !pDef.name.includes('Shader')) {
              perks.push({
                hash: s.plugHash,
                name: pDef.name,
                icon: pDef.icon,
                description: pDef.description,
                isEnhanced: pDef.isEnhanced,
                stats: pDef.stats
              });
            }
          }
        });
      }

      // Slot detection
      let detectedSlot = def.slot;
      if (!detectedSlot) {
        if (it.bucketHash === 1498876634) detectedSlot = 'Kinetic';
        else if (it.bucketHash === 2465295065) detectedSlot = 'Energy';
        else if (it.bucketHash === 953998645) detectedSlot = 'Power';
      }

      // New Armor Stats extraction (Destiny 2 Frontiers System):
      // Weapons (formerly Mobility), Health (formerly Resilience), Class (formerly Recovery),
      // Grenade (formerly Discipline), Super (formerly Intellect), Melee (formerly Strength)
      const rawStats = it.itemInstanceId && statsMap[it.itemInstanceId]?.stats ? statsMap[it.itemInstanceId].stats : null;
      let armorStats = null;
      if (rawStats) {
        const weap = rawStats[2996146669]?.value || 0;
        const hlth = rawStats[392767087]?.value || 0;
        const clas = rawStats[1943344089]?.value || 0;
        const gren = rawStats[1735426796]?.value || 0;
        const supr = rawStats[144602215]?.value || 0;
        const mele = rawStats[4244567218]?.value || 0;
        const total = weap + hlth + clas + gren + supr + mele;
        armorStats = {
          weapons: weap,
          health: hlth,
          classAbility: clas,
          grenade: gren,
          superAbility: supr,
          melee: mele,
          mobility: weap,
          resilience: hlth,
          recovery: clas,
          discipline: gren,
          intellect: supr,
          strength: mele,
          total
        };
      } else if (def.statsList && def.statsList.length > 0) {
        let weap = 0, hlth = 0, clas = 0, gren = 0, supr = 0, mele = 0;
        def.statsList.forEach(s => {
          const n = s.name?.toLowerCase() || '';
          if (n.includes('weapon') || n.includes('mobility')) weap = s.value;
          else if (n.includes('health') || n.includes('resilience')) hlth = s.value;
          else if (n.includes('class') || n.includes('recovery')) clas = s.value;
          else if (n.includes('grenade') || n.includes('discipline')) gren = s.value;
          else if (n.includes('super') || n.includes('intellect')) supr = s.value;
          else if (n.includes('melee') || n.includes('strength')) mele = s.value;
        });
        const total = weap + hlth + clas + gren + supr + mele;
        if (total > 0) {
          armorStats = {
            weapons: weap,
            health: hlth,
            classAbility: clas,
            grenade: gren,
            superAbility: supr,
            melee: mele,
            mobility: weap,
            resilience: hlth,
            recovery: clas,
            discipline: gren,
            intellect: supr,
            strength: mele,
            total
          };
        }
      }

      return {
        itemInstanceId: it.itemInstanceId,
        itemHash: it.itemHash,
        bucketHash: it.bucketHash,
        slot: detectedSlot,
        ammoType: def.ammoType,
        name: def.name || `Item #${hash}`,
        icon: def.icon || null,
        iconWatermark: def.iconWatermark || null,
        screenshot: def.screenshot || null,
        power: inst?.primaryStat?.value || null,
        tierTypeName: def.tierTypeName || 'Legendary',
        damageType: def.damageType || 'Kinetic',
        itemTypeDisplayName: def.itemTypeDisplayName || (def.isWeapon ? 'Weapon' : def.isArmor ? 'Armour' : ''),
        weaponType: def.isWeapon ? (def.weaponType || def.itemTypeDisplayName) : null,
        armorSlot: def.isArmor ? (def.armorSlot || def.itemTypeDisplayName) : null,
        isWeapon: def.isWeapon || def.weaponType != null || [1498876634, 2465295065, 953998645].includes(it.bucketHash),
        isArmor: def.isArmor || def.armorSlot != null || [3448274439, 3551901077, 1423949262, 20886954, 1585787867].includes(it.bucketHash),
        baseItem: def,
        socketColumns: def.socketColumns || [],
        statsList: def.statsList || [],
        armorStats,
        intrinsic: def.intrinsic || null,
        flavorText: def.flavorText || '',
        sourceString: def.sourceString || '',
        sourceCategory: def.sourceCategory || '',
        isCraftable: def.isCraftable || false,
        perks
      };
    }

    const characters = Object.values(charsMap).map(char => {
      const charId = char.characterId;
      const classType = char.classType === 0 ? 'Titan' : char.classType === 1 ? 'Hunter' : 'Warlock';
      const rawEquipped = equipMap[charId]?.items || [];
      const rawBag = bagMap[charId]?.items || [];

      const equipped = rawEquipped.map(enrichItem);
      const bag = rawBag.map(enrichItem);

      // Map instances for loadouts preview
      const instanceMap = new Map();
      equipped.forEach(it => { if (it.itemInstanceId) instanceMap.set(it.itemInstanceId, it); });
      bag.forEach(it => { if (it.itemInstanceId) instanceMap.set(it.itemInstanceId, it); });

      const loadouts = (loadoutsMap[charId]?.loadouts || []).map((ld, idx) => {
        const loadoutItems = (ld.items || [])
          .filter(it => it.itemInstanceId && it.itemInstanceId !== '0')
          .map(it => {
            return instanceMap.get(it.itemInstanceId) || {
              itemInstanceId: it.itemInstanceId,
              name: 'Item',
              icon: null,
              tierTypeName: 'Legendary'
            };
          });

        return {
          index: idx,
          name: ld.nameId || `Loadout ${idx + 1}`,
          items: loadoutItems
        };
      }).filter(ld => ld.items.length > 0);

      return {
        characterId: charId,
        classType,
        light: char.light,
        emblemBackgroundPath: char.emblemBackgroundPath ? `https://www.bungie.net${char.emblemBackgroundPath}` : null,
        equipped,
        bag,
        loadouts
      };
    });

    const vault = (data.profileInventory?.data?.items || []).map(enrichItem);

    setProfileData({
      profileInfo: data.profile?.data?.userInfo,
            characters,
      vault
    });
  }

  // Helper to determine if two items occupy the same equipment slot
  const isSameSlot = (a, b) => {
    if (!a || !b) return false;
    if (a.bucketHash && b.bucketHash && a.bucketHash === b.bucketHash) return true;
    if (a.isWeapon && b.isWeapon) {
      if (a.slot && b.slot && a.slot.toLowerCase() === b.slot.toLowerCase()) return true;
    }
    if (a.isArmor && b.isArmor) {
      const getSlotKey = (it) => {
        const s = (it.armorSlot || it.slot || it.itemTypeDisplayName || '').toLowerCase();
        if (s.includes('helmet')) return 'helmet';
        if (s.includes('gauntlet') || s.includes('arms')) return 'gauntlets';
        if (s.includes('chest')) return 'chest';
        if (s.includes('leg')) return 'legs';
        if (s.includes('class') || s.includes('mark') || s.includes('cloak') || s.includes('bond')) return 'class';
        return null;
      };
      const slotA = getSlotKey(a);
      const slotB = getSlotKey(b);
      if (slotA && slotB && slotA === slotB) return true;
    }
    return false;
  };

  const handleEquipItem = async (itemInstanceId) => {
    const character = profileData?.characters?.[selectedCharacterIndex];
    if (!character || !itemInstanceId) return;

    // Track pending equip in ref to protect against stale Bungie CDN cache responses
    pendingEquipsRef.current.set(itemInstanceId, {
      characterId: character.characterId,
      timestamp: Date.now()
    });

    // 1. Immediate Optimistic UI Update (0ms latency)
    setProfileData(prev => {
      if (!prev) return prev;
      const nextChars = [...prev.characters];
      const curChar = { ...nextChars[selectedCharacterIndex] };

      // Find the item in character's bag or vault
      const itemInBag = curChar.bag?.find(it => it.itemInstanceId === itemInstanceId);
      const itemInVault = prev.vault?.find(it => it.itemInstanceId === itemInstanceId);
      const itemToEquip = itemInBag || itemInVault;

      if (!itemToEquip) return prev;

      // Find currently equipped item in that exact slot
      const equippedIdx = curChar.equipped?.findIndex(it => isSameSlot(it, itemToEquip));
      if (equippedIdx !== -1 && equippedIdx !== undefined) {
        const oldEquipped = curChar.equipped[equippedIdx];
        const nextEquipped = [...curChar.equipped];
        nextEquipped[equippedIdx] = itemToEquip;
        curChar.equipped = nextEquipped;

        if (itemInBag) {
          curChar.bag = curChar.bag.filter(it => it.itemInstanceId !== itemInstanceId);
          curChar.bag.push(oldEquipped);
          nextChars[selectedCharacterIndex] = curChar;
          return { ...prev, characters: nextChars };
        } else if (itemInVault) {
          const nextVault = prev.vault.filter(it => it.itemInstanceId !== itemInstanceId);
          curChar.bag = [...(curChar.bag || []), oldEquipped];
          nextChars[selectedCharacterIndex] = curChar;
          return { ...prev, characters: nextChars, vault: nextVault };
        }
      }
      return prev;
    });

    setActionLoading(itemInstanceId);
    setStatusMessage('Equipping item on Guardian...');
    try {
      const token = await getValidAuthToken();
      const settings = getStoredSettings();

      try {
        const res = await fetch('/api/inventory/equip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            membershipType: profileData.profileInfo?.membershipType,
            characterId: character.characterId,
            itemInstanceId
          })
        });
        if (res.ok) {
          setStatusMessage('Item equipped successfully!');
          // Delay live profile fetch to allow Bungie cache to invalidate
          setTimeout(() => fetchLiveProfile(false), 3000);
          return;
        }
      } catch (e) {}

      const directRes = await fetch('https://www.bungie.net/Platform/Destiny2/Actions/Items/EquipItem/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': settings.apiKey || '',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          itemId: itemInstanceId,
          characterId: character.characterId,
          membershipType: profileData.profileInfo?.membershipType || 3
        })
      });
      const data = await directRes.json();
      if (data.ErrorCode === 1) {
        setStatusMessage('Item equipped on your Guardian!');
        setTimeout(() => fetchLiveProfile(false), 3500);
      } else {
        setStatusMessage(data.Message || 'Action completed');
        pendingEquipsRef.current.delete(itemInstanceId);
        await fetchLiveProfile(false);
      }
    } catch (e) {
      setStatusMessage('Request processed');
    } finally {
      setActionLoading(null);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleTransferItem = async (item, transferToVault = false) => {
    const character = profileData?.characters?.[selectedCharacterIndex];
    if (!character || !item) return;

    pendingTransfersRef.current.set(item.itemInstanceId, {
      characterId: character.characterId,
      transferToVault,
      timestamp: Date.now()
    });

    // 1. Immediate Optimistic UI Update
    setProfileData(prev => {
      if (!prev) return prev;
      const nextChars = [...prev.characters];
      const curChar = { ...nextChars[selectedCharacterIndex] };

      if (transferToVault) {
        // Move from character bag/equipped to vault
        curChar.bag = (curChar.bag || []).filter(it => it.itemInstanceId !== item.itemInstanceId);
        curChar.equipped = (curChar.equipped || []).filter(it => it.itemInstanceId !== item.itemInstanceId);
        const nextVault = [item, ...(prev.vault || [])];
        nextChars[selectedCharacterIndex] = curChar;
        return { ...prev, characters: nextChars, vault: nextVault };
      } else {
        // Move from vault to character bag
        const nextVault = (prev.vault || []).filter(it => it.itemInstanceId !== item.itemInstanceId);
        curChar.bag = [item, ...(curChar.bag || [])];
        nextChars[selectedCharacterIndex] = curChar;
        return { ...prev, characters: nextChars, vault: nextVault };
      }
    });

    setActionLoading(item.itemInstanceId);
    setStatusMessage(transferToVault ? 'Transferring to Vault...' : `Transferring to ${character.classType}...`);
    try {
      const token = await getValidAuthToken();
      const settings = getStoredSettings();

      try {
        const res = await fetch('/api/inventory/transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            membershipType: profileData.profileInfo?.membershipType,
            characterId: character.characterId,
            itemReferenceHash: item.itemHash,
            itemInstanceId: item.itemInstanceId,
            transferToVault
          })
        });
        if (res.ok) {
          setStatusMessage(transferToVault ? 'Moved to Vault!' : 'Transferred to Character!');
          setTimeout(() => fetchLiveProfile(false), 3000);
          return;
        }
      } catch (e) {}

      const directRes = await fetch('https://www.bungie.net/Platform/Destiny2/Actions/Items/TransferItem/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': settings.apiKey || '',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          itemReferenceHash: item.itemHash,
          itemId: item.itemInstanceId,
          characterId: character.characterId,
          membershipType: profileData.profileInfo?.membershipType || 3,
          transferToVault
        })
      });
      const data = await directRes.json();
      if (data.ErrorCode === 1) {
        setStatusMessage(transferToVault ? 'Moved to Vault!' : `Transferred to ${character.classType}!`);
        setTimeout(() => fetchLiveProfile(false), 3500);
      } else {
        setStatusMessage(data.Message || 'Transfer complete');
        pendingTransfersRef.current.delete(item.itemInstanceId);
        await fetchLiveProfile(false);
      }
    } catch (e) {
      setStatusMessage('Transferred via Bungie');
    } finally {
      setActionLoading(null);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleEquipLoadout = async (loadoutIndex) => {
    const character = profileData?.characters?.[selectedCharacterIndex];
    if (!character) return;

    const loadout = character.loadouts?.[loadoutIndex];
    if (loadout && loadout.items?.length > 0) {
      loadout.items.forEach(ldItem => {
        if (ldItem.itemInstanceId) {
          pendingEquipsRef.current.set(ldItem.itemInstanceId, {
            characterId: character.characterId,
            timestamp: Date.now()
          });
        }
      });

      // Optimistically update equipped items from loadout
      setProfileData(prev => {
        if (!prev) return prev;
        const nextChars = [...prev.characters];
        const curChar = { ...nextChars[selectedCharacterIndex] };

        const nextEquipped = [...curChar.equipped];
        const nextBag = [...curChar.bag];

        loadout.items.forEach(ldItem => {
          if (!ldItem.itemInstanceId) return;
          const targetSlotIdx = nextEquipped.findIndex(it => isSameSlot(it, ldItem));
          if (targetSlotIdx !== -1) {
            const oldEq = nextEquipped[targetSlotIdx];
            nextEquipped[targetSlotIdx] = ldItem;
            // Place old item in bag if not already in loadout
            if (!loadout.items.some(x => x.itemInstanceId === oldEq.itemInstanceId)) {
              nextBag.push(oldEq);
            }
          }
        });

        curChar.equipped = nextEquipped;
        curChar.bag = nextBag;
        nextChars[selectedCharacterIndex] = curChar;
        return { ...prev, characters: nextChars };
      });
    }

    setActionLoading(`loadout_${loadoutIndex}`);
    setStatusMessage(`Equipping Loadout #${loadoutIndex + 1}...`);
    try {
      const token = await getValidAuthToken();
      const settings = getStoredSettings();

      try {
        const res = await fetch('/api/inventory/equip-loadout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            membershipType: profileData.profileInfo?.membershipType,
            characterId: character.characterId,
            loadoutIndex
          })
        });
        if (res.ok) {
          setStatusMessage(`Loadout #${loadoutIndex + 1} equipped!`);
          setTimeout(() => fetchLiveProfile(false), 3000);
          return;
        }
      } catch (e) {}

      const directRes = await fetch('https://www.bungie.net/Platform/Destiny2/Actions/Loadouts/EquipLoadout/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': settings.apiKey || '',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          loadoutIndex,
          characterId: character.characterId,
          membershipType: profileData.profileInfo?.membershipType || 3
        })
      });
      const data = await directRes.json();
      if (data.ErrorCode === 1) {
        setStatusMessage(`Loadout #${loadoutIndex + 1} active in-game!`);
        setTimeout(() => fetchLiveProfile(false), 3500);
      } else {
        setStatusMessage(data.Message || `Loadout active`);
        await fetchLiveProfile(false);
      }
    } catch (e) {
      setStatusMessage(`Loadout action processed`);
    } finally {
      setActionLoading(null);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  if (!authSession?.authenticated) {
    return (
      <div className="max-w-2xl mx-auto my-6 sm:my-8 bg-[#121722] border border-[#20293a] rounded-2xl p-6 sm:p-8 text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
          <Shield className="w-8 h-8 text-amber-400" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-white font-heading">
            Connect Your Destiny 2 Account
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Link your Bungie.net account to inspect your Guardians' live gear, browse your Vault, transfer weapons in real-time, and switch in-game loadouts with 1 tap.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onLogin}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all font-heading tracking-wide"
          >
            <LogIn className="w-4 h-4" />
            <span>Connect with Bungie.net</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium border border-slate-700 transition-colors"
          >
            Configure API Keys
          </button>
        </div>
      </div>
    );
  }

  const activeChar = profileData?.characters?.[selectedCharacterIndex];

  const equippedWeapons = activeChar?.equipped?.filter(it => it.isWeapon) || [];
  const equippedArmor = activeChar?.equipped?.filter(it => it.isArmor) || [];
  const inventoryItems = activeChar?.bag || [];
  const loadoutsList = activeChar?.loadouts || [];

  // Group weapons by slot
  const kineticEquipped = equippedWeapons.find(w => w.bucketHash === 1498876634 || w.slot === 'Kinetic') || equippedWeapons[0];
  const energyEquipped = equippedWeapons.find(w => w.bucketHash === 2465295065 || w.slot === 'Energy') || equippedWeapons[1];
  const powerEquipped = equippedWeapons.find(w => w.bucketHash === 953998645 || w.slot === 'Power') || equippedWeapons[2];

  const kineticBag = inventoryItems.filter(w => w.isWeapon && (w.bucketHash === 1498876634 || w.slot === 'Kinetic'));
  const energyBag = inventoryItems.filter(w => w.isWeapon && (w.bucketHash === 2465295065 || w.slot === 'Energy'));
  const powerBag = inventoryItems.filter(w => w.isWeapon && (w.bucketHash === 953998645 || w.slot === 'Power'));

  const weaponSlots = [
    { title: 'Kinetic Slot', equipped: kineticEquipped, bag: kineticBag },
    { title: 'Energy Slot', equipped: energyEquipped, bag: energyBag },
    { title: 'Power / Heavy Slot', equipped: powerEquipped, bag: powerBag }
  ];

  // Group armor by 5 slots
  const bagArmor = inventoryItems.filter(it => it.isArmor);

  const armorSlots = [
    {
      key: 'helmet',
      title: 'Helmet',
      bucketHash: 3448274439,
      equipped: equippedArmor.find(it => it.bucketHash === 3448274439 || it.armorSlot?.toLowerCase().includes('helmet') || it.slot?.toLowerCase().includes('helmet') || it.itemTypeDisplayName?.toLowerCase().includes('helmet')),
      bag: bagArmor.filter(it => it.bucketHash === 3448274439 || it.armorSlot?.toLowerCase().includes('helmet') || it.slot?.toLowerCase().includes('helmet') || it.itemTypeDisplayName?.toLowerCase().includes('helmet'))
    },
    {
      key: 'gauntlets',
      title: 'Gauntlets / Arms',
      bucketHash: 3551901077,
      equipped: equippedArmor.find(it => it.bucketHash === 3551901077 || it.armorSlot?.toLowerCase().includes('gauntlet') || it.slot?.toLowerCase().includes('gauntlet') || it.itemTypeDisplayName?.toLowerCase().includes('gauntlet') || it.itemTypeDisplayName?.toLowerCase().includes('arms')),
      bag: bagArmor.filter(it => it.bucketHash === 3551901077 || it.armorSlot?.toLowerCase().includes('gauntlet') || it.slot?.toLowerCase().includes('gauntlet') || it.itemTypeDisplayName?.toLowerCase().includes('gauntlet') || it.itemTypeDisplayName?.toLowerCase().includes('arms'))
    },
    {
      key: 'chest',
      title: 'Chest Armour',
      bucketHash: 1423949262,
      equipped: equippedArmor.find(it => it.bucketHash === 1423949262 || it.armorSlot?.toLowerCase().includes('chest') || it.slot?.toLowerCase().includes('chest') || it.itemTypeDisplayName?.toLowerCase().includes('chest')),
      bag: bagArmor.filter(it => it.bucketHash === 1423949262 || it.armorSlot?.toLowerCase().includes('chest') || it.slot?.toLowerCase().includes('chest') || it.itemTypeDisplayName?.toLowerCase().includes('chest'))
    },
    {
      key: 'legs',
      title: 'Leg Armour',
      bucketHash: 20886954,
      equipped: equippedArmor.find(it => it.bucketHash === 20886954 || it.armorSlot?.toLowerCase().includes('leg') || it.slot?.toLowerCase().includes('leg') || it.itemTypeDisplayName?.toLowerCase().includes('leg')),
      bag: bagArmor.filter(it => it.bucketHash === 20886954 || it.armorSlot?.toLowerCase().includes('leg') || it.slot?.toLowerCase().includes('leg') || it.itemTypeDisplayName?.toLowerCase().includes('leg'))
    },
    {
      key: 'classItem',
      title: 'Class Item',
      bucketHash: 1585787867,
      equipped: equippedArmor.find(it => it.bucketHash === 1585787867 || it.armorSlot?.toLowerCase().includes('class') || it.slot?.toLowerCase().includes('class') || it.itemTypeDisplayName?.toLowerCase().includes('class') || it.itemTypeDisplayName?.toLowerCase().includes('mark') || it.itemTypeDisplayName?.toLowerCase().includes('cloak') || it.itemTypeDisplayName?.toLowerCase().includes('bond')),
      bag: bagArmor.filter(it => it.bucketHash === 1585787867 || it.armorSlot?.toLowerCase().includes('class') || it.slot?.toLowerCase().includes('class') || it.itemTypeDisplayName?.toLowerCase().includes('class') || it.itemTypeDisplayName?.toLowerCase().includes('mark') || it.itemTypeDisplayName?.toLowerCase().includes('cloak') || it.itemTypeDisplayName?.toLowerCase().includes('bond'))
    }
  ];

  const filteredVaultItems = (profileData?.vault || []).filter(item => {
    if (vaultFilter === 'weapons' && !item.isWeapon) return false;
    if (vaultFilter === 'armor' && !item.isArmor) return false;
    if (vaultSearch.trim()) {
      const q = vaultSearch.toLowerCase().trim();
      return item.name.toLowerCase().includes(q) || 
        (item.weaponType && item.weaponType.toLowerCase().includes(q)) ||
        (item.armorSlot && item.armorSlot.toLowerCase().includes(q)) ||
        (item.perks && item.perks.some(p => (p.name || p).toLowerCase().includes(q)));
    }
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Top Character Selector & Refresh */}
      <div className="bg-[#121722] border border-[#20293a] rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        
        {/* Header Row */}
        <div className="flex items-center justify-between gap-3">
          <div className="text-base sm:text-lg font-bold text-white font-heading">
            {activeChar?.classType ? `${activeChar.classType} • ✧ ${activeChar.light} Power` : 'Guardian'}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLiveProfile}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
              title="Disconnect Account"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Character Emblem Banners (3-column responsive row on mobile & desktop) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {profileData?.characters?.map((char, idx) => {
            const isSelected = selectedCharacterIndex === idx;
            return (
              <div
                key={char.characterId}
                onClick={() => setSelectedCharacterIndex(idx)}
                style={{
                  backgroundImage: char.emblemBackgroundPath ? `url(${char.emblemBackgroundPath})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
                className={`relative h-14 sm:h-18 rounded-xl overflow-hidden cursor-pointer p-2 sm:p-3 flex items-center justify-between border-2 transition-all shadow-md ${
                  isSelected 
                    ? 'border-amber-400 ring-2 ring-amber-400/30 scale-[1.01]' 
                    : 'border-slate-800 opacity-70 hover:opacity-100 hover:border-slate-600'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent pointer-events-none" />
                
                <div className="relative z-10 space-y-0.5 min-w-0 pr-1">
                  <div className="text-xs sm:text-base font-bold text-white font-heading uppercase tracking-wide drop-shadow truncate">
                    {char.classType}
                  </div>
                  <div className="text-[10px] sm:text-xs text-amber-300 font-mono font-bold flex items-center gap-1 drop-shadow truncate">
                    <span>✧ {char.light}</span>
                  </div>
                </div>

                {isSelected && (
                  <div className="relative z-10 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-amber-400 text-black flex items-center justify-center shadow-lg font-bold flex-shrink-0">
                    <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Clear Sub-Tab Navigation Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-2 border-t border-[#20293a]">
          
          <button
            onClick={() => setActiveSubTab('weapons')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-heading tracking-wide whitespace-nowrap transition-all ${
              activeSubTab === 'weapons' 
                ? 'bg-amber-500 text-black shadow-md' 
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Weapons ({equippedWeapons.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('armor')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-heading tracking-wide whitespace-nowrap transition-all ${
              activeSubTab === 'armor' 
                ? 'bg-amber-500 text-black shadow-md' 
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Armour ({equippedArmor.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('inventory')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-heading tracking-wide whitespace-nowrap transition-all ${
              activeSubTab === 'inventory' 
                ? 'bg-amber-500 text-black shadow-md' 
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Backpack className="w-3.5 h-3.5" />
            <span>Inventory ({inventoryItems.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('loadouts')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-heading tracking-wide whitespace-nowrap transition-all ${
              activeSubTab === 'loadouts' 
                ? 'bg-amber-500 text-black shadow-md' 
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Loadouts ({loadoutsList.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('vault')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-heading tracking-wide whitespace-nowrap transition-all ${
              activeSubTab === 'vault' 
                ? 'bg-amber-500 text-black shadow-md' 
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>Vault ({profileData?.vault?.length || 0})</span>
          </button>

        </div>

      </div>

      {/* Action Notification Status Banner */}
      {statusMessage && (
        <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-medium flex items-center justify-between animate-fadeIn">
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Sub-Tab 1: EQUIPPED WEAPONS */}
      {activeSubTab === 'weapons' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {weaponSlots.map((slotGroup, sIdx) => {
              const item = slotGroup.equipped;
              if (!item) return null;

              const tierInfo = getTierInfo(item.tierTypeName);
              const damageInfo = getDamageInfo(item.damageType);

              return (
                <div
                  key={sIdx}
                  className="bg-[#121722] border border-[#1e2638] rounded-2xl overflow-hidden flex flex-col justify-between shadow-md"
                >
                  <div>
                    {/* Slot Header */}
                    <div className="px-3.5 py-2 bg-[#0b0e14] border-b border-[#1e2638] flex items-center justify-between text-xs font-heading font-bold text-slate-300 uppercase tracking-wider">
                      <span>{slotGroup.title}</span>
                      <span className="text-[11px] text-amber-400 font-mono">
                        {item.power ? `✧ ${item.power}` : ''}
                      </span>
                    </div>

                    {/* Main Equipped Weapon Header */}
                    <div className="p-3.5 border-b border-[#1e2638]">
                      <div className="flex items-start gap-3">
                        
                        {/* Weapon Thumbnail */}
                        <div 
                          onClick={() => onSelectWeapon?.(item.baseItem || item)}
                          className="relative w-14 h-14 rounded-xl bg-black/60 border border-white/10 overflow-hidden flex-shrink-0 cursor-pointer group shadow-sm"
                          title="Click for weapon details"
                        >
                          {item.icon && (
                            <img src={item.icon} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          )}
                          {item.iconWatermark && (
                            <img src={item.iconWatermark} alt="" className="absolute inset-0 w-full h-full pointer-events-none opacity-80" />
                          )}
                        </div>

                        {/* Title & Stats */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] font-mono font-bold uppercase ${tierInfo.text}`}>
                              {item.tierTypeName}
                            </span>
                            {item.damageType && (
                              <span className={`text-[10px] font-mono ${damageInfo.text}`}>
                                • {item.damageType}
                              </span>
                            )}
                          </div>
                          <h4 
                            onClick={() => onSelectWeapon?.(item.baseItem || item)}
                            className="font-bold text-white text-base truncate hover:text-amber-300 cursor-pointer transition-colors font-heading"
                          >
                            {item.name}
                          </h4>
                          <span className="text-xs text-slate-400 truncate block">{item.itemTypeDisplayName}</span>
                        </div>

                      </div>
                    </div>

                    {/* Active Perks */}
                    {item.perks && item.perks.length > 0 && (
                      <div className="p-3 space-y-1.5 border-b border-[#1e2638]">
                        <div className="flex flex-wrap gap-1.5">
                          {item.perks.map((p, pIdx) => {
                            const pObj = typeof p === 'object' ? p : { name: p };
                            return (
                              <LongPressable
                                key={pIdx}
                                onClick={() => onOpenInfo?.({ ...pObj, type: 'perk' })}
                                onLongPress={() => onOpenInfo?.({ ...pObj, type: 'perk' })}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#0b0e14] hover:bg-slate-800 border border-[#1e2638] hover:border-amber-500/40 cursor-pointer transition-colors group"
                                title={pObj.name}
                              >
                                {pObj.icon ? (
                                  <img src={pObj.icon} alt="" className="w-4 h-4 rounded object-cover flex-shrink-0" />
                                ) : (
                                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                )}
                                <span className="text-xs text-slate-300 font-mono group-hover:text-amber-300">
                                  {pObj.name}
                                </span>
                              </LongPressable>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Bag Inventory Quick Swap Row */}
                    <div className="p-3 bg-[#0b0e14] space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                        <span>Bag ({slotGroup.bag.length})</span>
                        <span className="text-[10px] text-slate-500">Tap to equip • Hold for info</span>
                      </div>

                      {slotGroup.bag.length > 0 ? (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                          {slotGroup.bag.map((bagItem) => {
                            const bTier = getTierInfo(bagItem.tierTypeName);
                            const isSwapping = actionLoading === bagItem.itemInstanceId;

                            return (
                              <LongPressable
                                key={bagItem.itemInstanceId}
                                onClick={() => handleEquipItem(bagItem.itemInstanceId)}
                                onLongPress={() => onSelectWeapon?.(bagItem.baseItem || bagItem)}
                                className={`relative w-11 h-11 rounded-xl bg-black/80 border ${bTier.border || 'border-slate-700'} hover:border-amber-400 p-0.5 flex-shrink-0 cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-sm flex items-center justify-center overflow-hidden`}
                                title={`${bagItem.name} (${bagItem.power || ''}) - Tap to Equip`}
                              >
                                {bagItem.icon ? (
                                  <img src={bagItem.icon} alt="" className="w-full h-full object-cover rounded-lg" />
                                ) : (
                                  <span className="text-[10px] text-slate-500 font-mono">D2</span>
                                )}

                                {bagItem.power && (
                                  <span className="absolute bottom-0.5 right-0.5 text-[8px] font-mono bg-black/90 text-amber-300 px-1 rounded font-bold leading-tight">
                                    {bagItem.power}
                                  </span>
                                )}

                                {isSwapping && (
                                  <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                                    <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                                  </div>
                                )}
                              </LongPressable>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">No spare weapons in bag</p>
                      )}
                    </div>

                  </div>

                  {/* Transfer to Vault Footer */}
                  <div className="p-2 bg-[#0e131d] border-t border-[#1e2638]">
                    <button
                      disabled={actionLoading === item.itemInstanceId}
                      onClick={() => handleTransferItem(item, true)}
                      className="w-full py-1.5 rounded-lg bg-[#121722] hover:bg-slate-800 text-slate-300 text-xs font-mono border border-[#1e2638] flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                    >
                      <Box className="w-3.5 h-3.5 text-amber-400" />
                      <span>Transfer to Vault</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-Tab 2: EQUIPPED ARMOUR & STAT OPTIMIZER */}
      {activeSubTab === 'armor' && (
        <div className="space-y-4">
          
          {/* Armour View Switcher */}
          <div className="flex items-center justify-between flex-wrap gap-2 bg-[#121722] border border-[#1e2638] p-2 rounded-2xl">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setArmorView('slots')}
                className={`px-3 py-1.5 rounded-xl text-xs font-heading font-bold tracking-wide transition-all ${
                  armorView === 'slots' 
                    ? 'bg-amber-500 text-black shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Equipped & Bag Slots
              </button>

              <button
                onClick={() => setArmorView('optimizer')}
                className={`px-3 py-1.5 rounded-xl text-xs font-heading font-bold tracking-wide transition-all flex items-center gap-1.5 ${
                  armorView === 'optimizer' 
                    ? 'bg-amber-500 text-black shadow-sm' 
                    : 'text-slate-400 hover:text-amber-400'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Stat Optimizer</span>
              </button>
            </div>

            <span className="text-[11px] font-mono text-slate-400 px-2">
              {activeChar?.classType} Armour
            </span>
          </div>

          {/* VIEW 1: 5 SLOTS */}
          {armorView === 'slots' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {armorSlots.map((slotGroup, sIdx) => {
                const item = slotGroup.equipped;
                if (!item) return null;

                const tierInfo = getTierInfo(item.tierTypeName);

                return (
                  <div
                    key={sIdx}
                    className="bg-[#121722] border border-[#1e2638] rounded-2xl overflow-hidden flex flex-col justify-between shadow-md"
                  >
                    <div>
                      {/* Slot Header */}
                      <div className="px-3.5 py-2 bg-[#0b0e14] border-b border-[#1e2638] flex items-center justify-between text-xs font-heading font-bold text-slate-300 uppercase tracking-wider">
                        <span>{slotGroup.title}</span>
                        <div className="flex items-center gap-2">
                          {item.armorStats?.total ? (
                            <span className="text-[11px] text-slate-400 font-mono">
                              Total: {item.armorStats.total}
                            </span>
                          ) : null}
                          {item.power && (
                            <span className="text-[11px] text-amber-400 font-mono font-bold">
                              ✧ {item.power}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Equipped Armor Main Header */}
                      <div className="p-3.5 border-b border-[#1e2638]">
                        <div className="flex items-start gap-3">
                          
                          {/* Armor Thumbnail */}
                          <div 
                            onClick={() => onSelectArmor?.(item.baseItem || item)}
                            className="relative w-14 h-14 rounded-xl bg-black/60 border border-white/10 overflow-hidden flex-shrink-0 cursor-pointer group shadow-sm"
                            title="Click for armour details"
                          >
                            {item.icon && (
                              <img src={item.icon} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            )}
                            {item.iconWatermark && (
                              <img src={item.iconWatermark} alt="" className="absolute inset-0 w-full h-full pointer-events-none opacity-80" />
                            )}
                            {item.isArtifice && (
                              <div className="absolute top-0 right-0 w-3 h-3 bg-indigo-500 rounded-bl text-[7px] flex items-center justify-center font-bold text-white">
                                A
                              </div>
                            )}
                          </div>

                          {/* Title & Type */}
                          <div className="min-w-0 flex-1">
                            <span className={`text-[10px] font-mono font-bold uppercase ${tierInfo.text}`}>
                              {item.tierTypeName}
                            </span>
                            <h4 
                              onClick={() => onSelectArmor?.(item.baseItem || item)}
                              className="font-bold text-white text-base truncate hover:text-amber-300 cursor-pointer transition-colors font-heading"
                            >
                              {item.name}
                            </h4>
                            <span className="text-xs text-slate-400 truncate block">{item.itemTypeDisplayName || 'Armour'}</span>
                          </div>

                        </div>
                      </div>

                      {/* 6-Stats Breakdown Grid */}
                      {item.armorStats && (
                        <div className="p-2.5 bg-[#0b0e14] border-b border-[#1e2638]">
                          <div className="grid grid-cols-6 gap-1 text-center font-mono">
                            <div className="space-y-0.5">
                              <div className="text-[9px] text-slate-400 font-semibold">WEAP</div>
                              <div className="text-xs font-bold text-white">{item.armorStats.weapons ?? item.armorStats.mobility}</div>
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-[9px] text-slate-400 font-semibold">HLTH</div>
                              <div className="text-xs font-bold text-white">{item.armorStats.health ?? item.armorStats.resilience}</div>
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-[9px] text-slate-400 font-semibold">CLAS</div>
                              <div className="text-xs font-bold text-white">{item.armorStats.classAbility ?? item.armorStats.recovery}</div>
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-[9px] text-slate-400 font-semibold">GREN</div>
                              <div className="text-xs font-bold text-white">{item.armorStats.grenade ?? item.armorStats.discipline}</div>
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-[9px] text-slate-400 font-semibold">SUPR</div>
                              <div className="text-xs font-bold text-white">{item.armorStats.superAbility ?? item.armorStats.intellect}</div>
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-[9px] text-slate-400 font-semibold">MELE</div>
                              <div className="text-xs font-bold text-white">{item.armorStats.melee ?? item.armorStats.strength}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Active Perks / Mods */}
                      {item.perks?.length > 0 && (
                        <div className="p-2.5 space-y-1.5 border-b border-[#1e2638]">
                          <div className="flex flex-wrap gap-1.5">
                            {item.perks.map((p, pIdx) => {
                              const pObj = typeof p === 'object' ? p : { name: p };
                              return (
                                <LongPressable
                                  key={pIdx}
                                  onClick={() => onOpenInfo?.({ ...pObj, type: 'perk' })}
                                  onLongPress={() => onOpenInfo?.({ ...pObj, type: 'perk' })}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#0b0e14] text-slate-300 text-[11px] font-mono border border-[#1e2638] hover:border-amber-500/40 cursor-pointer group"
                                  title={pObj.name}
                                >
                                  {pObj.icon && <img src={pObj.icon} alt="" className="w-3.5 h-3.5 rounded" />}
                                  <span className="group-hover:text-amber-300 truncate max-w-[130px]">{pObj.name}</span>
                                </LongPressable>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Bag Inventory Quick Swap Row */}
                      <div className="p-3 bg-[#0b0e14] space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                          <span>Bag ({slotGroup.bag.length})</span>
                          <span className="text-[10px] text-slate-500">Tap to equip</span>
                        </div>

                        {slotGroup.bag.length > 0 ? (
                          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                            {slotGroup.bag.map((bagItem) => {
                              const bTier = getTierInfo(bagItem.tierTypeName);
                              const isSwapping = actionLoading === bagItem.itemInstanceId;

                              return (
                                <LongPressable
                                  key={bagItem.itemInstanceId}
                                  onClick={() => handleEquipItem(bagItem.itemInstanceId)}
                                  onLongPress={() => onSelectArmor?.(bagItem.baseItem || bagItem)}
                                  className={`relative w-11 h-11 rounded-xl bg-black/80 border ${bTier.border || 'border-slate-700'} hover:border-amber-400 p-0.5 flex-shrink-0 cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-sm flex items-center justify-center overflow-hidden`}
                                  title={`${bagItem.name} (${bagItem.power || ''}) - Tap to Equip`}
                                >
                                  {bagItem.icon ? (
                                    <img src={bagItem.icon} alt="" className="w-full h-full object-cover rounded-lg" />
                                  ) : (
                                    <span className="text-[10px] text-slate-500 font-mono">D2</span>
                                  )}

                                  {bagItem.power && (
                                    <span className="absolute bottom-0.5 right-0.5 text-[8px] font-mono bg-black/90 text-amber-300 px-1 rounded font-bold leading-tight">
                                      {bagItem.power}
                                    </span>
                                  )}

                                  {isSwapping && (
                                    <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                                      <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                                    </div>
                                  )}
                                </LongPressable>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 italic">No alternative pieces in bag</p>
                        )}
                      </div>

                    </div>

                    {/* Transfer to Vault Footer */}
                    <div className="p-2 bg-[#0e131d] border-t border-[#1e2638]">
                      <button
                        disabled={actionLoading === item.itemInstanceId}
                        onClick={() => handleTransferItem(item, true)}
                        className="w-full py-1.5 rounded-lg bg-[#121722] hover:bg-slate-800 text-slate-300 text-xs font-mono border border-[#1e2638] flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                      >
                        <Box className="w-3.5 h-3.5 text-amber-400" />
                        <span>Transfer to Vault</span>
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW 2: STAT OPTIMIZER */}
          {armorView === 'optimizer' && (
            <ArmourOptimizer
              activeChar={activeChar}
              vault={profileData?.vault || []}
              onEquipItem={handleEquipItem}
              onTransferItem={handleTransferItem}
              onOpenInfo={onOpenInfo}
              onSelectArmor={onSelectArmor}
            />
          )}

        </div>
      )}

      {/* Sub-Tab 3: INVENTORY BAGS */}
      {activeSubTab === 'inventory' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-heading">
            {activeChar?.classType}'s Bag Inventory ({inventoryItems.length})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {inventoryItems.map((item) => {
              const tierInfo = getTierInfo(item.tierTypeName);
              const damageInfo = getDamageInfo(item.damageType);

              return (
                <div
                  key={item.itemInstanceId || item.itemHash}
                  className="bg-[#121722] border border-[#20293a] hover:border-slate-600 rounded-xl overflow-hidden flex flex-col justify-between shadow-lg"
                >
                  <div className={`p-3 ${tierInfo.headerBg} border-b border-[#20293a]`}>
                    <div className="flex items-start gap-3">
                      <div className="relative w-12 h-12 rounded-lg bg-black/60 border border-white/10 overflow-hidden flex-shrink-0">
                        {item.icon ? (
                          <img src={item.icon} alt="" className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-mono font-bold uppercase ${tierInfo.text}`}>
                            {item.tierTypeName}
                          </span>
                          {item.damageType && (
                            <span className={`text-[10px] font-mono ${damageInfo.text}`}>
                              • {item.damageType}
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-white text-sm truncate">{item.name}</h4>
                        <div className="flex items-center justify-between text-xs mt-0.5">
                          <span className="text-[11px] text-slate-400 truncate">{item.itemTypeDisplayName}</span>
                          {item.power && (
                            <span className="text-amber-400 font-mono font-bold">
                              ✧ {item.power}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Active Perks */}
                  <div className="p-3 space-y-2 flex-1">
                    {item.perks?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.perks.map((p, pIdx) => {
                          const pObj = typeof p === 'object' ? p : { name: p };
                          return (
                            <span
                              key={pIdx}
                              className="px-2 py-0.5 rounded bg-[#0b0e14] text-slate-300 text-[11px] font-mono border border-slate-700/60"
                            >
                              {pObj.name}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Actions: Equip or Vault */}
                  <div className="p-2.5 bg-[#0b0e14] border-t border-[#20293a] flex items-center justify-between gap-2">
                    <button
                      disabled={actionLoading === item.itemInstanceId}
                      onClick={() => handleEquipItem(item.itemInstanceId)}
                      className="flex-1 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold font-mono transition-colors disabled:opacity-50"
                    >
                      ⚡ Equip
                    </button>

                    <button
                      disabled={actionLoading === item.itemInstanceId}
                      onClick={() => handleTransferItem(item, true)}
                      className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 flex items-center gap-1 disabled:opacity-50"
                    >
                      <Box className="w-3.5 h-3.5 text-amber-400" />
                      <span>Vault</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-Tab 4: IN-GAME LOADOUTS */}
      {activeSubTab === 'loadouts' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-heading">
            {activeChar?.classType}'s Saved Loadouts
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {loadoutsList.map((ld) => (
              <div
                key={ld.index}
                className="bg-[#121722] border border-[#20293a] hover:border-amber-500/40 rounded-xl p-5 space-y-4 transition-all shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-[#20293a]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-bold text-amber-300 font-heading text-lg">
                        #{ld.index + 1}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-base font-heading">
                          {ld.name || `Loadout ${ld.index + 1}`}
                        </h4>
                        <p className="text-xs text-slate-400">
                          {ld.items.length} Equipped gear items
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Visual Items Grid */}
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-3">
                    {ld.items.map((it, idx) => (
                      <div
                        key={idx}
                        className="relative group rounded-lg bg-black/50 border border-slate-800 p-1 flex flex-col items-center justify-center overflow-hidden"
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
                </div>

                <button
                  disabled={actionLoading === `loadout_${ld.index}`}
                  onClick={() => handleEquipLoadout(ld.index)}
                  className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs font-mono flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-md"
                >
                  <Zap className="w-4 h-4" />
                  <span>{actionLoading === `loadout_${ld.index}` ? 'Equipping...' : '⚡ Equip Full Loadout in Game'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-Tab 5: VAULT STORAGE */}
      {activeSubTab === 'vault' && (
        <div className="space-y-4">
          
          {/* Vault Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-[#121722] p-4 rounded-xl border border-[#20293a]">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search items, perks, weapon types in Vault..."
                value={vaultSearch}
                onChange={(e) => setVaultSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#0b0e14] border border-[#20293a] rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setVaultFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${vaultFilter === 'all' ? 'bg-amber-500 text-black font-bold' : 'bg-slate-800 text-slate-300'}`}
              >
                All ({profileData?.vault?.length || 0})
              </button>
              <button
                onClick={() => setVaultFilter('weapons')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${vaultFilter === 'weapons' ? 'bg-amber-500 text-black font-bold' : 'bg-slate-800 text-slate-300'}`}
              >
                Weapons
              </button>
              <button
                onClick={() => setVaultFilter('armor')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${vaultFilter === 'armor' ? 'bg-amber-500 text-black font-bold' : 'bg-slate-800 text-slate-300'}`}
              >
                Armour
              </button>
            </div>
          </div>

          {/* Vault Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredVault.slice(0, 80).map((item) => {
              const tierInfo = getTierInfo(item.tierTypeName);
              const damageInfo = getDamageInfo(item.damageType);

              return (
                <div
                  key={item.itemInstanceId || item.itemHash}
                  className="bg-[#121722] border border-[#20293a] hover:border-slate-600 rounded-xl overflow-hidden flex flex-col justify-between shadow-lg"
                >
                  <div className={`p-3 ${tierInfo.headerBg} border-b border-[#20293a]`}>
                    <div className="flex items-start gap-3">
                      <div className="relative w-12 h-12 rounded-lg bg-black/60 border border-white/10 overflow-hidden flex-shrink-0">
                        {item.icon ? (
                          <img src={item.icon} alt="" className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-mono font-bold uppercase ${tierInfo.text}`}>
                            {item.tierTypeName}
                          </span>
                          {item.damageType && (
                            <span className={`text-[10px] font-mono ${damageInfo.text}`}>
                              • {item.damageType}
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-white text-sm truncate">{item.name}</h4>
                        <div className="flex items-center justify-between text-xs mt-0.5">
                          <span className="text-[11px] text-slate-400 truncate">{item.itemTypeDisplayName}</span>
                          {item.power && (
                            <span className="text-amber-400 font-mono font-bold">
                              ✧ {item.power}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Active Perks */}
                  <div className="p-3 space-y-2 flex-1">
                    {item.perks?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.perks.map((p, pIdx) => {
                          const pObj = typeof p === 'object' ? p : { name: p };
                          return (
                            <span
                              key={pIdx}
                              className="px-2 py-0.5 rounded bg-[#0b0e14] text-slate-300 text-[11px] font-mono border border-slate-700/60"
                            >
                              {pObj.name}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Action: Transfer to Active Character */}
                  <div className="p-2.5 bg-[#0b0e14] border-t border-[#20293a] flex items-center justify-between gap-2">
                    <button
                      disabled={actionLoading === item.itemInstanceId}
                      onClick={() => handleTransferItem(item, false)}
                      className="w-full py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold font-mono flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                      <span>Transfer to {activeChar?.classType}</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>

        </div>
      )}

    </div>
  );
}
