import { useEffect, useRef, useState } from 'react';
import { request } from '../api.js';

export default function useDashboardTasks(onSessionExpired) {
  const [state, setState] = useState({ tasks: [], loading: true, error: '' });
  const [revision, setRevision] = useState(0);
  const expired = useRef(onSessionExpired);
  expired.current = onSessionExpired;
  useEffect(() => {
    const controller = new AbortController();
    setState({ tasks: [], loading: true, error: '' });
    request('tasks', { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setState({ tasks: data.tasks, loading: false, error: '' }); })
      .catch(failure => {
        if (controller.signal.aborted) return;
        if (failure.status === 401) expired.current();
        else setState({ tasks: [], loading: false, error: failure.message });
      });
    return () => controller.abort();
  }, [revision]);
  return { ...state, refresh: () => setRevision(value => value + 1) };
}
