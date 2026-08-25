import { getStoredAuthSession, getValidAuthToken, ensureApiKey } from './auth-storage';
import { isSameSlot, equipSlotKey, ARMOR_SLOT_KEYS, WEAPON_SLOT_KEYS } from './destiny-buckets';

const BUNGIE_SUCCESS = 1;

/**
 * Read verdict from Bungie API response.
 */
export async function readActionResult(res) {
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

  return { ok: false, message: payload?.error || `Request failed (${res.status})` };
}

/**
 * Platform membership type.
 */
export function getMembershipType(profileData) {
  const fromProfile = profileData?.profileInfo?.membershipType;
  if (fromProfile) return fromProfile;
  const session = getStoredAuthSession()?.session;
  return session?.user?.destinyMemberships?.[0]?.membershipType || null;
}

/**
 * Execute an inventory action via proxy or direct Bungie endpoint.
 */
export async function runInventoryAction({ proxyPath, proxyBody, directUrl, directBody }) {
  try {
    const res = await fetch(proxyPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proxyBody)
    });
    const result = await readActionResult(res);
    if (result.code !== undefined) return result;
  } catch (e) {
    // Proxy unreachable (e.g. static hosting) -- fall through to Bungie direct
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
}

/**
 * Find the location of a specific item instance in the live profile.
 * Returns: { location: 'vault' | 'bag' | 'equipped', character: Object | null }
 */
export function findItemLocation(item, profileData) {
  if (!item || !profileData) return null;
  const instId = item.itemInstanceId;
  if (!instId) return null;

  // Check characters
  for (const char of (profileData.characters || [])) {
    if ((char.equipped || []).some(it => it.itemInstanceId === instId)) {
      return { location: 'equipped', character: char };
    }
    if ((char.bag || []).some(it => it.itemInstanceId === instId)) {
      return { location: 'bag', character: char };
    }
  }

  // Check vault
  if ((profileData.vault || []).some(it => it.itemInstanceId === instId)) {
    return { location: 'vault', character: null };
  }

  return null;
}

/**
 * Find all owned instances of an item (by instanceId or itemHash) in the profile.
 */
export function findOwnedInstances(item, profileData) {
  if (!item || !profileData) return [];
  const targetHash = item.itemHash || item.hash || item.id;
  const instId = item.itemInstanceId;

  const found = [];

  // Check characters
  (profileData.characters || []).forEach(char => {
    (char.equipped || []).forEach(it => {
      if (instId ? it.itemInstanceId === instId : (it.itemHash === targetHash)) {
        found.push({ ...it, location: 'equipped', character: char });
      }
    });
    (char.bag || []).forEach(it => {
      if (instId ? it.itemInstanceId === instId : (it.itemHash === targetHash)) {
        found.push({ ...it, location: 'bag', character: char });
      }
    });
  });

  // Check vault
  (profileData.vault || []).forEach(it => {
    if (instId ? it.itemInstanceId === instId : (it.itemHash === targetHash)) {
      found.push({ ...it, location: 'vault', character: null });
    }
  });

  return found;
}

/**
 * Transfer an item from its current location to a target destination.
 * target: { type: 'vault' } OR { type: 'character', characterId: string, equip?: boolean }
 */
export async function executeItemTransfer({
  item,
  target,
  profileData,
  onOptimisticUpdate
}) {
  if (!item?.itemInstanceId) {
    return { ok: false, message: 'Item cannot be transferred (no instance ID)' };
  }

  const membershipType = getMembershipType(profileData);
  if (!membershipType) {
    return { ok: false, message: 'Sign in again -- could not resolve Bungie platform.' };
  }

  const currentLoc = findItemLocation(item, profileData);
  if (!currentLoc) {
    return { ok: false, message: 'Could not find this item in your live inventory.' };
  }

  const instId = item.itemInstanceId;
  const itemHash = item.itemHash || item.hash;

  // 1. Move to Vault
  if (target.type === 'vault') {
    if (currentLoc.location === 'vault') {
      return { ok: true, message: `${item.name} is already in your Vault.` };
    }
    if (currentLoc.location === 'equipped') {
      return { ok: false, message: `${item.name} is currently equipped on your ${currentLoc.character.classType}. Equip another piece first.` };
    }

    const sourceCharId = currentLoc.character.characterId;

    // Apply optimistic update
    if (onOptimisticUpdate) {
      onOptimisticUpdate(prev => {
        if (!prev) return prev;
        const characters = prev.characters.map(c => {
          if (c.characterId !== sourceCharId) return c;
          return {
            ...c,
            bag: c.bag.filter(it => it.itemInstanceId !== instId)
          };
        });
        const vault = [item, ...(prev.vault || []).filter(it => it.itemInstanceId !== instId)];
        return { ...prev, characters, vault };
      });
    }

    const res = await runInventoryAction({
      proxyPath: '/api/inventory/transfer',
      proxyBody: {
        membershipType,
        characterId: sourceCharId,
        itemReferenceHash: itemHash,
        itemInstanceId: instId,
        transferToVault: true
      },
      directUrl: 'https://www.bungie.net/Platform/Destiny2/Actions/Items/TransferItem/',
      directBody: {
        itemReferenceHash: itemHash,
        itemId: instId,
        stackSize: 1,
        transferToVault: true,
        characterId: sourceCharId,
        membershipType
      }
    });

    if (!res.ok) {
      return { ok: false, message: res.message || 'Failed to move item to Vault.' };
    }

    return { ok: true, message: `${item.name} moved to Vault.` };
  }

  // 2. Move to Character
  if (target.type === 'character') {
    const targetCharId = target.characterId;
    const targetChar = profileData.characters?.find(c => c.characterId === targetCharId);
    if (!targetChar) {
      return { ok: false, message: 'Target Guardian not found.' };
    }

    // Check armor class compatibility
    if (item.isArmor && item.classType && item.classType !== 'Any' && item.classType !== targetChar.classType) {
      return { ok: false, message: `This armour is for ${item.classType}s and cannot be transferred to a ${targetChar.classType}.` };
    }

    // Check slot space on target character
    const targetSlotItems = (targetChar.bag || []).filter(it => isSameSlot(it, item));
    if (targetSlotItems.length >= 9 && currentLoc.character?.characterId !== targetCharId) {
      return { ok: false, message: `${targetChar.classType}'s ${item.slot || item.itemTypeDisplayName} inventory is full (9/9).` };
    }

    // If already on target character
    if (currentLoc.character?.characterId === targetCharId) {
      if (target.equip) {
        // Equip item
        return await executeEquipItem({ item, characterId: targetCharId, profileData, onOptimisticUpdate });
      }
      return { ok: true, message: `${item.name} is already on your ${targetChar.classType}.` };
    }

    // If on another character, must move to Vault first, then to target character
    if (currentLoc.location !== 'vault') {
      if (currentLoc.location === 'equipped') {
        return { ok: false, message: `${item.name} is currently equipped on your ${currentLoc.character.classType}. Equip another piece first.` };
      }

      const sourceCharId = currentLoc.character.characterId;

      // Step 1: Source Char -> Vault
      const step1 = await runInventoryAction({
        proxyPath: '/api/inventory/transfer',
        proxyBody: {
          membershipType,
          characterId: sourceCharId,
          itemReferenceHash: itemHash,
          itemInstanceId: instId,
          transferToVault: true
        },
        directUrl: 'https://www.bungie.net/Platform/Destiny2/Actions/Items/TransferItem/',
        directBody: {
          itemReferenceHash: itemHash,
          itemId: instId,
          stackSize: 1,
          transferToVault: true,
          characterId: sourceCharId,
          membershipType
        }
      });

      if (!step1.ok) {
        return { ok: false, message: step1.message || `Failed to move ${item.name} from ${currentLoc.character.classType} to Vault.` };
      }
    }

    // Step 2: Vault -> Target Character
    if (onOptimisticUpdate) {
      onOptimisticUpdate(prev => {
        if (!prev) return prev;
        const vault = (prev.vault || []).filter(it => it.itemInstanceId !== instId);
        const characters = prev.characters.map(c => {
          if (c.characterId === currentLoc.character?.characterId) {
            return { ...c, bag: c.bag.filter(it => it.itemInstanceId !== instId) };
          }
          if (c.characterId === targetCharId) {
            return { ...c, bag: [item, ...(c.bag || []).filter(it => it.itemInstanceId !== instId)] };
          }
          return c;
        });
        return { ...prev, characters, vault };
      });
    }

    const step2 = await runInventoryAction({
      proxyPath: '/api/inventory/transfer',
      proxyBody: {
        membershipType,
        characterId: targetCharId,
        itemReferenceHash: itemHash,
        itemInstanceId: instId,
        transferToVault: false
      },
      directUrl: 'https://www.bungie.net/Platform/Destiny2/Actions/Items/TransferItem/',
      directBody: {
        itemReferenceHash: itemHash,
        itemId: instId,
        stackSize: 1,
        transferToVault: false,
        characterId: targetCharId,
        membershipType
      }
    });

    if (!step2.ok) {
      return { ok: false, message: step2.message || `Failed to pull ${item.name} to ${targetChar.classType}.` };
    }

    // If equip was requested
    if (target.equip) {
      return await executeEquipItem({ item, characterId: targetCharId, profileData, onOptimisticUpdate });
    }

    return { ok: true, message: `${item.name} transferred to ${targetChar.classType}.` };
  }

  return { ok: false, message: 'Unknown target destination.' };
}

/**
 * Equip an item on a specific character.
 */
export async function executeEquipItem({ item, characterId, profileData, onOptimisticUpdate }) {
  const instId = item?.itemInstanceId;
  if (!instId) return { ok: false, message: 'Cannot equip item (no instance ID)' };

  const membershipType = getMembershipType(profileData);
  if (!membershipType) return { ok: false, message: 'Could not resolve platform membership.' };

  const targetChar = profileData?.characters?.find(c => c.characterId === characterId);
  const charName = targetChar?.classType || 'Guardian';

  if (onOptimisticUpdate) {
    onOptimisticUpdate(prev => {
      if (!prev) return prev;
      const characters = prev.characters.map(c => {
        if (c.characterId !== characterId) return c;
        const currentSlotIdx = c.equipped.findIndex(it => isSameSlot(it, item));
        const displaced = currentSlotIdx !== -1 ? c.equipped[currentSlotIdx] : null;
        const equipped = [...c.equipped];
        if (currentSlotIdx !== -1) equipped[currentSlotIdx] = item;
        else equipped.push(item);
        const bag = c.bag.filter(it => it.itemInstanceId !== instId);
        if (displaced && displaced.itemInstanceId !== instId) bag.unshift(displaced);
        return { ...c, equipped, bag };
      });
      return { ...prev, characters };
    });
  }

  const res = await runInventoryAction({
    proxyPath: '/api/inventory/equip',
    proxyBody: {
      membershipType,
      characterId,
      itemInstanceId: instId
    },
    directUrl: 'https://www.bungie.net/Platform/Destiny2/Actions/Items/EquipItem/',
    directBody: {
      itemId: instId,
      characterId,
      membershipType
    }
  });

  if (!res.ok) {
    return { ok: false, message: res.message || `Failed to equip ${item.name} on ${charName}.` };
  }

  return { ok: true, message: `${item.name} equipped on ${charName}.` };
}
