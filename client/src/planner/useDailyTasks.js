import { useEffect, useRef, useState } from 'react';
import { request } from '../api.js';

export default function useDailyTasks(date, onSessionExpired) {
  const [state, setState] = useState({ date: null, tasks: [], loading: true, error: '' });
  const [revision, setRevision] = useState(0);
  const expired = useRef(onSessionExpired);
  expired.current = onSessionExpired;

  useEffect(() => {
    const controller = new AbortController();
    setState({ date, tasks: [], loading: true, error: '' });
    request(`tasks?${new URLSearchParams({ date })}`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ date, tasks: data.tasks, loading: false, error: '' });
      })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        if (failure.status === 401) expired.current();
        else setState({ date, tasks: [], loading: false, error: failure.message });
      });
    return () => controller.abort();
  }, [date, revision]);

  // Never flash the previous date's tasks while the next date starts loading.
  return {
    tasks: state.date === date ? state.tasks : [],
    loading: state.date !== date || state.loading,
    loadError: state.date === date ? state.error : '',
    refresh: () => setRevision((value) => value + 1),
  };
}
