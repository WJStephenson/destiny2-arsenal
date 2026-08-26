const STORAGE_KEY = 'destiny2_arsenal_custom_loadouts';

/**
 * Loadouts the app keeps, over and above the ten slots the game allows.
 *
 * A saved loadout is a list of item instances plus the subclass configuration
 * that went with them, so applying one puts the same gear *and* the same
 * Aspects and Fragments back. It lives in this browser only -- Bungie has no
 * endpoint for storing a loadout of your own.
 */

const newId = () => `cl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function getCustomLoadouts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error reading saved loadouts:', e);
    return [];
  }
}

function persist(loadouts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loadouts));
  } catch (e) {
    console.error('Error saving loadouts:', e);
  }
  return loadouts;
}

/** Saved loadouts this Guardian can actually wear. */
export function getLoadoutsForClass(classType) {
  if (!classType) return getCustomLoadouts();
  return getCustomLoadouts().filter(ld => !ld.classType || ld.classType === classType);
}

/**
 * Capture what a Guardian is wearing right now.
 *
 * Only what is needed to put it back is kept: the instance ids to equip, the
 * subclass plugs to re-insert, and enough name and icon to show a card without
 * a live profile.
 */
export function buildLoadoutFromCharacter(character, subclass, name) {
  const gear = (character?.equipped || [])
    .filter(it => it.isWeapon || it.isArmor)
    .map(it => ({
      itemInstanceId: it.itemInstanceId,
      itemHash: it.itemHash,
      name: it.name,
      icon: it.icon,
      power: it.power || null,
      tierTypeName: it.tierTypeName || null,
      isWeapon: !!it.isWeapon,
      isArmor: !!it.isArmor
    }));

  const subclassSnapshot = subclass
    ? {
      itemInstanceId: subclass.itemInstanceId,
      itemHash: subclass.itemHash,
      name: subclass.name,
      icon: subclass.icon,
      damageType: subclass.damageType || null,
      // Sockets, not just plug hashes: re-inserting a plug needs the index of
      // the socket it belongs in, and an Aspect in the wrong socket is a
      // rejected action.
      plugs: (subclass.editableSockets || [])
        .filter(s => s.plugHash && !s.plug?.isEmpty)
        .map(s => ({
          socketIndex: s.index,
          plugHash: s.plugHash,
          role: s.role,
          name: s.plug?.name || null,
          icon: s.plug?.icon || null
        }))
    }
    : null;

  return {
    id: newId(),
    name: name?.trim() || 'New Loadout',
    classType: character?.classType || null,
    characterId: character?.characterId || null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    items: gear,
    subclass: subclassSnapshot
  };
}

export function saveCustomLoadout(loadout) {
  const all = getCustomLoadouts();
  const idx = all.findIndex(ld => ld.id === loadout.id);
  const entry = { ...loadout, updatedAt: Date.now() };
  if (idx === -1) all.unshift(entry);
  else all[idx] = entry;
  return persist(all);
}

export function renameCustomLoadout(id, name) {
  const all = getCustomLoadouts();
  const idx = all.findIndex(ld => ld.id === id);
  if (idx === -1) return all;
  all[idx] = { ...all[idx], name: name?.trim() || all[idx].name, updatedAt: Date.now() };
  return persist(all);
}

export function removeCustomLoadout(id) {
  return persist(getCustomLoadouts().filter(ld => ld.id !== id));
}
