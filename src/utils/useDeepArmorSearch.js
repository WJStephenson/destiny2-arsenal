import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Runs the deep armour search in a worker and hands back its latest answer.
 *
 * The optimizer keeps rendering its instant, main-thread answer; this only
 * reports a deeper one once it exists. Two guards matter:
 *
 *  - the pool index is rebuilt only when the armour or the pool constraints
 *    change, since that is the expensive half (seconds, not milliseconds);
 *  - targets move faster than a deep scan finishes, so queries are debounced
 *    and every reply is matched against the question currently on screen.
 *    Anything stale is dropped rather than flashing an answer to a question
 *    the player has already moved past.
 *
 * Returns a null result while no deep answer applies to the current inputs,
 * which is the signal to keep showing the instant one.
 */
export function useDeepArmorSearch({ pools, indexOptions, targets, modOptions, enabled = true }) {
  const workerRef = useRef(null);
  const requestIdRef = useRef(0);
  const indexIdRef = useRef(0);

  const [available, setAvailable] = useState(true);
  const [status, setStatus] = useState('idle'); // idle | indexing | searching | ready
  const [result, setResult] = useState(null);
  const [coverage, setCoverage] = useState(null);

  // Identity of the current question, so a reply can be matched to it.
  const indexKey = useMemo(() => JSON.stringify(indexOptions), [indexOptions]);
  const queryKey = useMemo(() => JSON.stringify({ targets, modOptions }), [targets, modOptions]);

  // Read by the message handler, which must not be rebuilt per target change.
  const queryKeyRef = useRef(queryKey);
  queryKeyRef.current = queryKey;

  useEffect(() => {
    if (!enabled || typeof Worker === 'undefined') {
      setAvailable(false);
      return undefined;
    }

    let worker;
    try {
      worker = new Worker(new URL('./armor-search.worker.js', import.meta.url), { type: 'module' });
    } catch (e) {
      // Without module worker support the instant answer stands on its own.
      setAvailable(false);
      return undefined;
    }

    workerRef.current = worker;

    worker.onmessage = (event) => {
      const { type, requestId } = event.data || {};

      if (type === 'indexed') {
        setCoverage({
          count: event.data.count,
          coverage: event.data.coverage,
          truncated: event.data.truncated
        });
        return;
      }

      if (type === 'result') {
        // Drop anything answering a question we have moved on from.
        if (requestId !== requestIdRef.current) return;
        setResult({ ...event.data, queryKey: queryKeyRef.current });
        setStatus('ready');
        return;
      }

      if (type === 'error') setAvailable(false);
    };

    worker.onerror = () => setAvailable(false);

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [enabled]);

  // Rebuild the index whenever the armour or the pool constraints change.
  useEffect(() => {
    const worker = workerRef.current;
    if (!worker || !available) return;

    const totalPieces = Object.values(pools || {}).reduce((acc, list) => acc + list.length, 0);
    if (totalPieces === 0) return;

    setResult(null);
    setStatus('indexing');
    indexIdRef.current += 1;
    worker.postMessage({
      type: 'index',
      requestId: indexIdRef.current,
      pools,
      options: indexOptions
    });
  }, [pools, indexKey, available]);

  // Re-query on target changes, debounced so a dragged slider does not queue a
  // scan per frame.
  useEffect(() => {
    const worker = workerRef.current;
    if (!worker || !available) return undefined;

    const handle = setTimeout(() => {
      requestIdRef.current += 1;
      setStatus(s => (s === 'ready' ? 'searching' : s));
      worker.postMessage({
        type: 'query',
        requestId: requestIdRef.current,
        targets,
        options: modOptions
      });
    }, 150);

    return () => clearTimeout(handle);
  }, [queryKey, indexKey, available]);

  return {
    available,
    status,
    coverage,
    // Only surface a result that answers the question currently on screen.
    result: result && result.queryKey === queryKey ? result : null
  };
}
