/**
 * Deep armour search, off the main thread.
 *
 * The optimizer answers instantly from a small combination index on the main
 * thread so a dragged slider stays smooth. That index only covers a slice of a
 * large vault, so this worker builds a far bigger one and re-answers the same
 * questions against it. Its results replace the instant ones when they arrive.
 *
 * Protocol
 * --------
 *  -> { type: 'index', requestId, pools, options }   build the deep index
 *  -> { type: 'query', requestId, targets, options } answer against it
 *  <- { type: 'indexed', requestId, count, coverage, truncated }
 *  <- { type: 'result', requestId, ranges, anyFeasible, builds }
 *  <- { type: 'error', requestId, message }
 *
 * `requestId` is echoed so the page can drop answers to questions it has since
 * changed its mind about -- targets move faster than a deep scan completes.
 */

import {
  buildComboIndex,
  computeStatRanges,
  rankBuilds,
  chooseSlotCaps,
  COMBO_BUDGET
} from './armor-stats';

let index = null;

/**
 * Builds carry whole armour pieces, which cannot be structured-cloned back to
 * the page cheaply (icons, perks, definitions). Only what the results list
 * actually renders is sent.
 */
function serialiseBuild(build) {
  return {
    ...build,
    pieces: build.pieces.map(piece => ({
      itemInstanceId: piece.itemInstanceId ?? null,
      itemHash: piece.itemHash ?? piece.id ?? null,
      name: piece.name,
      icon: piece.icon ?? null,
      tierTypeName: piece.tierTypeName,
      location: piece.location,
      slotType: piece.slotType,
      isArtifice: !!piece.isArtifice,
      isMasterwork: !!piece.isMasterwork,
      setName: piece.setName ?? null,
      setHash: piece.setHash ?? null,
      stats: piece.stats
    }))
  };
}

self.onmessage = (event) => {
  const { type, requestId } = event.data || {};

  try {
    if (type === 'index') {
      const { pools, options = {} } = event.data;
      const slotCaps = chooseSlotCaps(pools, COMBO_BUDGET.DEEP);

      index = buildComboIndex(pools, {
        ...options,
        slotCaps,
        maxCombos: COMBO_BUDGET.DEEP
      });

      self.postMessage({
        type: 'indexed',
        requestId,
        count: index.count,
        coverage: index.coverage,
        truncated: index.truncated
      });
      return;
    }

    if (type === 'query') {
      if (!index) {
        self.postMessage({ type: 'error', requestId, message: 'No index built yet' });
        return;
      }

      const { targets, options = {} } = event.data;
      const { ranges, anyFeasible } = computeStatRanges(index, targets, options);
      const builds = rankBuilds(index, targets, options, 10).map(serialiseBuild);

      self.postMessage({ type: 'result', requestId, ranges, anyFeasible, builds });
      return;
    }
  } catch (err) {
    self.postMessage({ type: 'error', requestId, message: err?.message || String(err) });
  }
};
