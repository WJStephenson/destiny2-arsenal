/**
 * Inventory bucket hashes, straight from DestinyInventoryBucketDefinition.
 *
 * These are the only reliable way to tell which slot a piece of gear belongs
 * to: every item a character holds -- equipped or in its bag -- reports the
 * bucket it occupies. Display names are a translation away from being wrong, so
 * they are only ever a fallback, and only for vault items (everything in the
 * vault reports the vault's own bucket instead of its equipment slot).
 */
export const BUCKET_HASHES = Object.freeze({
  kinetic: 1498876634,
  energy: 2465295065,
  power: 953998645,
  helmet: 3448274439,
  gauntlets: 3551918588,
  chest: 14239492,
  legs: 20886954,
  classItem: 1585787867
});

/** Everything in the vault reports this bucket, not the slot it would occupy. */
export const VAULT_BUCKET_HASH = 138197802;

export const ARMOR_SLOT_KEYS = Object.freeze(['helmet', 'gauntlets', 'chest', 'legs', 'classItem']);
export const WEAPON_SLOT_KEYS = Object.freeze(['kinetic', 'energy', 'power']);

export const ARMOR_BUCKET_HASHES = ARMOR_SLOT_KEYS.map(k => BUCKET_HASHES[k]);
export const WEAPON_BUCKET_HASHES = WEAPON_SLOT_KEYS.map(k => BUCKET_HASHES[k]);

export const SLOT_LABELS = Object.freeze({
  kinetic: 'Kinetic',
  energy: 'Energy',
  power: 'Power',
  helmet: 'Helmet',
  gauntlets: 'Gauntlets',
  chest: 'Chest',
  legs: 'Legs',
  classItem: 'Class Item'
});

const SLOT_BY_BUCKET_HASH = new Map(
  Object.entries(BUCKET_HASHES).map(([slot, hash]) => [hash, slot])
);

/** The slot a bucket hash equips into, or null for anything else (vault, ghost, ...). */
export function slotKeyFromBucketHash(bucketHash) {
  if (bucketHash === undefined || bucketHash === null) return null;
  return SLOT_BY_BUCKET_HASH.get(Number(bucketHash)) || null;
}

/**
 * Slot implied by a display name -- 'Leg Armor', 'Hunter Cloak', 'Energy'.
 * Only used where no bucket is available.
 */
export function slotKeyFromText(text) {
  if (!text) return null;
  const s = String(text).toLowerCase();
  if (s.includes('helmet')) return 'helmet';
  if (s.includes('gauntlet') || s.includes('arms')) return 'gauntlets';
  if (s.includes('chest')) return 'chest';
  if (s.includes('leg') || s.includes('boots') || s.includes('greaves') || s.includes('strides')) return 'legs';
  if (s.includes('class') || s.includes('mark') || s.includes('cloak') || s.includes('bond')) return 'classItem';
  if (s.includes('kinetic')) return 'kinetic';
  if (s.includes('energy')) return 'energy';
  if (s.includes('power') || s.includes('heavy')) return 'power';
  return null;
}

/**
 * Canonical equipment slot for an item: 'helmet', 'kinetic', and so on, or null
 * when nothing identifies it.
 */
export function equipSlotKey(item) {
  if (!item) return null;

  const bucketHash = item.bucketHash === undefined || item.bucketHash === null
    ? null
    : Number(item.bucketHash);

  const fromBucket = slotKeyFromBucketHash(bucketHash);
  if (fromBucket) return fromBucket;

  // A bucket that is not an equipment slot -- mods, consumables, the postmaster
  // -- has already answered: those items equip nowhere, whatever they are
  // called. Only the vault (and an item with no bucket at all, such as a
  // manifest entry) needs the display-name fallback.
  if (bucketHash !== null && bucketHash !== VAULT_BUCKET_HASH) return null;

  for (const field of [item.armorSlot, item.slot, item.itemTypeDisplayName]) {
    const fromText = slotKeyFromText(field);
    if (fromText) return fromText;
  }
  return null;
}

/** Armour-only slot key, so weapons never land in an armour pool. */
export function armorSlotKey(item) {
  const key = equipSlotKey(item);
  return ARMOR_SLOT_KEYS.includes(key) ? key : null;
}

/** Do two items compete for the same equipment slot? */
export function isSameSlot(a, b) {
  if (!a || !b) return false;
  // Two items can only share a slot if they are the same kind of gear.
  if (!!a.isWeapon !== !!b.isWeapon) return false;
  if (!!a.isArmor !== !!b.isArmor) return false;

  const slotA = equipSlotKey(a);
  const slotB = equipSlotKey(b);
  if (!slotA || !slotB) return false;
  return slotA === slotB;
}
