/**
 * Shared armour stat maths for the current Destiny 2 armour sandbox.
 *
 * Stat model
 * ----------
 * Six stats, each on a 0-200 scale, grouped into tiers of 10. Values past 100
 * are "overcharged" and keep granting benefits up to the 200 cap.
 *
 * Mod model
 * ---------
 * Every armour piece has exactly one general mod slot. A general mod is either
 * a major (+10 to one stat) or a minor (+5 to one stat). A full set of five
 * pieces therefore grants five general mod slots.
 *
 * Artifice armour carries an *additional* dedicated slot that grants +3 to one
 * stat, so an all-artifice set adds five more +3 mods on top of the general
 * five.
 *
 * Masterworking a piece adds a flat bonus to every stat on that piece.
 *
 * These are the only assumptions the optimizer makes. It deliberately does not
 * model subclass fragments, armour set perks or seasonal artifact bonuses --
 * those sit on top of whatever the armour itself can reach.
 */

export const STAT_KEYS = [
  'weapons',
  'health',
  'classAbility',
  'grenade',
  'superAbility',
  'melee'
];

export const STAT_META = [
  { key: 'weapons', label: 'Weapons', short: 'WEAP', legacy: 'Mobility' },
  { key: 'health', label: 'Health', short: 'HLTH', legacy: 'Resilience' },
  { key: 'classAbility', label: 'Class', short: 'CLAS', legacy: 'Recovery' },
  { key: 'grenade', label: 'Grenade', short: 'GREN', legacy: 'Discipline' },
  { key: 'superAbility', label: 'Super', short: 'SUPR', legacy: 'Intellect' },
  { key: 'melee', label: 'Melee', short: 'MELE', legacy: 'Strength' }
];

export const STAT_COUNT = STAT_KEYS.length;
export const STAT_MAX = 200;
export const STAT_TIER_SIZE = 10;
export const OVERCHARGE_THRESHOLD = 100;

export const MAJOR_MOD_VALUE = 10;
export const MINOR_MOD_VALUE = 5;
export const ARTIFICE_MOD_VALUE = 3;

/** One general mod slot per armour piece. */
export const GENERAL_MOD_SLOTS_PER_PIECE = 1;
/** Flat bonus a masterworked piece adds to each of the six stats. */
export const MASTERWORK_BONUS_PER_PIECE = 2;

export const ARMOR_SLOTS = ['helmet', 'gauntlets', 'chest', 'legs', 'classItem'];
export const ARMOR_SLOT_COUNT = ARMOR_SLOTS.length;

/** Bungie ItemState bitmask flag for a masterworked instance. */
export const ITEM_STATE_MASTERWORK = 4;

export function statTier(value) {
  return Math.floor(Math.max(0, Math.min(STAT_MAX, value)) / STAT_TIER_SIZE);
}

export function isOvercharged(value) {
  return value >= OVERCHARGE_THRESHOLD;
}

export function clampStat(value) {
  return Math.max(0, Math.min(STAT_MAX, Math.round(value || 0)));
}

/**
 * Normalise whatever shape an item's stats arrived in into a plain six-value
 * object. Live Bungie instances, the bundled client manifest and hand-built
 * fixtures all feed through here.
 */
export function normaliseStats(source) {
  const out = { weapons: 0, health: 0, classAbility: 0, grenade: 0, superAbility: 0, melee: 0 };
  if (!source) return { ...out, total: 0 };

  if (typeof source.weapons === 'number' || typeof source.health === 'number') {
    STAT_KEYS.forEach(k => { out[k] = Math.max(0, source[k] || 0); });
  } else if (Array.isArray(source)) {
    source.forEach(s => {
      const n = (s.name || '').toLowerCase();
      const v = Math.max(0, s.value || 0);
      if (n.includes('weapon') || n.includes('mobility')) out.weapons = v;
      else if (n.includes('health') || n.includes('resilience')) out.health = v;
      else if (n.includes('class') || n.includes('recovery')) out.classAbility = v;
      else if (n.includes('grenade') || n.includes('discipline')) out.grenade = v;
      else if (n.includes('super') || n.includes('intellect')) out.superAbility = v;
      else if (n.includes('melee') || n.includes('strength')) out.melee = v;
    });
  }

  out.total = STAT_KEYS.reduce((acc, k) => acc + out[k], 0);
  return out;
}

/**
 * Cheapest way to cover a stat deficit with the two mod pools.
 *
 * Returns the (major, artifice) slot counts that satisfy `deficit` while
 * consuming the least total stat value, so that whatever is left over stays
 * available for the stat we are trying to push. A major slot is worth more
 * than an artifice slot, which is exactly what `10g + 3a` encodes.
 *
 * Minor (+5) mods never change slot counts -- they only let a build land on a
 * target without overshooting -- so they play no part in this budget.
 */
export function coverCost(deficit, maxMajor, maxArtifice) {
  if (deficit <= 0) return { major: 0, artifice: 0, spend: 0, possible: true };

  let best = null;
  for (let g = 0; g <= maxMajor; g++) {
    const remaining = deficit - g * MAJOR_MOD_VALUE;
    const a = remaining <= 0 ? 0 : Math.ceil(remaining / ARTIFICE_MOD_VALUE);
    if (a > maxArtifice) continue;
    const spend = g * MAJOR_MOD_VALUE + a * ARTIFICE_MOD_VALUE;
    if (!best || spend < best.spend) best = { major: g, artifice: a, spend, possible: true };
    if (remaining <= 0) break;
  }

  return best || { major: maxMajor, artifice: maxArtifice, spend: Infinity, possible: false };
}

/**
 * `coverCost` is called six times per armour combination, and there can be
 * hundreds of thousands of combinations, so precompute every answer once per
 * scan. Deficits are bounded by the 0-200 stat scale and the artifice slot
 * count by the five armour pieces, so the whole table is tiny.
 *
 * Layout: [artificeSlots][deficit] -> packed major/artifice counts.
 * A value of 255 marks a deficit that cannot be covered at all.
 */
const UNCOVERABLE = 255;

function buildCoverTable(maxMajor) {
  const table = [];
  for (let a = 0; a <= ARMOR_SLOT_COUNT; a++) {
    const majors = new Uint8Array(STAT_MAX + 1);
    const artifices = new Uint8Array(STAT_MAX + 1);
    for (let d = 0; d <= STAT_MAX; d++) {
      const cost = coverCost(d, maxMajor, a);
      majors[d] = cost.possible ? cost.major : UNCOVERABLE;
      artifices[d] = cost.possible ? cost.artifice : UNCOVERABLE;
    }
    table.push({ majors, artifices });
  }
  return table;
}

/**
 * Pick a manageable shortlist of pieces for one slot.
 *
 * The old behaviour took the first twelve pieces in inventory order, which
 * both missed good rolls and made the reported ranges arbitrary. Ranges are
 * only honest if the shortlist contains the extremes, so we keep the pieces
 * that lead on each individual stat, the pieces that trail on each individual
 * stat (they set the achievable minimum), the best all-rounders, and anything
 * currently equipped.
 */
export function shortlistSlot(pieces, cap = 12) {
  if (pieces.length <= cap) return pieces.slice();

  const keep = new Set();
  const add = (p) => { if (p && keep.size < cap) keep.add(p); };

  const byStat = STAT_KEYS.map(key => [...pieces].sort((a, b) => (b.stats[key] || 0) - (a.stats[key] || 0)));

  // Round-robin across the six stats rather than exhausting one stat at a
  // time, otherwise a tight cap would only ever keep the extremes of the first
  // stat or two and the reported ranges would lean on stat order.
  byStat.forEach(sorted => add(sorted[0]));                      // highest of each stat
  byStat.forEach(sorted => add(sorted[sorted.length - 1]));      // lowest of each stat -> sets the floor
  pieces.forEach(p => { if (p.location === 'equipped') add(p); });
  byStat.forEach(sorted => add(sorted[1]));                      // runner-up of each stat

  const byTotal = [...pieces].sort((a, b) => (b.stats.total || 0) - (a.stats.total || 0));
  byTotal.forEach(add);

  return Array.from(keep);
}

/**
 * Flatten every slot combination into typed arrays once, so that changing a
 * target stat only costs a linear scan rather than a fresh cartesian product.
 */
/**
 * Per-slot shortlist sizes. Twelve covers the highest and lowest roll of each
 * of the six stats, which is what the range maths needs to stay honest. Class
 * items carry the least stat spread, so they get a smaller cap to keep the
 * cartesian product tractable.
 */
export const DEFAULT_SLOT_CAPS = { helmet: 12, gauntlets: 12, chest: 12, legs: 12, classItem: 6 };

export function buildComboIndex(pools, { slotCaps = DEFAULT_SLOT_CAPS, maxCombos = 200000, exoticHash = 'any' } = {}) {
  const wantsExotic = exoticHash !== 'any' && exoticHash !== 'none';
  const matchesLocked = (p) => String(p.itemHash ?? p.id) === String(exoticHash);

  const effectivePools = ARMOR_SLOTS.map(slot => {
    const pool = pools[slot] || [];
    if (exoticHash === 'none') return pool.filter(p => p.tierTypeName !== 'Exotic');
    // Pinning an exotic fixes one slot outright, which also shrinks the search
    // space rather than relying on the shortlist happening to keep that piece.
    if (wantsExotic && pool.some(matchesLocked)) return pool.filter(matchesLocked);
    if (wantsExotic) return pool.filter(p => p.tierTypeName !== 'Exotic');
    return pool;
  });

  const shortlists = effectivePools.map((pool, i) => shortlistSlot(pool, slotCaps[ARMOR_SLOTS[i]] ?? 12));

  if (shortlists.some(list => list.length === 0)) {
    return { count: 0, stats: new Int16Array(0), picks: new Int32Array(0), artifice: new Uint8Array(0), masterworked: new Uint8Array(0), shortlists };
  }

  const total = shortlists.reduce((acc, list) => acc * list.length, 1);
  const count = Math.min(total, maxCombos);

  const stats = new Int16Array(count * STAT_COUNT);
  const picks = new Int32Array(count * ARMOR_SLOT_COUNT);
  const artifice = new Uint8Array(count);
  const masterworked = new Uint8Array(count);

  const cursor = new Array(ARMOR_SLOT_COUNT).fill(0);
  let written = 0;

  while (written < count) {
    let exotics = 0;
    let artificeCount = 0;
    let mwCount = 0;
    let hasLockedExotic = false;
    const base = written * STAT_COUNT;

    for (let s = 0; s < ARMOR_SLOT_COUNT; s++) {
      const piece = shortlists[s][cursor[s]];
      picks[written * ARMOR_SLOT_COUNT + s] = cursor[s];
      if (piece.tierTypeName === 'Exotic') exotics++;
      if (wantsExotic && String(piece.itemHash ?? piece.id) === String(exoticHash)) hasLockedExotic = true;
      if (piece.isArtifice) artificeCount++;
      if (piece.isMasterwork) mwCount++;
      for (let k = 0; k < STAT_COUNT; k++) {
        stats[base + k] += piece.stats[STAT_KEYS[k]] || 0;
      }
    }

    // A Guardian can only wear one exotic armour piece at a time, and the
    // player may have pinned a specific one.
    const exoticOk = exotics <= 1
      && !(exoticHash === 'none' && exotics > 0)
      && !(wantsExotic && !hasLockedExotic);

    if (exoticOk) {
      artifice[written] = artificeCount;
      masterworked[written] = mwCount;
      written++;
    } else {
      for (let k = 0; k < STAT_COUNT; k++) stats[base + k] = 0;
    }

    // Advance the odometer over the slot shortlists.
    let s = ARMOR_SLOT_COUNT - 1;
    while (s >= 0) {
      cursor[s]++;
      if (cursor[s] < shortlists[s].length) break;
      cursor[s] = 0;
      s--;
    }
    if (s < 0) break;
  }

  return { count: written, stats, picks, artifice, masterworked, shortlists };
}

/**
 * The heart of the live optimizer.
 *
 * For every stat this reports the lowest and highest value reachable *while
 * still hitting the targets set on the other five stats*, using only armour
 * the player actually owns plus the mods those pieces could slot. Nothing here
 * asks the player to choose mods -- it assumes the best legal mod assignment
 * on their behalf, which is what makes the numbers move as targets change.
 */
export function computeStatRanges(index, targets, options = {}) {
  const {
    assumeMasterwork = true,
    assumeArtifice = false,
    generalSlots = ARMOR_SLOT_COUNT * GENERAL_MOD_SLOTS_PER_PIECE
  } = options;

  const empty = STAT_KEYS.map(key => ({
    key,
    min: 0,
    max: 0,
    target: clampStat(targets[key]),
    targetReachable: false,
    constrained: false,
    anyFeasible: false
  }));

  if (!index || index.count === 0) return { ranges: empty, anyFeasible: false, feasibleCombos: 0 };

  const { count, stats, artifice, masterworked } = index;
  const targetVec = STAT_KEYS.map(k => clampStat(targets[k]));

  const minOut = new Array(STAT_COUNT).fill(Infinity);
  const maxOut = new Array(STAT_COUNT).fill(-Infinity);
  const reachable = new Array(STAT_COUNT).fill(false);

  // Scratch space reused across combos to keep the scan allocation-free.
  const raw = new Array(STAT_COUNT).fill(0);
  const needMajor = new Array(STAT_COUNT).fill(0);
  const needArtifice = new Array(STAT_COUNT).fill(0);

  let feasibleCombos = 0;
  let allTargetsMet = false;

  const coverTable = buildCoverTable(generalSlots);

  for (let c = 0; c < count; c++) {
    const base = c * STAT_COUNT;
    const artificeSlots = assumeArtifice ? ARMOR_SLOT_COUNT : artifice[c];
    const mwPieces = assumeMasterwork ? ARMOR_SLOT_COUNT : masterworked[c];
    const mwBonus = mwPieces * MASTERWORK_BONUS_PER_PIECE;
    const { majors, artifices } = coverTable[artificeSlots];

    let totalMajor = 0;
    let totalArtifice = 0;
    let coverable = true;

    for (let k = 0; k < STAT_COUNT; k++) {
      const value = stats[base + k] + mwBonus;
      raw[k] = value;
      const deficit = targetVec[k] - value;
      if (deficit <= 0) {
        needMajor[k] = 0;
        needArtifice[k] = 0;
        continue;
      }
      const g = majors[deficit];
      if (g === UNCOVERABLE) { coverable = false; break; }
      const a = artifices[deficit];
      needMajor[k] = g;
      needArtifice[k] = a;
      totalMajor += g;
      totalArtifice += a;
    }

    if (!coverable) continue;

    if (totalMajor <= generalSlots && totalArtifice <= artificeSlots) {
      allTargetsMet = true;
    }

    // For each stat, free the slots that stat's own target was consuming and
    // see whether the remaining five targets still fit. If they do, this combo
    // defines a legal min and max for that stat.
    for (let k = 0; k < STAT_COUNT; k++) {
      const othersMajor = totalMajor - needMajor[k];
      const othersArtifice = totalArtifice - needArtifice[k];
      if (othersMajor > generalSlots || othersArtifice > artificeSlots) continue;

      const spareMajor = generalSlots - othersMajor;
      const spareArtifice = artificeSlots - othersArtifice;

      const lo = clampStat(raw[k]);
      const hi = clampStat(raw[k] + spareMajor * MAJOR_MOD_VALUE + spareArtifice * ARTIFICE_MOD_VALUE);

      if (lo < minOut[k]) minOut[k] = lo;
      if (hi > maxOut[k]) maxOut[k] = hi;
      if (targetVec[k] >= lo && targetVec[k] <= hi) reachable[k] = true;
      feasibleCombos++;
    }
  }

  const anyFeasible = maxOut.some(v => v > -Infinity);

  const ranges = STAT_KEYS.map((key, k) => ({
    key,
    min: minOut[k] === Infinity ? 0 : minOut[k],
    max: maxOut[k] === -Infinity ? 0 : maxOut[k],
    target: targetVec[k],
    targetReachable: reachable[k],
    // A stat is "constrained" when the other five targets have squeezed its
    // ceiling below the raw 0-200 scale -- worth surfacing in the UI.
    constrained: maxOut[k] !== -Infinity && maxOut[k] < STAT_MAX,
    anyFeasible
  }));

  return { ranges, anyFeasible, allTargetsMet, feasibleCombos };
}

/**
 * Rank whole armour sets against the current targets.
 *
 * Runs the same cheap slot-budget test as the range scan over every
 * combination, keeps only the best handful, and then does the expensive work
 * (resolving pieces, planning concrete mods) on those alone.
 */
export function rankBuilds(index, targets, options = {}, limit = 10) {
  const {
    assumeMasterwork = true,
    assumeArtifice = false,
    generalSlots = ARMOR_SLOT_COUNT * GENERAL_MOD_SLOTS_PER_PIECE,
  } = options;

  if (!index || index.count === 0) return [];

  const { count, stats, picks, artifice, masterworked, shortlists } = index;
  const targetVec = STAT_KEYS.map(k => clampStat(targets[k]));
  const coverTable = buildCoverTable(generalSlots);

  // A small max-heap would be tidier, but a bounded insertion sort over ten
  // entries is simpler and the comparison count is negligible.
  const best = [];
  const worstOf = () => best[best.length - 1];

  const isBetter = (a, b) => {
    if (a.meetsTargets !== b.meetsTargets) return a.meetsTargets;
    // When nothing can hit the targets outright, the closest near-misses are
    // far more useful than an empty results list.
    if (a.shortfall !== b.shortfall) return a.shortfall < b.shortfall;
    if (a.overcharged !== b.overcharged) return a.overcharged > b.overcharged;
    return a.total > b.total;
  };

  const raw = new Array(STAT_COUNT);

  for (let c = 0; c < count; c++) {
    const base = c * STAT_COUNT;
    const artificeSlots = assumeArtifice ? ARMOR_SLOT_COUNT : artifice[c];
    const mwBonus = (assumeMasterwork ? ARMOR_SLOT_COUNT : masterworked[c]) * MASTERWORK_BONUS_PER_PIECE;
    const { majors, artifices } = coverTable[artificeSlots];

    let usedMajor = 0;
    let usedArtifice = 0;
    let shortfall = 0;

    for (let k = 0; k < STAT_COUNT; k++) {
      const value = stats[base + k] + mwBonus;
      raw[k] = value;
      const deficit = targetVec[k] - value;
      if (deficit <= 0) continue;
      const g = majors[deficit];
      if (g === UNCOVERABLE) {
        // Even every slot on the set cannot close this gap. Spend what there
        // is and record how far short the build lands.
        usedMajor += generalSlots;
        usedArtifice += artificeSlots;
        shortfall += deficit - (generalSlots * MAJOR_MOD_VALUE + artificeSlots * ARTIFICE_MOD_VALUE);
        continue;
      }
      usedMajor += g;
      usedArtifice += artifices[deficit];
    }

    if (usedMajor > generalSlots) shortfall += (usedMajor - generalSlots) * MAJOR_MOD_VALUE;
    if (usedArtifice > artificeSlots) shortfall += (usedArtifice - artificeSlots) * ARTIFICE_MOD_VALUE;

    const meetsTargets = shortfall <= 0;

    // Estimate the finished set: targets are met first, then leftover slots are
    // poured into whichever stats are closest to the overcharge threshold.
    const spareMajor = Math.max(0, generalSlots - usedMajor);
    const spareArtifice = Math.max(0, artificeSlots - usedArtifice);
    let total = 0;
    let overcharged = 0;
    for (let k = 0; k < STAT_COUNT; k++) {
      const settled = Math.max(raw[k], targetVec[k]);
      total += Math.min(STAT_MAX, settled);
      if (settled >= OVERCHARGE_THRESHOLD) overcharged++;
    }
    total += spareMajor * MAJOR_MOD_VALUE + spareArtifice * ARTIFICE_MOD_VALUE;

    const candidate = { combo: c, meetsTargets, shortfall: Math.max(0, shortfall), overcharged, total };

    if (best.length < limit) {
      best.push(candidate);
      best.sort((a, b) => (isBetter(a, b) ? -1 : 1));
    } else if (isBetter(candidate, worstOf())) {
      best[best.length - 1] = candidate;
      best.sort((a, b) => (isBetter(a, b) ? -1 : 1));
    }
  }

  return best.map(entry => {
    const c = entry.combo;
    const pieces = ARMOR_SLOTS.map((slot, s) => shortlists[s][picks[c * ARMOR_SLOT_COUNT + s]]);
    const artificeSlots = assumeArtifice ? ARMOR_SLOT_COUNT : artifice[c];
    const mwBonus = (assumeMasterwork ? ARMOR_SLOT_COUNT : masterworked[c]) * MASTERWORK_BONUS_PER_PIECE;

    const rawStats = {};
    STAT_KEYS.forEach((k, i) => { rawStats[k] = stats[c * STAT_COUNT + i] + mwBonus; });

    const plan = planMods(rawStats, targets, generalSlots, artificeSlots);
    const spent = spendSpareSlots(plan.final, plan.majorLeft, plan.artificeLeft);

    return {
      pieces,
      rawStats,
      stats: spent.final,
      mods: [...plan.mods, ...spent.mods],
      modSlots: { general: generalSlots, artifice: artificeSlots },
      shortfall: plan.shortfall,
      meetsTargets: plan.shortfall === 0,
      overchargedCount: STAT_KEYS.filter(k => spent.final[k] >= OVERCHARGE_THRESHOLD).length,
      totalStatPoints: spent.final.total
    };
  });
}

/**
 * Pour whatever mod slots the targets did not need into the stats that gain
 * the most from them: first anything that can be pushed over the overcharge
 * threshold, then whatever is closest to completing a tier.
 */
function spendSpareSlots(stats, majorLeft, artificeLeft) {
  const final = { ...stats };
  const mods = [];

  const pick = (value) => {
    let bestKey = null;
    let bestScore = -Infinity;
    STAT_META.forEach(meta => {
      const current = final[meta.key];
      if (current >= STAT_MAX) return;
      const next = Math.min(STAT_MAX, current + value);
      // Crossing 100 unlocks overcharge benefits, so weight it heavily.
      const crossesOvercharge = current < OVERCHARGE_THRESHOLD && next >= OVERCHARGE_THRESHOLD ? 100 : 0;
      const tiersGained = statTier(next) - statTier(current);
      const score = crossesOvercharge + tiersGained * 10 + (next - current);
      if (score > bestScore) { bestScore = score; bestKey = meta; }
    });
    return bestKey;
  };

  while (majorLeft > 0) {
    const meta = pick(MAJOR_MOD_VALUE);
    if (!meta) break;
    final[meta.key] = Math.min(STAT_MAX, final[meta.key] + MAJOR_MOD_VALUE);
    mods.push({ stat: meta.label, short: meta.short, value: MAJOR_MOD_VALUE, label: `+${MAJOR_MOD_VALUE} ${meta.label}`, kind: 'major' });
    majorLeft--;
  }
  while (artificeLeft > 0) {
    const meta = pick(ARTIFICE_MOD_VALUE);
    if (!meta) break;
    final[meta.key] = Math.min(STAT_MAX, final[meta.key] + ARTIFICE_MOD_VALUE);
    mods.push({ stat: meta.label, short: meta.short, value: ARTIFICE_MOD_VALUE, label: `+${ARTIFICE_MOD_VALUE} ${meta.label}`, kind: 'artifice' });
    artificeLeft--;
  }

  final.total = STAT_KEYS.reduce((acc, k) => acc + final[k], 0);
  return { final, mods };
}

/**
 * Turn a solved combo into the concrete mod list a player would slot.
 * Uses minor (+5) mods wherever a major would overshoot the target.
 */
export function planMods(raw, targets, generalSlots, artificeSlots) {
  const mods = [];
  let majorLeft = generalSlots;
  let artificeLeft = artificeSlots;
  const final = { ...raw };
  let shortfall = 0;

  STAT_META.forEach(meta => {
    let deficit = clampStat(targets[meta.key]) - (raw[meta.key] || 0);
    if (deficit <= 0) return;

    while (deficit > MINOR_MOD_VALUE && majorLeft > 0) {
      mods.push({ stat: meta.label, short: meta.short, value: MAJOR_MOD_VALUE, label: `+${MAJOR_MOD_VALUE} ${meta.label}`, kind: 'major' });
      deficit -= MAJOR_MOD_VALUE;
      final[meta.key] += MAJOR_MOD_VALUE;
      majorLeft--;
    }
    if (deficit > 0 && majorLeft > 0) {
      mods.push({ stat: meta.label, short: meta.short, value: MINOR_MOD_VALUE, label: `+${MINOR_MOD_VALUE} ${meta.label}`, kind: 'minor' });
      deficit -= MINOR_MOD_VALUE;
      final[meta.key] += MINOR_MOD_VALUE;
      majorLeft--;
    }
    while (deficit > 0 && artificeLeft > 0) {
      mods.push({ stat: meta.label, short: meta.short, value: ARTIFICE_MOD_VALUE, label: `+${ARTIFICE_MOD_VALUE} ${meta.label}`, kind: 'artifice' });
      deficit -= ARTIFICE_MOD_VALUE;
      final[meta.key] += ARTIFICE_MOD_VALUE;
      artificeLeft--;
    }

    if (deficit > 0) shortfall += deficit;
  });

  STAT_KEYS.forEach(k => { final[k] = clampStat(final[k]); });
  final.total = STAT_KEYS.reduce((acc, k) => acc + final[k], 0);

  return { mods, final, shortfall, majorLeft, artificeLeft };
}
