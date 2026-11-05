import { useEffect, useRef, useState } from 'react';
import { request } from '../api.js';
import TaskForm from './TaskForm.jsx';
import TaskList from './TaskList.jsx';
import DeleteTaskDialog from './DeleteTaskDialog.jsx';
import './tasks.css';

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function TasksPage({ user, onLogout, signingOut, authError, onSessionExpired }) {
  const [filters, setFilters] = useState({ date: localToday(), status: '', priority: '' });
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [revision, setRevision] = useState(0);
  const [formVersion, setFormVersion] = useState(0);
  const formPanel = useRef(null);
  // Keep the callback current without restarting an in-flight list request on each parent render.
  const expired = useRef(onSessionExpired);
  expired.current = onSessionExpired;

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    setLoading(true); setError(''); setLoadError('');
    request(`tasks?${query}`, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setTasks(data.tasks); })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        if (failure.status === 401) expired.current(); else setLoadError(failure.message);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, revision]);

  function resetForm() { setEditing(null); setFormVersion((value) => value + 1); setError(''); }
  async function mutate(action, success, after) {
    setBusy(true); setError(''); setNotice(''); setDeleteError('');
    try {
      await action(); after?.(); setNotice(success); setRevision((value) => value + 1);
    } catch (failure) {
      if (failure.status === 401) onSessionExpired();
      else { setError(failure.message); if (deleting) setDeleteError(failure.message); }
    } finally { setBusy(false); }
  }
  function save(body) {
    return mutate(() => request(editing ? `tasks/${editing.id}` : 'tasks', { method: editing ? 'PATCH' : 'POST', body }), editing ? 'Task updated.' : 'Task added. Change the filters if it is not shown below.', resetForm);
  }
  function edit(task) { setEditing(task); setFormVersion((value) => value + 1); setError(''); setNotice(''); formPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  return <main className="tasks-page">
    <div className="tasks-heading"><div><p className="eyebrow">YOUR PERSONAL SPACE</p><h1>Make time for<br /><span>what matters.</span></h1><p className="muted">Welcome, {user.name}. A simple place to keep track of your tasks.</p></div><button className="secondary" disabled={signingOut || busy} onClick={onLogout}>{signingOut ? 'Signing out…' : 'Sign out'}</button></div>
    <div className="task-workspace">
      <aside ref={formPanel} className="task-form-container"><TaskForm key={`${formVersion}-${editing?.id || 'new'}`} task={editing} date={filters.date || localToday()} busy={busy || signingOut} onSave={save} onCancel={resetForm} />
        {(error || authError) && <p role="alert" className="message error">{error || authError}</p>}
        {notice && <p role="status" className="message success">{notice}</p>}
      </aside>
      <section className="task-list-panel" aria-labelledby="tasks-title">
        <div className="list-heading"><div><p className="eyebrow">ONE THING AT A TIME</p><h2 id="tasks-title">Your tasks</h2></div><button type="button" className="quiet" disabled={loading || busy} onClick={() => setRevision((value) => value + 1)}>Refresh list</button></div>
        <fieldset disabled={busy || signingOut} className="task-filters">
          <label>Filter date<input type="date" min="1000-01-01" max="9999-12-31" value={filters.date} onChange={(event) => setFilters({ ...filters, date: event.target.value })} /></label>
          <label>Filter status<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option><option value="waiting">Waiting</option><option value="in_progress">In Progress</option><option value="completed">Completed</option></select></label>
          <label>Filter priority<select value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}><option value="">All priorities</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
          <button type="button" className="quiet all-dates" onClick={() => setFilters({ date: '', status: '', priority: '' })}>Show all</button>
        </fieldset>
        {loading ? <p role="status" className="empty-state">Loading your tasks…</p> : loadError ? <div className="empty-state" role="alert"><p>Could not load tasks. {loadError}</p><button className="secondary" onClick={() => setRevision((value) => value + 1)}>Reload list</button></div> : tasks.length ? <TaskList tasks={tasks} busy={busy || signingOut} onStatus={(task, status) => mutate(() => request(`tasks/${task.id}`, { method: 'PATCH', body: { status } }), 'Task status updated.')} onEdit={edit} onDelete={(task) => { setDeleteError(''); setDeleting(task); }} /> : <div className="empty-state"><span aria-hidden="true">✓</span><h3>A little room to begin.</h3><p>No tasks match these filters. Add a task or choose another date.</p></div>}
      </section>
    </div>
    {deleting && <DeleteTaskDialog task={deleting} busy={busy} error={deleteError} onCancel={() => setDeleting(null)} onConfirm={() => mutate(() => request(`tasks/${deleting.id}`, { method: 'DELETE' }), 'Task deleted.', () => { if (editing?.id === deleting.id) resetForm(); setDeleting(null); })} />}
  </main>;
}
