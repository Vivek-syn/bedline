// A tiny data hook: load on mount, expose a reload, and stay
// subscribed to the realtime events that make the data stale.
//
// Every module page has the same shape (fetch, show a spinner,
// refetch when something changes), so it lives here once.

import { useCallback, useEffect, useState } from 'react';
import { useRealtime } from './realtime';

export default function useModuleData(loader, { events = [] } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setData(await loader());
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  // The caller passes a memoised loader; re-running on every
  // render would loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loader]);

  useEffect(() => { reload(); }, [reload]);

  useRealtime(events, reload);

  return { data, error, loading, reload, setData };
}
