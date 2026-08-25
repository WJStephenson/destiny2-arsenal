/**
 * Deciding whether two item definitions describe the same piece of gear.
 *
 * A hash identifies an item exactly. A name does not: whole armour sets ship
 * under a single name across four slots, and the same name is often worn by all
 * three classes, so a definition found by name has to be corroborated before it
 * is allowed to describe an item the player owns.
 */

/**
 * Is a definition found only by name really the item the authoritative
 * definition describes?
 *
 * Every field both sides actually report has to agree. A field only one side
 * knows cannot contradict anything, but the match is trusted only once at least
 * one field has confirmed it: a definition that answered nothing -- a failed
 * fetch -- can vouch for nothing, and a shared name is not evidence.
 */
export function describesSameItem(candidate, authoritative) {
  if (!candidate || !authoritative) return false;

  let corroborated = false;

  const candidateBucket = candidate.bucketTypeHash;
  const authoritativeBucket = authoritative.bucketTypeHash;
  if (candidateBucket !== undefined && candidateBucket !== null
    && authoritativeBucket !== undefined && authoritativeBucket !== null) {
    if (Number(candidateBucket) !== Number(authoritativeBucket)) return false;
    corroborated = true;
  }

  if (candidate.itemTypeDisplayName && authoritative.itemTypeDisplayName) {
    if (candidate.itemTypeDisplayName !== authoritative.itemTypeDisplayName) return false;
    corroborated = true;
  }

  // 'Any' is the absence of a class rather than a class of its own, so it
  // agrees with all of them.
  const candidateClass = candidate.classType;
  const authoritativeClass = authoritative.classType;
  if (candidateClass && authoritativeClass
    && candidateClass !== 'Any' && authoritativeClass !== 'Any') {
    if (candidateClass !== authoritativeClass) return false;
    corroborated = true;
  }

  return corroborated;
}
