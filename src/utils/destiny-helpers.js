export function getDamageInfo(damageType) {
  const dt = (damageType || 'Kinetic').toLowerCase();
  switch (dt) {
    case 'solar':
      return { name: 'Solar', color: '#f16c24', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300' };
    case 'arc':
      return { name: 'Arc', color: '#79b9e7', bg: 'bg-sky-500/10', border: 'border-sky-500/30', text: 'text-sky-400', badge: 'bg-sky-500/20 text-sky-300' };
    case 'void':
      return { name: 'Void', color: '#b184c5', bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-300' };
    case 'stasis':
      return { name: 'Stasis', color: '#4d88ff', bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-300' };
    case 'strand':
      return { name: 'Strand', color: '#35e385', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' };
    default:
      return { name: 'Kinetic', color: '#e2e8f0', bg: 'bg-slate-500/10', border: 'border-slate-500/30', text: 'text-slate-200', badge: 'bg-slate-700/50 text-slate-200' };
  }
}

export function getTierInfo(tierTypeName) {
  const t = (tierTypeName || 'Legendary').toLowerCase();
  switch (t) {
    case 'exotic':
      return { name: 'Exotic', color: '#ceae33', border: 'border-amber-500/60', bg: 'bg-amber-500/10', text: 'text-amber-300', headerBg: 'bg-gradient-to-r from-amber-600/30 to-amber-950/20' };
    case 'legendary':
      return { name: 'Legendary', color: '#9b59b6', border: 'border-purple-500/60', bg: 'bg-purple-500/10', text: 'text-purple-300', headerBg: 'bg-gradient-to-r from-purple-900/40 to-slate-900/40' };
    case 'rare':
      return { name: 'Rare', color: '#5076a3', border: 'border-blue-500/60', bg: 'bg-blue-500/10', text: 'text-blue-300', headerBg: 'bg-gradient-to-r from-blue-900/30 to-slate-900/40' };
    default:
      return { name: 'Common', color: '#94a3b8', border: 'border-slate-600/60', bg: 'bg-slate-800/40', text: 'text-slate-300', headerBg: 'bg-slate-900' };
  }
}

export function getSourceCategoryBadge(sourceCategory) {
  const sc = (sourceCategory || '').toLowerCase();
  if (sc.includes('raid')) {
    return { name: 'Raid', bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/40', icon: '🏛️' };
  }
  if (sc.includes('dungeon')) {
    return { name: 'Dungeon', bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/40', icon: '🏰' };
  }
  if (sc.includes('trials')) {
    return { name: 'Trials of Osiris', bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/40', icon: '👑' };
  }
  if (sc.includes('iron banner')) {
    return { name: 'Iron Banner', bg: 'bg-emerald-600/20', text: 'text-emerald-300', border: 'border-emerald-600/40', icon: '🐺' };
  }
  if (sc.includes('nightfall') || sc.includes('vanguard')) {
    return { name: 'Nightfall / Vanguard', bg: 'bg-sky-500/20', text: 'text-sky-300', border: 'border-sky-500/40', icon: '🛡️' };
  }
  if (sc.includes('crucible')) {
    return { name: 'Crucible', bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/40', icon: '⚔️' };
  }
  if (sc.includes('gambit')) {
    return { name: 'Gambit', bg: 'bg-teal-500/20', text: 'text-teal-300', border: 'border-teal-500/40', icon: '🐍' };
  }
  if (sc.includes('onslaught') || sc.includes('into the light')) {
    return { name: 'Into the Light', bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/40', icon: '💥' };
  }
  if (sc.includes('exotic quest') || sc.includes('archive')) {
    return { name: 'Exotic Archive/Quest', bg: 'bg-amber-400/20', text: 'text-amber-300', border: 'border-amber-400/40', icon: '🏆' };
  }
  if (sc.includes('seasonal') || sc.includes('episode')) {
    return { name: 'Seasonal / Episode', bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/40', icon: '🌌' };
  }
  return { name: 'World Drop', bg: 'bg-slate-800', text: 'text-slate-300', border: 'border-slate-700', icon: '📦' };
}

export function generateDimQuery(weapon, selectedPerks = []) {
  if (!weapon) return '';
  let q = `name:"${weapon.name}"`;
  if (weapon.damageType) q += ` element:${weapon.damageType.toLowerCase()}`;
  if (selectedPerks && selectedPerks.length > 0) {
    selectedPerks.forEach(p => {
      if (p) q += ` perk:"${p}"`;
    });
  }
  return q;
}

const WISHLIST_KEY = 'destiny2_arsenal_wishlists';

export function getSavedWishlists() {
  try {
    const data = localStorage.getItem(WISHLIST_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

export function saveWishlistRoll(roll) {
  try {
    const list = getSavedWishlists();
    const existingIndex = list.findIndex(r => r.id === roll.id && r.weaponId === roll.weaponId);
    if (existingIndex >= 0) {
      list[existingIndex] = roll;
    } else {
      list.unshift(roll);
    }
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
    return list;
  } catch (e) {
    console.error('Error saving wishlist:', e);
    return [];
  }
}

export function removeWishlistRoll(rollId) {
  try {
    const list = getSavedWishlists().filter(r => r.id !== rollId);
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
    return list;
  } catch (e) {
    return [];
  }
}

/**
 * Drop enhanced perks that merely restate a base perk in the same column.
 *
 * Almost every perk on a craftable weapon is listed twice -- "Rewind Rounds"
 * and its enhanced twin -- which doubles the length of every column for no
 * added choice.
 *
 * Not every enhanced entry is a duplicate, though. Crafted weapons also carry
 * enhanced-only stat perks ("Enhanced Stability", "Enhanced Range") that have
 * no base version at all, and those are real options rather than restatements.
 * Roughly 1,800 entries across the catalogue fall into that group, so matching
 * on the enhanced flag alone would quietly delete them. Only an enhanced perk
 * whose base twin is present in the same column is removed.
 */
export function withoutDuplicateEnhancedPerks(perks = []) {
  const baseNames = new Set(
    perks.filter(p => !p.isEnhanced).map(p => (p.name || '').toLowerCase())
  );

  return perks.filter(p => {
    if (!p.isEnhanced) return true;
    // Enhanced entries are named either exactly like their base perk or with an
    // "Enhanced " prefix, depending on the perk.
    const stripped = (p.name || '').toLowerCase().replace(/^enhanced\s+/, '');
    return !baseNames.has(stripped);
  });
}

/**
 * The socket columns that make up a weapon's roll, in reading order.
 *
 * The manifest parser labels several unrelated sockets "Trait", and they are
 * not traits at all: one holds weapon mods (Counterbalance Stock, Backup Mag,
 * Icarus Grip), one the masterwork options ("Masterworked: Stability"), and one
 * the crafting socket ("Extract Pattern"). None of them are things a weapon
 * rolls with, so showing them alongside the real columns roughly triples the
 * matrix with sockets you cannot roll for.
 */
export const ROLL_COLUMN_ORDER = [
  'Barrel/Sight',
  'Magazine/Battery',
  'Perk Column 3',
  'Perk Column 4',
  'Origin Trait'
];

/**
 * A weapon's roll columns only, in a stable order regardless of how the
 * manifest happened to list them.
 */
export function rollColumns(socketColumns = []) {
  return (socketColumns || [])
    .filter(col => ROLL_COLUMN_ORDER.includes(col.type))
    .sort((a, b) => ROLL_COLUMN_ORDER.indexOf(a.type) - ROLL_COLUMN_ORDER.indexOf(b.type));
}

/**
 * Ammo colours follow the in-game convention -- white for Primary, green for
 * Special, purple for Heavy -- so the chip reads at a glance without needing
 * the word.
 */
export function getAmmoInfo(ammoType) {
  switch ((ammoType || '').toLowerCase()) {
    case 'special':
      return { name: 'Special', bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' };
    case 'heavy':
      return { name: 'Heavy', bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/30' };
    case 'primary':
      return { name: 'Primary', bg: 'bg-slate-400/15', text: 'text-slate-200', border: 'border-slate-400/30' };
    default:
      return null;
  }
}

/** The equipment slot a weapon occupies, distinct from its damage type. */
export function getSlotInfo(slot) {
  switch ((slot || '').toLowerCase()) {
    case 'kinetic':
      return { name: 'Kinetic', bg: 'bg-slate-700/40', text: 'text-slate-300', border: 'border-slate-600/40' };
    case 'energy':
      return { name: 'Energy', bg: 'bg-sky-500/15', text: 'text-sky-300', border: 'border-sky-500/30' };
    case 'power':
      return { name: 'Power', bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30' };
    default:
      return null;
  }
}
