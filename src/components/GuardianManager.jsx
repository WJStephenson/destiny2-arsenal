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
  ExternalLink, 
  Search, 
  Filter, 
  Info,
  Plus,
  Flame
} from 'lucide-react';
import { getDamageInfo, getTierInfo } from '../utils/destiny-helpers';
import {
  ITEM_STATE_MASTERWORK,
  STAT_KEYS,
  STAT_META,
  STAT_MAX,
  OVERCHARGE_THRESHOLD,
  normaliseStats,
  statTier
} from '../utils/armor-stats';
import { ensureApiKey, getStoredAuthSession, getValidAuthToken } from '../utils/auth-storage';
import { getItemDefinition, batchResolveItemDefinitions } from '../utils/item-definition-cache';
import { batchResolveSetDefinitions } from '../utils/set-definition-cache';
import { getClientItemByHash, getClientItemByName, initClientManifest } from '../utils/client-manifest';
import { describesSameItem } from '../utils/definition-match';
import { findItemLocation } from '../utils/destiny-inventory-actions';
import {
  ARMOR_BUCKET_HASHES,
  WEAPON_BUCKET_HASHES,
  ARMOR_SLOT_KEYS,
  WEAPON_SLOT_KEYS,
  SLOT_LABELS,
  SUBCLASS_BUCKET_HASH,
  equipSlotKey,
  isSameSlot,
  isSubclassItem,
  slotKeyFromBucketHash
} from '../utils/destiny-buckets';
import { buildSubclassModel, applyPlugToModel, insertPlug } from '../utils/subclass';
import useSwipeNavigation from '../utils/useSwipeNavigation';
import useCenteredChip from '../utils/useCenteredChip';
import LongPressable from './LongPressable';
import PerkIcon from './PerkIcon';
import ArmourOptimizer from './ArmourOptimizer';
import SlotPickerModal from './SlotPickerModal';
import SubclassPanel from './SubclassPanel';
import LoadoutsPanel from './LoadoutsPanel';

/**
 * The Guardian screen's own tabs, in the order a thumb swipes through them:
 * what you shoot with, what you wear, what you cast, and then the two ways of
 * moving all of it around.
 */
const SUB_TABS = ['weapons', 'armor', 'class', 'loadouts', 'vault'];

/**
 * The order subclass plugs have to be applied in.
 *
 * Fragments last: their slots only exist once the Aspects granting them are
 * fitted, so a Fragment sent first is a Fragment the game refuses.
 */
const PLUG_APPLY_ORDER = { super: 0, classAbility: 1, movement: 1, melee: 1, grenade: 1, aspect: 2, fragment: 3 };
const plugApplyOrder = (role) => PLUG_APPLY_ORDER[role] ?? 1;

/** Card headings, which read a little differently from the bare slot names. */
const WEAPON_SLOT_TITLES = {
  kinetic: 'Kinetic Slot',
  energy: 'Energy Slot',
  power: 'Power / Heavy Slot'
};

const ARMOR_SLOT_TITLES = {
  helmet: 'Helmet',
  gauntlets: 'Gauntlets / Arms',
  chest: 'Chest Armour',
  legs: 'Leg Armour',
  classItem: 'Class Item'
};

/**
 * The six armour stat hashes. Bungie renamed these stats without changing
 * their hashes, so the same identifiers now mean Weapons, Health, Class,
 * Grenade, Super and Melee -- these are the manifest's Mobility, Resilience,
 * Recovery, Discipline, Intellect and Strength hashes, in that order.
 *
 * A wrong hash here is silent: the instance simply has no entry under it, so
 * the stat reads 0 on every piece of armour rather than failing outright.
 */
const STAT_HASHES = [
  { hash: 2996146975, name: 'Weapons' },
  { hash: 392767087, name: 'Health' },
  { hash: 1943323491, name: 'Class' },
  { hash: 1735777505, name: 'Grenade' },
  { hash: 144602215, name: 'Super' },
  { hash: 4244567218, name: 'Melee' }
];

/**
 * How long a confirmed action outranks the profile Bungie sends back. Their
 * profile endpoint can serve a cached response for a few seconds after an
 * action lands; past this window, whatever Bungie reports is the truth.
 */
const CONFIRMED_ACTION_HOLD_MS = 20000;

/**
 * How stale a profile has to be before returning to the app re-reads it. Gear
 * moves in the game while this sits in the background, so coming back to a
 * profile older than this is coming back to a lie.
 */
const STALE_PROFILE_MS = 30000;

export default function GuardianManager({ 
  onSelectWeapon, 
  onSelectArmor,
  onOpenSettings,
  authSession,
  onLogin,
  onLogout,
  onOpenInfo,
  profileData: externalProfileData,
  onProfileDataChange
}) {
  const [profileData, setProfileData] = useState(() => externalProfileData || null);
  const [selectedCharacterIndex, setSelectedCharacterIndex] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState('weapons'); // 'weapons' | 'armor' | 'inventory' | 'loadouts' | 'vault'
  const [armorView, setArmorView] = useState('slots'); // 'slots' | 'optimizer'
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [vaultSearch, setVaultSearch] = useState('');
  // The vault is only ever browsed as gear, so there is no 'everything'
  // setting -- consumables and materials are not what this screen is for.
  const [vaultFilter, setVaultFilter] = useState('weapons'); // 'weapons' | 'armor'
  const [vaultPickerSlot, setVaultPickerSlot] = useState(null); // { key, title, bag, equipped }

  /**
   * Left and right swipes move between these tabs on a phone.
   *
   * Declared up here with the other hooks: this component returns early when
   * nobody is signed in, and a hook below that line would change the hook
   * order between the signed-out and signed-in renders.
   */
  const { direction: swipeDirection, swipeHandlers, selectTab } = useSwipeNavigation({
    tabs: SUB_TABS,
    activeTab: activeSubTab,
    onChange: setActiveSubTab
  });

  /** The tab bar scrolls sideways; the tab you are on stays in the middle of it. */
  const tabBarRef = useCenteredChip(activeSubTab);

  /**
   * Arriving at a tab should show the top of it.
   *
   * Swiping from the bottom of a long tab into a short one otherwise lands
   * somewhere past its end, on empty space. This only ever pulls the page up to
   * the panel -- someone already reading the top is left where they are.
   */
  const panelRef = useRef(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    // Clear of the sticky header, which would otherwise cover the first card.
    const top = panel.getBoundingClientRect().top + window.scrollY - 88;
    if (window.scrollY > top) {
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  }, [activeSubTab]);

  /**
   * The profile as it stands right now, for the action handlers.
   *
   * A handler held by a child -- the optimizer runs a whole build's worth of
   * actions through the same captured callbacks -- would otherwise keep reading
   * the snapshot from the render it was created in, and act on gear that has
   * already moved.
   */
  const profileDataRef = useRef(null);

  /** Identifies the most recent write, so a rollback can tell it is still the top of the stack. */
  const lastWriteRef = useRef(null);

  const setProfile = (updater, token = {}) => setProfileData(prev => {
    const next = typeof updater === 'function' ? updater(prev) : updater;
    if (next !== prev) {
      profileDataRef.current = next;
      lastWriteRef.current = token;
      onProfileDataChange?.(next);
    }
    return next;
  });

  // Sync when external profileData updates (e.g. from WeaponModal / ArmorModal transfers)
  useEffect(() => {
    if (externalProfileData && externalProfileData !== profileDataRef.current) {
      setProfileData(externalProfileData);
      profileDataRef.current = externalProfileData;
    }
  }, [externalProfileData]);

  // Confirmed-action trackers. Bungie's profile endpoint can serve a cached
  // response for a few seconds after an action lands, so a *confirmed* change
  // is held over the next refetch to stop the UI flicking back. Entries are
  // only ever added after Bungie reports success -- holding an unconfirmed
  // action here would show the player something that never happened.
  const pendingEquipsRef = useRef(new Map());
  const pendingTransfersRef = useRef(new Map());
  const refreshTimerRef = useRef(null);
  const statusTimerRef = useRef(null);
  const lastFetchAtRef = useRef(0);

  /**
   * Re-read the profile shortly after an action, then once more a little later.
   * The first pass usually wins; the second covers a slow cache invalidation.
   */
  const scheduleProfileRefresh = () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      fetchLiveProfile(false);
      refreshTimerRef.current = setTimeout(() => fetchLiveProfile(false), 6000);
    }, 2000);
  };

  useEffect(() => () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
  }, []);

  useEffect(() => {
    if (authSession?.authenticated) {
      fetchLiveProfile(true);
    }
  }, [authSession]);

  // Coming back to the app after playing: re-read anything that has gone stale.
  useEffect(() => {
    if (!authSession?.authenticated) return undefined;

    const refreshIfStale = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastFetchAtRef.current < STALE_PROFILE_MS) return;
      fetchLiveProfile(false);
    };

    document.addEventListener('visibilitychange', refreshIfStale);
    window.addEventListener('focus', refreshIfStale);
    return () => {
      document.removeEventListener('visibilitychange', refreshIfStale);
      window.removeEventListener('focus', refreshIfStale);
    };
  }, [authSession]);

  const fetchLiveProfile = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    lastFetchAtRef.current = Date.now();
    // Item definitions are read straight from Bungie on either route, so the
    // key has to be in place before anything is enriched.
    await ensureApiKey();
    // And the bundled manifest has to be in memory, or every item is a cache
    // miss and goes out to Bungie one hash at a time -- thousands of requests,
    // rate limits, and a screen full of nameless tiles. It loads once and is
    // shared, so this is a wait only on the very first profile read.
    await initClientManifest();
    try {
      // 1. A local server, if one is running, fetches the profile with its own
      //    credentials. It hands back Bungie's own payload, so both routes end
      //    up in the same enrichment and the same reconciliation below.
      try {
        const res = await fetch(`/api/inventory/profile?_ts=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data?.characters?.data) {
            await parseAndEnrichDirectBungieProfile(data);
            if (showLoading) setLoading(false);
            return;
          }
        }
      } catch (e) {}

      // 2. Otherwise ask Bungie directly, cache-busted.
      const token = await getValidAuthToken();
      const settings = await ensureApiKey();
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
        // 310 carries the plug options a player has actually unlocked for
        // their subclass.
        const components = '100,102,200,201,205,206,300,304,305,310';
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
    // What a subclass socket will take. Bungie sends this per item, and the
    // plug sets are the same answer from the profile's side; whichever arrives
    // is what the Class screen offers.
    const reusablePlugsMap = data.itemComponents?.reusablePlugs?.data || {};
    const profilePlugSets = data.profilePlugSets?.data?.plugs || {};
    const characterPlugSetsMap = data.characterPlugSets?.data || {};

    // Bind the vault list back onto the payload so the reconciliation below and
    // the vault built further down are the same array -- otherwise a profile
    // with no vault component silently drops every reconciled move.
    if (!data.profileInventory) data.profileInventory = { data: { items: [] } };
    if (!data.profileInventory.data) data.profileInventory.data = { items: [] };
    if (!data.profileInventory.data.items) data.profileInventory.data.items = [];
    const rawVault = data.profileInventory.data.items;

    // Hold confirmed actions over a stale cached profile.
    const now = Date.now();
    for (const [instId, entry] of pendingEquipsRef.current.entries()) {
      if (now - entry.timestamp > CONFIRMED_ACTION_HOLD_MS) {
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
      if (now - entry.timestamp > CONFIRMED_ACTION_HOLD_MS) {
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

    // Only ask Bungie for what the bundled manifest cannot already answer.
    // There is no bulk definition endpoint -- it is one request per hash -- and
    // a full vault plus every visible socket plug runs to thousands of them,
    // fired again on every refresh. That is what gets a profile rate-limited,
    // and a rate-limited profile is one full of nameless, iconless tiles.
    const unresolvedHashes = allHashesToResolve.filter(h => !getClientItemByHash(h));
    const defs = await batchResolveItemDefinitions(unresolvedHashes);

    // Armour points at its set by hash only, so the set's name and its
    // 2-piece / 4-piece bonuses have to be resolved separately -- otherwise
    // the optimizer can group a set but not say what it is.
    const setDefs = await batchResolveSetDefinitions(
      [
        ...Object.values(defs).map(d => d?.setHash),
        // Bundled entries are no longer fetched from Bungie, so their sets have
        // to be gathered here or armour the bundle resolves would lose its set
        // bonuses.
        ...allHashesToResolve.map(h => getClientItemByHash(h)?.setHash)
      ].filter(h => h !== null && h !== undefined)
    );

    function enrichItem(it) {
      const hash = it.itemHash;
      const liveDef = defs[hash] || null;

      // The bundled manifest is richer than the live definition, so it is
      // preferred -- but only when it is describing the same item. A hash is
      // exact; a name is not. Names repeat across slots ('Ankaa Seeker IV' names
      // an entire set) and across classes ('Arms of Optimacy' exists three
      // times), so a name match is only trusted once it has been corroborated
      // against the live definition.
      const localByHash = getClientItemByHash(hash);
      let localDef = localByHash;
      if (!localDef && liveDef?.name) {
        const byName = getClientItemByName(liveDef.name);
        if (describesSameItem(byName, liveDef)) localDef = byName;
      }

      const def = localDef || liveDef || {};
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

      // Where this item equips, regardless of where it is stored -- the one
      // thing a vault item's own bucketHash (the vault) cannot say. Both a
      // hash-matched bundle entry and the live definition are keyed by this
      // item's hash, so either is exact; a name-matched entry is the last
      // resort, because it is the only one that could be describing a
      // different piece of gear.
      const equipBucketHash = localByHash?.bucketTypeHash
        ?? liveDef?.bucketTypeHash
        ?? localDef?.bucketTypeHash
        ?? null;

      // Slot detection. The definition's bucket is authoritative because a
      // vault item's own bucketHash is the vault, not its equipment slot.
      let detectedSlot = def.slot;
      if (!detectedSlot) {
        const bucketSlot = slotKeyFromBucketHash(it.bucketHash) || slotKeyFromBucketHash(equipBucketHash);
        if (WEAPON_SLOT_KEYS.includes(bucketSlot)) detectedSlot = SLOT_LABELS[bucketSlot];
      }

      // Artifice armour carries an extra +3 mod slot, which the optimizer needs
      // to know about. The bundled manifest flags it directly; otherwise the
      // artifice intrinsic shows up as a socket plug on the instance.
      const isArtifice = def.isArtifice === true
        || perks.some(p => (p.name || '').toLowerCase().includes('artifice'));

      // Bungie ItemState is a bitmask; bit 2 marks a masterworked instance.
      const isMasterwork = ((it.state || 0) & ITEM_STATE_MASTERWORK) !== 0;

      // Which Guardian can wear it. The hash-keyed sources answer for this
      // item; a name match is only read when neither of them did, since the
      // same armour name is shared by all three classes often enough to send a
      // piece to the wrong Guardian's pool.
      // 'Any' means the piece is not class-locked (class items aside), so keep
      // it null rather than filtering the piece out of every Guardian's pool.
      const resolvedClassType = localByHash?.classType ?? liveDef?.classType ?? def.classType;
      const classType = resolvedClassType && resolvedClassType !== 'Any' ? resolvedClassType : null;

      const armorSet = def.setHash !== null && def.setHash !== undefined
        ? setDefs[String(def.setHash)]
        : null;

      // Armour stats. Bungie kept the original stat hashes through the rename,
      // so these are still the six armour stats -- now Weapons, Health, Class,
      // Grenade, Super and Melee. Live instance stats win; the definition's
      // stat list is the fallback for anything without an instance.
      const rawStats = it.itemInstanceId ? statsMap[it.itemInstanceId]?.stats : null;
      let armorStats = null;
      if (rawStats) {
        armorStats = normaliseStats(
          STAT_HASHES.map(({ hash, name }) => ({ name, value: rawStats[hash]?.value || 0 }))
        );
      } else if (def.statsList?.length) {
        const fromDef = normaliseStats(def.statsList);
        if (fromDef.total > 0) armorStats = fromDef;
      }

      // What kind of gear this is. Only the live definition says so outright:
      // the bundled manifest keeps weapons and armour in separate lists, so its
      // entries answer through the fields only one kind carries. A character's
      // own bucket settles anything neither answered -- but a stored item's
      // bucket is the vault, which settles nothing, so the slot it equips into
      // has the last word.
      const equipSlot = slotKeyFromBucketHash(equipBucketHash);
      // 'None' is Bungie's way of saying an item has no element, so it is not
      // one.
      const element = def.damageType && def.damageType !== 'None' ? def.damageType : null;
      const isWeapon = !!(def.isWeapon || def.weaponType != null
        || WEAPON_BUCKET_HASHES.includes(it.bucketHash)
        || WEAPON_SLOT_KEYS.includes(equipSlot));
      const isArmor = !!(def.isArmor || def.armorSlot != null
        || ARMOR_BUCKET_HASHES.includes(it.bucketHash)
        || ARMOR_SLOT_KEYS.includes(equipSlot));

      return {
        itemInstanceId: it.itemInstanceId,
        itemHash: it.itemHash,
        bucketHash: it.bucketHash,
        equipBucketHash,
        slot: detectedSlot,
        ammoType: def.ammoType,
        name: def.name || `Item #${hash}`,
        icon: def.icon || null,
        iconWatermark: def.iconWatermark || null,
        screenshot: def.screenshot || null,
        power: inst?.primaryStat?.value || null,
        tierTypeName: def.tierTypeName || 'Legendary',
        // Only weapons have an element -- armour reports 'None', and the
        // bundled manifest does not describe one at all. Defaulting everything
        // to Kinetic put a Kinetic badge on every piece of armour and matched
        // all of it on a search for an element.
        damageType: isWeapon ? (element || 'Kinetic') : element,
        itemTypeDisplayName: def.itemTypeDisplayName || (isWeapon ? 'Weapon' : isArmor ? 'Armour' : ''),
        // The bundled manifest flags neither kind, so these read from the kind
        // resolved above rather than from a flag only the live definition sets
        // -- otherwise every bundled item lost the type it displays and the
        // slot name the picker falls back to.
        weaponType: isWeapon ? (def.weaponType || def.itemTypeDisplayName || null) : null,
        armorSlot: isArmor ? (def.armorSlot || def.itemTypeDisplayName || null) : null,
        isWeapon,
        isArmor,
        isArtifice,
        isMasterwork,
        classType,
        // Set identity, for the optimizer's 2-piece / 4-piece bonus targeting.
        setHash: armorSet?.hash ?? def.setHash ?? null,
        setName: armorSet?.name || def.setName || null,
        setBonuses: armorSet?.bonuses?.length ? armorSet.bonuses : (def.setBonuses || []),
        baseItem: def,
        socketColumns: def.socketColumns || [],
        statsList: def.statsList || [],
        armorStats,
        intrinsic: def.intrinsic || null,
        flavorText: def.flavorText || '',
        sourceString: def.sourceString || '',
        sourceCategory: def.sourceCategory || '',
        seasonNumber: def.seasonNumber ?? null,
        seasonName: def.seasonName || null,
        isCraftable: def.isCraftable || false,
        perks
      };
    }

    const characters = await Promise.all(Object.values(charsMap).map(async char => {
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

      // The subclass lives in a bucket of its own, so it never appears on a
      // weapon or armour card. The ones this Guardian is not running sit in
      // the same bucket in their bag, which is what makes swapping possible.
      const equippedSubclassItem = equipped.find(it => Number(it.bucketHash) === SUBCLASS_BUCKET_HASH) || null;
      const subclassAlternatives = bag.filter(it => Number(it.bucketHash) === SUBCLASS_BUCKET_HASH);

      let subclass = null;
      if (equippedSubclassItem?.itemInstanceId) {
        const instanceId = equippedSubclassItem.itemInstanceId;
        // Only the live definition describes a subclass's sockets -- the
        // bundled manifest carries weapons, armour and perks alone.
        const subclassDef = defs[equippedSubclassItem.itemHash] || null;
        subclass = await buildSubclassModel({
          item: equippedSubclassItem,
          liveSockets: socketsMap[instanceId]?.sockets || [],
          reusablePlugs: reusablePlugsMap[instanceId]?.plugs || null,
          profilePlugSets,
          characterPlugSets: characterPlugSetsMap[charId]?.plugs || null,
          socketEntries: subclassDef?.socketEntries || []
        });
      }

      const loadouts = (loadoutsMap[charId]?.loadouts || []).map((ld, idx) => {
        const rawItems = (ld.items || []).filter(it => it.itemInstanceId && it.itemInstanceId !== '0');

        // A loadout stores its subclass alongside the gear, and its Super,
        // Aspects and Fragments as the plug hashes on that entry -- the only
        // record of what the loadout actually plays like.
        const subclassEntry = rawItems.find(it => {
          const known = instanceMap.get(it.itemInstanceId);
          // An instance that is not on this character any more cannot be
          // looked up, so a long plug list is what identifies it instead:
          // gear carries a handful, a subclass carries a dozen.
          return known ? isSubclassItem(known) : (it.plugItemHashes || []).length > 6;
        }) || null;

        const loadoutItems = rawItems
          .filter(it => it !== subclassEntry)
          .map(it => instanceMap.get(it.itemInstanceId) || {
            itemInstanceId: it.itemInstanceId,
            name: 'Item',
            icon: null,
            tierTypeName: 'Legendary'
          });

        return {
          index: idx,
          // The game names loadouts through a definition rather than a
          // string; the Loadouts screen resolves it.
          name: `Loadout ${idx + 1}`,
          nameHash: ld.nameHash ?? null,
          iconHash: ld.iconHash ?? null,
          colorHash: ld.colorHash ?? null,
          items: loadoutItems,
          subclass: subclassEntry ? instanceMap.get(subclassEntry.itemInstanceId) || null : null,
          subclassPlugHashes: (subclassEntry?.plugItemHashes || []).filter(h => h)
        };
      }).filter(ld => ld.items.length > 0 || ld.subclassPlugHashes.length > 0);

      return {
        characterId: charId,
        classType,
        light: char.light,
        emblemBackgroundPath: char.emblemBackgroundPath ? `https://www.bungie.net${char.emblemBackgroundPath}` : null,
        equipped,
        bag,
        loadouts,
        subclass,
        subclassAlternatives
      };
    }));

    const vault = (data.profileInventory?.data?.items || []).map(enrichItem);

    setProfile({
      profileInfo: data.profile?.data?.userInfo,
            characters,
      vault
    });
  }

  /**
   * Bungie answers every action with HTTP 200 and puts the real verdict in the
   * body, so `res.ok` says nothing about whether the equip actually happened.
   * Reading ErrorCode is the only way to tell success from failure.
   */
  const BUNGIE_SUCCESS = 1;

  const readActionResult = async (res) => {
    let payload = null;
    try {
      payload = await res.json();
    } catch (e) {
      return { ok: false, message: `Bungie returned an unreadable response (${res.status})` };
    }

    if (payload && payload.ErrorCode !== undefined) {
      return {
        ok: payload.ErrorCode === BUNGIE_SUCCESS,
        code: payload.ErrorCode,
        message: payload.Message || payload.ErrorStatus || 'Bungie rejected that action'
      };
    }

    // Our own proxy's error shape, or something unexpected: no Bungie verdict,
    // so the caller should try talking to Bungie directly.
    return { ok: false, message: payload?.error || `Request failed (${res.status})` };
  };

  /**
   * Run an inventory action through the local proxy when it is available and
   * fall back to Bungie directly. Only a response carrying an ErrorCode counts
   * as a verdict; anything else means the proxy could not answer and we should
   * ask Bungie ourselves.
   */
  const runInventoryAction = async ({ proxyPath, proxyBody, directUrl, directBody }) => {
    try {
      const res = await fetch(proxyPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proxyBody)
      });
      const result = await readActionResult(res);
      if (result.code !== undefined) return result;
    } catch (e) {
      // Proxy unreachable (static hosting) -- fall through to Bungie.
    }

    try {
      const token = await getValidAuthToken();
      if (!token) return { ok: false, message: 'Your Bungie.net session expired. Sign in again.' };
      const settings = await ensureApiKey();

      const res = await fetch(directUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': settings.apiKey || '',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(directBody)
      });
      return await readActionResult(res);
    } catch (e) {
      return { ok: false, message: 'Could not reach Bungie.net' };
    }
  };

  /**
   * Edit one character (found by id, not by the currently selected index --
   * the selection can change while a request is in flight) together with the
   * shared vault. Returning false from `fn` abandons the update entirely.
   */
  const withCharacter = (prev, characterId, fn) => {
    const idx = prev.characters?.findIndex(c => c.characterId === characterId);
    if (idx === undefined || idx === -1) return null;

    const draft = {
      ...prev.characters[idx],
      equipped: [...(prev.characters[idx].equipped || [])],
      bag: [...(prev.characters[idx].bag || [])]
    };
    const vault = [...(prev.vault || [])];

    if (fn(draft, vault) === false) return null;

    const characters = [...prev.characters];
    characters[idx] = draft;
    return { ...prev, characters, vault };
  };

  /**
   * Apply an optimistic change and hand back a function that undoes it.
   *
   * The previous state is captured inside the updater rather than from the
   * render-time `profileData`, so an equip that had to pull its piece out of
   * the vault first rolls back to "on the character", not to "still in the
   * vault". The updater always runs before the network round trip resolves.
   */
  const applyOptimistic = (fn) => {
    let previous = null;
    const token = {};
    setProfile(prev => {
      if (!prev) return prev;
      const next = fn(prev);
      if (!next) return prev;
      previous = prev;
      return next;
    }, token);

    return () => {
      // Rewinding to a whole snapshot is only safe while this is still the most
      // recent change. Once another action or a refetch has landed, that state
      // is newer than anything this rollback knows, so leave it alone -- the
      // caller refetches immediately either way.
      if (previous && lastWriteRef.current === token) setProfile(previous);
    };
  };

  /** Does this character already wear a conflicting exotic of the same family? */
  const hasConflictingExotic = (character, item) => {
    if (item.tierTypeName !== 'Exotic') return false;
    return (character.equipped || []).some(other => {
      if (!other || other.itemInstanceId === item.itemInstanceId) return false;
      if (other.tierTypeName !== 'Exotic') return false;
      if (isSameSlot(other, item)) return false; // straight swap, not a conflict
      return (other.isArmor && item.isArmor) || (other.isWeapon && item.isWeapon);
    });
  };

  /**
   * The platform an action has to be addressed to. It comes from the profile
   * we are looking at; the stored session is the fallback. Guessing a platform
   * sends the action to an account that does not exist, so a missing one is an
   * error rather than a default.
   */
  const getMembershipType = () => {
    const fromProfile = profileDataRef.current?.profileInfo?.membershipType;
    if (fromProfile) return fromProfile;
    const session = getStoredAuthSession().session;
    return session?.user?.destinyMemberships?.[0]?.membershipType || null;
  };

  /**
   * Close out an action: clear its spinner and report what happened. `forId`
   * keeps a finishing action from clearing the spinner of one still running.
   */
  const finishAction = (message, forId) => {
    setActionLoading(prev => (forId === undefined || prev === forId ? null : prev));
    setStatusMessage(message);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setStatusMessage(null), 4000);
  };

  /**
   * Move an item between the vault and a character.
   * Resolves to true only when Bungie confirmed the move.
   */
  const transferItemInternal = async (item, transferToVault = false, options = {}) => {
    // `characterId` names the character the move is addressed to, which is not
    // always the one on screen: moving a piece off another Guardian has to be
    // addressed to that Guardian.
    const { chained = false, characterId: addressedTo } = options;
    const profile = profileDataRef.current;
    const character = addressedTo
      ? profile?.characters?.find(c => c.characterId === addressedTo)
      : profile?.characters?.[selectedCharacterIndex];
    if (!character || !item?.itemInstanceId) return false;
    const characterId = character.characterId;

    const membershipType = getMembershipType();
    if (!membershipType) {
      if (!chained) finishAction('Sign in again -- the app does not know which platform to act on.');
      return false;
    }

    // An equipped item cannot be moved to the vault; the game requires it to be
    // unequipped first, and pretending otherwise leaves a hole in the UI.
    if (transferToVault && (character.equipped || []).some(it => it.itemInstanceId === item.itemInstanceId)) {
      finishAction(`Equip something else in that slot before moving ${item.name} to the vault.`);
      return false;
    }

    if (!chained) setActionLoading(item.itemInstanceId);
    setStatusMessage(transferToVault ? `Moving ${item.name} to the vault...` : `Pulling ${item.name} from the vault...`);

    const revert = applyOptimistic(prev => withCharacter(prev, characterId, (char, vault) => {
      const fromBag = char.bag.findIndex(it => it.itemInstanceId === item.itemInstanceId);
      const fromVault = vault.findIndex(it => it.itemInstanceId === item.itemInstanceId);

      if (transferToVault) {
        if (fromBag === -1) return false;
        char.bag.splice(fromBag, 1);
        vault.unshift(item);
      } else {
        if (fromVault === -1) return false;
        vault.splice(fromVault, 1);
        char.bag.unshift(item);
      }
      return true;
    }));

    const result = await runInventoryAction({
      proxyPath: '/api/inventory/transfer',
      proxyBody: {
        membershipType,
        characterId,
        itemReferenceHash: item.itemHash,
        itemInstanceId: item.itemInstanceId,
        transferToVault
      },
      directUrl: 'https://www.bungie.net/Platform/Destiny2/Actions/Items/TransferItem/',
      directBody: {
        itemReferenceHash: item.itemHash,
        itemId: item.itemInstanceId,
        stackSize: 1,
        transferToVault,
        characterId,
        membershipType
      }
    });

    if (!result.ok) {
      // Put the UI back where it was, then confirm against Bungie.
      pendingTransfersRef.current.delete(item.itemInstanceId);
      revert();
      if (!chained) finishAction(result.message, item.itemInstanceId);
      fetchLiveProfile(false);
      return false;
    }

    // Only hold the optimistic state over a refetch once the move is confirmed;
    // otherwise a rejected action would be forced onto the UI until it aged out.
    pendingTransfersRef.current.set(item.itemInstanceId, {
      characterId,
      transferToVault,
      timestamp: Date.now()
    });

    if (!chained) {
      finishAction(
        transferToVault ? `${item.name} moved to the vault.` : `${item.name} pulled to your ${character.classType}.`,
        item.itemInstanceId
      );
      scheduleProfileRefresh();
    }
    return true;
  };

  /**
   * Equip an item on the selected character.
   * Resolves to true only when Bungie confirmed the equip.
   */
  const equipItemInternal = async (itemInstanceId) => {
    const profile = profileDataRef.current;
    const character = profile?.characters?.[selectedCharacterIndex];
    if (!character || !itemInstanceId) return false;
    const characterId = character.characterId;

    const membershipType = getMembershipType();
    if (!membershipType) {
      finishAction('Sign in again -- the app does not know which platform to act on.');
      return false;
    }

    if ((character.equipped || []).some(it => it.itemInstanceId === itemInstanceId)) return true;

    const inBag = (character.bag || []).find(it => it.itemInstanceId === itemInstanceId);
    const inVault = (profile.vault || []).find(it => it.itemInstanceId === itemInstanceId);
    const item = inBag || inVault;

    if (!item) {
      finishAction(`${item.name} has moved. Refreshing...`);
      fetchLiveProfile(false);
      return false;
    }

    setActionLoading(itemInstanceId);

    // Bungie cannot equip straight out of the vault -- the piece has to reach
    // the character's inventory first.
    if (inVault && !inBag) {
      const moved = await transferItemInternal(item, false, { chained: true });
      if (!moved) {
        finishAction(`Could not pull ${item.name} from the vault.`, itemInstanceId);
        return false;
      }
    }

    setStatusMessage(`Equipping ${item.name}...`);

    // Equipping a second exotic makes the game unequip the first, and there is
    // no way to know what it puts in the emptied slot. Rather than invent a
    // state that may be wrong, skip the optimistic step here and let the
    // confirmed refetch show what actually happened.
    const conflicts = hasConflictingExotic(character, item);

    let revert = () => {};
    if (!conflicts) {
      revert = applyOptimistic(prev => withCharacter(prev, characterId, (char, vault) => {
        const slotIdx = char.equipped.findIndex(it => isSameSlot(it, item));
        if (slotIdx === -1) return false;

        const displaced = char.equipped[slotIdx];
        char.equipped[slotIdx] = item;

        const bagIdx = char.bag.findIndex(it => it.itemInstanceId === itemInstanceId);
        if (bagIdx !== -1) char.bag.splice(bagIdx, 1);
        const vaultIdx = vault.findIndex(it => it.itemInstanceId === itemInstanceId);
        if (vaultIdx !== -1) vault.splice(vaultIdx, 1);

        if (displaced) char.bag.unshift(displaced);
        return true;
      }));
    }

    const result = await runInventoryAction({
      proxyPath: '/api/inventory/equip',
      proxyBody: {
        membershipType,
        characterId,
        itemInstanceId
      },
      directUrl: 'https://www.bungie.net/Platform/Destiny2/Actions/Items/EquipItem/',
      directBody: {
        itemId: itemInstanceId,
        characterId,
        membershipType
      }
    });

    if (!result.ok) {
      pendingEquipsRef.current.delete(itemInstanceId);
      revert();
      finishAction(result.message, itemInstanceId);
      fetchLiveProfile(false);
      return false;
    }

    pendingEquipsRef.current.set(itemInstanceId, { characterId, timestamp: Date.now() });
    finishAction(`${item.name} equipped.`, itemInstanceId);
    scheduleProfileRefresh();
    return true;
  };

  const equipLoadoutInternal = async (loadoutIndex) => {
    const profile = profileDataRef.current;
    const character = profile?.characters?.[selectedCharacterIndex];
    if (!character) return false;
    const characterId = character.characterId;

    const membershipType = getMembershipType();
    if (!membershipType) {
      finishAction('Sign in again -- the app does not know which platform to act on.');
      return false;
    }
    // `loadouts` skips empty slots, so the in-game index the API needs is not a
    // position in that list.
    const loadout = character.loadouts?.find(ld => ld.index === loadoutIndex);

    setActionLoading(`loadout_${loadoutIndex}`);
    setStatusMessage(`Equipping ${loadout?.name || `loadout ${loadoutIndex + 1}`}...`);

    let revert = () => {};
    if (loadout?.items?.length) {
      revert = applyOptimistic(prev => withCharacter(prev, characterId, (char) => {
        const incoming = new Set(loadout.items.map(it => it.itemInstanceId));
        loadout.items.forEach(ldItem => {
          if (!ldItem.itemInstanceId) return;
          const slotIdx = char.equipped.findIndex(it => isSameSlot(it, ldItem));
          if (slotIdx === -1) return;
          const displaced = char.equipped[slotIdx];
          char.equipped[slotIdx] = ldItem;
          char.bag = char.bag.filter(it => it.itemInstanceId !== ldItem.itemInstanceId);
          if (displaced && !incoming.has(displaced.itemInstanceId)) char.bag.unshift(displaced);
        });
        return true;
      }));
    }

    const result = await runInventoryAction({
      proxyPath: '/api/inventory/equip-loadout',
      proxyBody: {
        membershipType,
        characterId,
        loadoutIndex
      },
      directUrl: 'https://www.bungie.net/Platform/Destiny2/Actions/Loadouts/EquipLoadout/',
      directBody: {
        loadoutIndex,
        characterId,
        membershipType
      }
    });

    if (!result.ok) {
      (loadout?.items || []).forEach(it => pendingEquipsRef.current.delete(it.itemInstanceId));
      revert();
      finishAction(result.message, `loadout_${loadoutIndex}`);
      fetchLiveProfile(false);
      return false;
    }

    (loadout?.items || []).forEach(it => {
      if (it.itemInstanceId) pendingEquipsRef.current.set(it.itemInstanceId, { characterId, timestamp: Date.now() });
    });
    finishAction(`${loadout?.name || `Loadout ${loadoutIndex + 1}`} equipped.`, `loadout_${loadoutIndex}`);
    scheduleProfileRefresh();
    return true;
  };

  /**
   * Fit a plug to the subclass -- a Super, an ability, an Aspect, a Fragment.
   *
   * Every one of those is the same action against a different socket, so this
   * covers the whole Class screen. The tile changes under the thumb and is put
   * back if Bungie rejects the change.
   */
  const insertPlugInternal = async (socket, option) => {
    const profile = profileDataRef.current;
    const character = profile?.characters?.[selectedCharacterIndex];
    const subclass = character?.subclass;
    if (!character || !subclass?.itemInstanceId) return false;

    const membershipType = getMembershipType();
    if (!membershipType) {
      finishAction('Sign in again -- the app does not know which platform to act on.');
      return false;
    }

    const actionId = `plug_${socket.index}`;
    setActionLoading(actionId);
    setStatusMessage(`Fitting ${option.name}...`);

    const revert = applyOptimistic(prev => {
      const idx = prev.characters?.findIndex(c => c.characterId === character.characterId);
      if (idx === undefined || idx === -1) return null;
      const target = prev.characters[idx];
      if (!target.subclass) return null;

      const characters = [...prev.characters];
      characters[idx] = {
        ...target,
        subclass: applyPlugToModel(target.subclass, socket.index, option)
      };
      return { ...prev, characters };
    });

    const result = await insertPlug({
      membershipType,
      characterId: character.characterId,
      itemInstanceId: subclass.itemInstanceId,
      socketIndex: socket.index,
      plugItemHash: option.hash
    });

    if (!result.ok) {
      revert();
      finishAction(result.message, actionId);
      fetchLiveProfile(false);
      return false;
    }

    finishAction(`${option.name} fitted.`, actionId);
    scheduleProfileRefresh();
    return true;
  };

  /**
   * Put a saved loadout back on: its gear first, then its subclass setup.
   *
   * Aspects go in before Fragments because the Fragment slots only exist once
   * the Aspects that grant them are fitted -- the other order has the game
   * reject every Fragment in the loadout.
   */
  const applyCustomLoadoutInternal = async (loadout) => {
    const profile = profileDataRef.current;
    const character = profile?.characters?.[selectedCharacterIndex];
    if (!character || !loadout) return false;

    const actionId = `custom_${loadout.id}`;
    setActionLoading(actionId);

    let equippedCount = 0;
    let failedCount = 0;

    for (const entry of loadout.items || []) {
      if (!entry.itemInstanceId) continue;
      setStatusMessage(`Equipping ${entry.name}...`);
      const ok = await equipItemInternal(entry.itemInstanceId);
      if (ok) equippedCount += 1;
      else failedCount += 1;
      // Each equip closes out its own spinner; this action is still running.
      setActionLoading(actionId);
    }

    // The subclass has to be the one equipped before its sockets will take
    // anything, and a saved loadout names the instance it was captured from.
    let plugFailures = 0;
    const savedSubclass = loadout.subclass;
    if (savedSubclass?.plugs?.length) {
      const current = profileDataRef.current?.characters?.find(c => c.characterId === character.characterId);
      const wanted = [current?.subclass, ...(current?.subclassAlternatives || [])]
        .find(it => it && String(it.itemHash) === String(savedSubclass.itemHash));

      if (!wanted) {
        finishAction(
          `${loadout.name}: gear equipped, but that subclass is not on this Guardian.`,
          actionId
        );
        scheduleProfileRefresh();
        return equippedCount > 0;
      }

      const alreadyRunning = String(current?.subclass?.itemHash) === String(savedSubclass.itemHash);

      // What that subclass is already wearing, so a loadout that is halfway on
      // does not re-send changes the game has already made.
      const fitted = new Map();
      if (alreadyRunning) {
        (current.subclass.editableSockets || []).forEach(socket => {
          if (socket.plugHash) fitted.set(socket.index, String(socket.plugHash));
        });
      } else {
        setStatusMessage(`Equipping ${savedSubclass.name || 'subclass'}...`);
        await equipItemInternal(wanted.itemInstanceId);
        setActionLoading(actionId);
      }

      const membershipType = getMembershipType();
      const subclassInstanceId = wanted.itemInstanceId;
      const ordered = [...savedSubclass.plugs].sort(
        (a, b) => plugApplyOrder(a.role) - plugApplyOrder(b.role)
      );

      for (const plug of ordered) {
        if (fitted.get(plug.socketIndex) === String(plug.plugHash)) continue;
        setStatusMessage(`Fitting ${plug.name || 'subclass plug'}...`);
        const result = await insertPlug({
          membershipType,
          characterId: character.characterId,
          itemInstanceId: subclassInstanceId,
          socketIndex: plug.socketIndex,
          plugItemHash: plug.plugHash
        });
        if (!result.ok) plugFailures += 1;
      }
    }

    const problems = [
      failedCount ? `${failedCount} item${failedCount === 1 ? '' : 's'} could not be equipped` : null,
      plugFailures ? `${plugFailures} subclass change${plugFailures === 1 ? '' : 's'} were rejected` : null
    ].filter(Boolean);

    finishAction(
      problems.length
        ? `${loadout.name} applied -- ${problems.join(', ')}.`
        : `${loadout.name} applied.`,
      actionId
    );
    scheduleProfileRefresh();
    return failedCount === 0 && plugFailures === 0;
  };

  /**
   * Inventory actions run one at a time.
   *
   * Each action reads the profile, applies an optimistic change and can roll
   * that change back if Bungie rejects it. Two overlapping actions would each
   * roll back over the other's work, so the UI could show a state neither
   * request produced. Disabling the button only covered the item being acted
   * on, which left every other tile live.
   */
  const actionInFlightRef = useRef(false);

  const runExclusive = async (fn) => {
    if (actionInFlightRef.current) return false;
    actionInFlightRef.current = true;
    try {
      return await fn();
    } finally {
      actionInFlightRef.current = false;
    }
  };

  /**
   * Bring an item to the Guardian on screen, wherever it is now.
   *
   * Out of the vault that is one move. Off another Guardian it is two, because
   * Bungie has no character-to-character transfer: the item goes out to the
   * vault and comes back. Either way the player asked for one thing, so it
   * reports as one action.
   */
  const pullItemInternal = async (item) => {
    const profile = profileDataRef.current;
    const target = profile?.characters?.[selectedCharacterIndex];
    if (!target || !item?.itemInstanceId) return false;

    const source = findItemLocation(item, profile);
    if (!source) {
      finishAction(`${item.name} has moved. Refreshing...`);
      fetchLiveProfile(false);
      return false;
    }

    if (source.character?.characterId === target.characterId) {
      finishAction(`${item.name} is already on your ${target.classType}.`);
      return true;
    }

    // The game will not move a piece someone is wearing.
    if (source.location === 'equipped') {
      finishAction(`${item.name} is equipped on your ${source.character.classType}. Equip something else there first.`);
      return false;
    }

    if (source.location === 'vault') return transferItemInternal(item, false);

    setActionLoading(item.itemInstanceId);
    const stowed = await transferItemInternal(item, true, {
      chained: true,
      characterId: source.character.characterId
    });
    if (!stowed) {
      finishAction(`Could not move ${item.name} off your ${source.character.classType}.`, item.itemInstanceId);
      return false;
    }

    return transferItemInternal(item, false);
  };

  const handlePullItem = (item) => runExclusive(() => pullItemInternal(item));

  const handleTransferItem = (item, transferToVault = false, options = {}) =>
    // A chained pull is already inside an exclusive action.
    options.chained
      ? transferItemInternal(item, transferToVault, options)
      : runExclusive(() => transferItemInternal(item, transferToVault, options));

  const handleEquipItem = (itemInstanceId) => runExclusive(() => equipItemInternal(itemInstanceId));

  const handleEquipLoadout = (loadoutIndex) => runExclusive(() => equipLoadoutInternal(loadoutIndex));

  const handleInsertPlug = (socket, option) => runExclusive(() => insertPlugInternal(socket, option));

  const handleApplyCustomLoadout = (loadout) => runExclusive(() => applyCustomLoadoutInternal(loadout));


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
            Your Guardians' gear, your Vault, and your loadouts.
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

  /**
   * What this Guardian's armour adds up to -- the six totals the character
   * screen shows in game. Every value comes off the live instances: armour
   * definitions carry no stats any more, so a piece that has not been read from
   * the profile contributes nothing rather than a wrong number.
   */
  const armorStatTotals = equippedArmor.reduce((totals, piece) => {
    STAT_KEYS.forEach(key => { totals[key] += piece.armorStats?.[key] || 0; });
    return totals;
  }, Object.fromEntries(STAT_KEYS.map(key => [key, 0])));
  const inventoryItems = activeChar?.bag || [];
  const loadoutsList = activeChar?.loadouts || [];
  const activeSubclass = activeChar?.subclass || null;

  /**
   * One card per equipment slot. The slot comes from the item's own bucket,
   * which is what the game equips against, so a piece can only appear under the
   * card it would actually replace -- and each equipped piece lands in exactly
   * one card instead of being guessed at by position.
   */
  const slotCardKey = (it) => {
    if (!it) return null;
    const key = equipSlotKey(it);
    if (!key) return null;
    // The slot decides the card; the weapon/armour flags only veto a
    // contradiction, so a pipeline that omits them still fills the screen.
    if (ARMOR_SLOT_KEYS.includes(key)) return it.isWeapon ? null : key;
    if (WEAPON_SLOT_KEYS.includes(key)) return it.isArmor ? null : key;
    return null;
  };

  const equippedBySlot = {};
  (activeChar?.equipped || []).forEach(it => {
    const key = slotCardKey(it);
    if (key && !equippedBySlot[key]) equippedBySlot[key] = it;
  });

  const bagBySlot = {};
  inventoryItems.forEach(it => {
    const key = slotCardKey(it);
    if (!key) return;
    if (!bagBySlot[key]) bagBySlot[key] = [];
    bagBySlot[key].push(it);
  });

  const weaponSlots = WEAPON_SLOT_KEYS.map(key => ({
    key,
    title: WEAPON_SLOT_TITLES[key],
    equipped: equippedBySlot[key],
    bag: bagBySlot[key] || []
  }));

  const armorSlots = ARMOR_SLOT_KEYS.map(key => ({
    key,
    title: ARMOR_SLOT_TITLES[key],
    equipped: equippedBySlot[key],
    bag: bagBySlot[key] || []
  }));

  /**
   * The slot card the picker is open on, re-read from this render's cards so
   * the modal counts the space left after each pull instead of the space there
   * was when it opened. A plain lookup, not a memo: it sits below an early
   * return, and the cards are rebuilt every render anyway, so a hook here would
   * change the hook count between the signed-out and signed-in renders and take
   * the whole screen down with it.
   */
  const currentPickerSlotGroup = (() => {
    if (!vaultPickerSlot) return null;
    const key = vaultPickerSlot.key;
    const slots = WEAPON_SLOT_KEYS.includes(key) ? weaponSlots : armorSlots;
    return slots.find(s => s.key === key) || vaultPickerSlot;
  })();

  const vaultWeapons = (profileData?.vault || []).filter(item => item.isWeapon);
  const vaultArmour = (profileData?.vault || []).filter(item => item.isArmor);

  const filteredVaultItems = (vaultFilter === 'armor' ? vaultArmour : vaultWeapons).filter(item => {
    if (vaultSearch.trim()) {
      const q = vaultSearch.toLowerCase().trim();
      // Everything the tile shows is worth searching -- 'solar' names a weapon
      // as usefully as 'hand cannon' does.
      const haystack = [
        item.name,
        item.weaponType,
        item.armorSlot,
        item.itemTypeDisplayName,
        item.damageType,
        item.ammoType,
        item.tierTypeName,
        ...(item.perks || []).map(p => (typeof p === 'string' ? p : p?.name))
      ];
      return haystack.some(field => field && String(field).toLowerCase().includes(q));
    }
    return true;
  });

  return (
    /* A left or right swipe anywhere on this screen moves between the tabs
       below -- except inside a row that scrolls sideways of its own, which
       owns the gesture that started in it. */
    <div className="space-y-6" {...swipeHandlers}>
      
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

        {/* Sub-Tab Navigation Bar. Swipe left or right on a phone to move
            through these in the same order. */}
        <div
          ref={tabBarRef}
          className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-2 border-t border-[#20293a]"
        >

          {SUB_TABS.map(tab => {
            const meta = {
              weapons: { icon: Crosshair, label: `Weapons (${equippedWeapons.length})` },
              armor: { icon: Shield, label: `Armour (${equippedArmor.length})` },
              class: { icon: Flame, label: activeSubclass ? `Class • ${activeSubclass.name}` : 'Class' },
              loadouts: { icon: Zap, label: `Loadouts (${loadoutsList.length})` },
              vault: { icon: Box, label: `Vault (${profileData?.vault?.length || 0})` }
            }[tab];
            const Icon = meta.icon;
            const isActive = activeSubTab === tab;

            return (
              <button
                key={tab}
                data-chip={tab}
                onClick={() => selectTab(tab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-heading tracking-wide whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? '' : 'text-amber-400'}`} />
                <span className="max-w-[10rem] truncate">{meta.label}</span>
              </button>
            );
          })}

        </div>

      </div>

      {/* Action Notification Status Banner */}
      {statusMessage && (
        <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-medium flex items-center justify-between animate-fadeIn">
          <span>{statusMessage}</span>
        </div>
      )}

      {/* The tab panels, sliding in from the side the thumb came from. */}
      <div
        ref={panelRef}
        key={activeSubTab}
        className={swipeDirection === 'left' ? 'animate-slideInLeft' : swipeDirection === 'right' ? 'animate-slideInRight' : ''}
      >

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
                          onClick={() => onSelectWeapon?.(item)}
                          className="relative w-14 h-14 rounded-xl bg-black/60 border border-white/10 overflow-hidden flex-shrink-0 cursor-pointer group shadow-sm"
                          title={item.name}
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
                            onClick={() => onSelectWeapon?.(item)}
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

                    {/* Quick Swap Inventory Row */}
                    <div className="p-3 bg-[#0b0e14] space-y-1.5">
                      <div className="text-xs text-slate-400 font-mono">
                        Inventory ({slotGroup.bag.length}/9)
                      </div>

                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                        {slotGroup.bag.map((bagItem) => {
                          const bTier = getTierInfo(bagItem.tierTypeName);
                          const isSwapping = actionLoading === bagItem.itemInstanceId;
                          // Actions run one at a time, so tiles that are not
                          // the one in flight read as unavailable rather than
                          // silently doing nothing when tapped.
                          const blocked = !!actionLoading && !isSwapping;

                          return (
                            <LongPressable
                              key={bagItem.itemInstanceId}
                              onClick={() => { if (!blocked) handleEquipItem(bagItem.itemInstanceId); }}
                              onLongPress={() => onSelectWeapon?.(bagItem)}
                              className={`relative w-11 h-11 rounded-xl bg-black/80 border ${bTier.border || 'border-slate-700'} p-0.5 flex-shrink-0 transition-all shadow-sm flex items-center justify-center overflow-hidden ${
                                blocked
                                  ? 'opacity-40 cursor-not-allowed'
                                  : 'hover:border-amber-400 cursor-pointer hover:scale-105 active:scale-95'
                              }`}
                              title={bagItem.power ? `${bagItem.name} (${bagItem.power})` : bagItem.name}
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

                        {/* + Option tile if space */}
                        {slotGroup.bag.length < 9 && (
                          <button
                            onClick={() => setVaultPickerSlot(slotGroup)}
                            className="w-11 h-11 rounded-xl bg-[#121722]/80 hover:bg-amber-500/15 border border-dashed border-slate-700 hover:border-amber-500/60 text-slate-400 hover:text-amber-300 p-0.5 flex-shrink-0 transition-all shadow-sm flex flex-col items-center justify-center gap-0.5 cursor-pointer group"
                            title={`Add ${slotGroup.title} from the Vault or another Guardian (${9 - slotGroup.bag.length} spaces left)`}
                          >
                            <Plus className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                            <span className="text-[8px] font-mono leading-none text-slate-400 group-hover:text-amber-300 font-bold">ADD</span>
                          </button>
                        )}
                      </div>
                    </div>

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

          </div>

          {/* The Guardian's armour stats, totalled from what it is wearing. */}
          {armorView === 'slots' && (
            <div className="bg-[#121722] border border-[#1e2638] rounded-2xl p-3 sm:p-4">
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 sm:gap-4">
                {STAT_META.map(st => {
                  const value = armorStatTotals[st.key] || 0;
                  return (
                    <div key={st.key} className="min-w-0">
                      <div className="flex items-baseline justify-between gap-1 font-mono">
                        <span className={`text-[10px] font-bold ${st.text}`}>{st.short}</span>
                        <span className="text-sm font-bold text-white tabular-nums">{value}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full bg-[#0b0e14] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${st.bar}`}
                          style={{ width: `${Math.min(100, (value / STAT_MAX) * 100)}%` }}
                        />
                      </div>
                      <div className="mt-0.5 flex items-center justify-between font-mono text-[9px] text-slate-500">
                        <span className="truncate">{st.label}</span>
                        {/* Past 100 a stat is overcharged and still paying out. */}
                        <span className={value >= OVERCHARGE_THRESHOLD ? 'text-amber-400 font-bold' : ''}>
                          T{statTier(value)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                            onClick={() => onSelectArmor?.(item)}
                            className="relative w-14 h-14 rounded-xl bg-black/60 border border-white/10 overflow-hidden flex-shrink-0 cursor-pointer group shadow-sm"
                            title={item.name}
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
                              onClick={() => onSelectArmor?.(item)}
                              className="font-bold text-white text-base truncate hover:text-amber-300 cursor-pointer transition-colors font-heading"
                            >
                              {item.name}
                            </h4>
                          </div>

                        </div>
                      </div>

                      {/* 6-Stats Breakdown Grid */}
                      {item.armorStats && (
                        <div className="p-2.5 bg-[#0b0e14] border-b border-[#1e2638]">
                          <div className="grid grid-cols-6 gap-1 text-center font-mono">
                            {STAT_META.map(st => (
                              <div key={st.key} className="space-y-0.5">
                                <div className="text-[9px] text-slate-400 font-semibold">{st.short}</div>
                                <div className="text-xs font-bold text-white tabular-nums">{item.armorStats[st.key] ?? 0}</div>
                              </div>
                            ))}
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

                      {/* Quick Swap Inventory Row */}
                      <div className="p-3 bg-[#0b0e14] space-y-1.5">
                        <div className="text-xs text-slate-400 font-mono">
                          Inventory ({slotGroup.bag.length}/9)
                        </div>

                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                          {slotGroup.bag.map((bagItem) => {
                            const bTier = getTierInfo(bagItem.tierTypeName);
                            const isSwapping = actionLoading === bagItem.itemInstanceId;
                            const blocked = !!actionLoading && !isSwapping;

                            return (
                              <LongPressable
                                key={bagItem.itemInstanceId}
                                onClick={() => { if (!blocked) handleEquipItem(bagItem.itemInstanceId); }}
                                onLongPress={() => onSelectArmor?.(bagItem)}
                                className={`relative w-11 h-11 rounded-xl bg-black/80 border ${bTier.border || 'border-slate-700'} p-0.5 flex-shrink-0 transition-all shadow-sm flex items-center justify-center overflow-hidden ${
                                  blocked
                                    ? 'opacity-40 cursor-not-allowed'
                                    : 'hover:border-amber-400 cursor-pointer hover:scale-105 active:scale-95'
                                }`}
                                title={bagItem.power ? `${bagItem.name} (${bagItem.power})` : bagItem.name}
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

                          {/* + Option tile if space */}
                          {slotGroup.bag.length < 9 && (
                            <button
                              onClick={() => setVaultPickerSlot(slotGroup)}
                              className="w-11 h-11 rounded-xl bg-[#121722]/80 hover:bg-amber-500/15 border border-dashed border-slate-700 hover:border-amber-500/60 text-slate-400 hover:text-amber-300 p-0.5 flex-shrink-0 transition-all shadow-sm flex flex-col items-center justify-center gap-0.5 cursor-pointer group"
                              title={`Add ${slotGroup.title} from the Vault or another Guardian (${9 - slotGroup.bag.length} spaces left)`}
                            >
                              <Plus className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                              <span className="text-[8px] font-mono leading-none text-slate-400 group-hover:text-amber-300 font-bold">ADD</span>
                            </button>
                          )}
                        </div>
                      </div>

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
              onOpenInfo={onOpenInfo}
              onSelectArmor={onSelectArmor}
            />
          )}

        </div>
      )}

      {/* Sub-Tab 3: SUBCLASS, ASPECTS & FRAGMENTS */}
      {activeSubTab === 'class' && (
        <SubclassPanel
          subclass={activeSubclass}
          subclassOptions={activeChar?.subclassAlternatives || []}
          onInsertPlug={handleInsertPlug}
          onEquipSubclass={handleEquipItem}
          actionLoading={actionLoading}
          onOpenInfo={onOpenInfo}
        />
      )}

      {/* Sub-Tab 4: IN-GAME & SAVED LOADOUTS */}
      {activeSubTab === 'loadouts' && (
        <LoadoutsPanel
          loadouts={loadoutsList}
          activeChar={activeChar}
          subclass={activeSubclass}
          onEquipLoadout={handleEquipLoadout}
          onApplyCustomLoadout={handleApplyCustomLoadout}
          actionLoading={actionLoading}
          onOpenInfo={onOpenInfo}
        />
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
                onClick={() => setVaultFilter('weapons')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${vaultFilter === 'weapons' ? 'bg-amber-500 text-black font-bold' : 'bg-slate-800 text-slate-300'}`}
              >
                Weapons ({vaultWeapons.length})
              </button>
              <button
                onClick={() => setVaultFilter('armor')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${vaultFilter === 'armor' ? 'bg-amber-500 text-black font-bold' : 'bg-slate-800 text-slate-300'}`}
              >
                Armour ({vaultArmour.length})
              </button>
            </div>
          </div>

          {/* Vault Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredVaultItems.slice(0, 80).map((item) => {
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

                  {/* What the card says about the roll: a weapon is defined by
                      the perks it came out with, a piece of armour by the stats
                      it rolled -- its plugs are mods, which say nothing about
                      whether the piece is worth pulling. */}
                  <div className="p-3 space-y-2 flex-1">
                    {item.isArmor ? (
                      item.armorStats ? (
                        <div className="space-y-1.5">
                          <div className="grid grid-cols-6 gap-1 text-center font-mono">
                            {STAT_META.map(st => (
                              <div key={st.key} className="space-y-0.5" title={st.label}>
                                <div className={`text-[9px] font-semibold ${st.text}`}>{st.short}</div>
                                <div className="text-xs font-bold text-white tabular-nums">{item.armorStats[st.key] ?? 0}</div>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-[#20293a]">
                            <span>TOTAL</span>
                            <span className="text-white font-bold tabular-nums">{item.armorStats.total ?? 0}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] font-mono text-slate-500">Stats unavailable</div>
                      )
                    ) : (
                      item.perks?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.perks.map((p, pIdx) => {
                            const pObj = typeof p === 'object' ? p : { name: p };
                            return (
                              <span
                                key={pIdx}
                                title={pObj.name}
                                className="inline-flex items-center gap-1 pl-1 pr-2 py-0.5 rounded bg-[#0b0e14] text-slate-300 text-[11px] font-mono border border-slate-700/60"
                              >
                                <PerkIcon perk={pObj} className="w-4 h-4" />
                                <span className="truncate max-w-[130px]">{pObj.name}</span>
                              </span>
                            );
                          })}
                        </div>
                      )
                    )}
                  </div>

                  {/* Action: Transfer to Active Character */}
                  <div className="p-2.5 bg-[#0b0e14] border-t border-[#20293a] flex items-center justify-between gap-2">
                    <button
                      disabled={!!actionLoading}
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

      {/* Vault Slot Picker Modal */}
      {currentPickerSlotGroup && (
        <SlotPickerModal
          slotGroup={currentPickerSlotGroup}
          activeChar={activeChar}
          characters={profileData?.characters || []}
          vaultItems={profileData?.vault || []}
          onClose={() => setVaultPickerSlot(null)}
          onTransfer={handlePullItem}
          actionLoading={actionLoading}
          // The live item, not its manifest entry: inspecting from here should
          // show this roll -- its perks, its stats -- and leave the modal able
          // to act on the instance the player is looking at.
          onInspect={(item) => {
            if (item.isWeapon) onSelectWeapon?.(item);
            else if (item.isArmor) onSelectArmor?.(item);
            else onOpenInfo?.(item);
          }}
        />
      )}

    </div>
  );
}
