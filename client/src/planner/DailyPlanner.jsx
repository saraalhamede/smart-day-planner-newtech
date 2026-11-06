import { useRef, useState } from 'react';
import { request } from '../api.js';
import TaskForm from '../tasks/TaskForm.jsx';
import DeleteTaskDialog from '../tasks/DeleteTaskDialog.jsx';
import useDailyTasks from './useDailyTasks.js';
import { dailyView, selectedDay } from './planner-model.js';
import DateNavigation from './DateNavigation.jsx';
import DailySections from './DailySections.jsx';
import DailyTimeline from './DailyTimeline.jsx';
import '../tasks/tasks.css';
import './planner.css';

export default function DailyPlanner({ user, onLogout, signingOut, authError, onSessionExpired }) {
  const [date, setDate] = useState(() => selectedDay(window.location.search));
  const { tasks, loading, loadError, refresh } = useDailyTasks(date, onSessionExpired);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const mutationLock = useRef(false);
  const view = dailyView(tasks, date);
  const locked = busy || signingOut;

  function changeDate(next) {
    const url = new URL(window.location.href);
    url.searchParams.set('day', next);
    window.history.replaceState(null, '', url);
    setDate(next); setError(''); setNotice('');
  }
  function closeForm() { setForm(null); setError(''); }
  function openForm(task = null) { setForm({ task }); setError(''); setNotice(''); }
  async function mutate(action, message, after) {
    if (mutationLock.current) return;
    mutationLock.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); after?.(); setNotice(message); refresh(); }
    catch (failure) { if (failure.status === 401) onSessionExpired(); else setError(failure.message); }
    finally { mutationLock.current = false; setBusy(false); }
  }
  const setStatus = (task, status) => mutate(() => request(`tasks/${task.id}`, { method: 'PATCH', body: { status } }), status === 'in_progress' ? 'Task started.' : 'Task completed.');
  const save = (body) => mutate(() => request(form.task ? `tasks/${form.task.id}` : 'tasks', { method: form.task ? 'PATCH' : 'POST', body }), 'Task saved. It appears on its selected task date.', closeForm);

  return <main className="daily-planner">
    <div className="tasks-heading"><div><p className="eyebrow">ONE DAY AT A TIME</p><h1>Your day,<br /><span>at a glance.</span></h1><p className="muted">Welcome, {user.name}. Choose a day and take it one task at a time.</p></div><button className="secondary" disabled={locked} onClick={onLogout}>{signingOut ? 'Signing out…' : 'Sign out'}</button></div>
    <DateNavigation date={date} busy={locked} editing={Boolean(form)} onChange={changeDate} onRefresh={refresh} loading={loading} />
    {(error || authError) && !deleting && <p className="message error" role="alert">{error || authError}</p>}
    {notice && <p className="message success" role="status">{notice}</p>}
    <div className="daily-toolbar"><p>Tasks for <strong><time dateTime={date}>{date}</time></strong></p><button type="button" className="secondary" disabled={locked || Boolean(form)} onClick={() => openForm()}>Add task</button></div>
    {form && <div className="daily-editor">
      <TaskForm key={form.task?.id || `new-${date}`} task={form.task} date={date} busy={locked} onSave={save} onCancel={closeForm} />
      {!form.task && <button type="button" className="quiet" disabled={locked} onClick={closeForm}>Cancel adding task</button>}
    </div>}
    {loading ? <p className="empty-state" role="status">Loading tasks for {date}…</p> : loadError ? <div className="empty-state" role="alert"><p>Could not load this day. {loadError}</p><button className="secondary" onClick={refresh}>Retry day</button></div> : <>
      {!tasks.length && <p className="daily-empty day-empty" role="status">A fresh page. No tasks for this day yet.</p>}
      <div className="daily-layout">
        <DailySections view={view} busy={locked || Boolean(form)} onStart={(task) => setStatus(task, 'in_progress')} onComplete={(task) => setStatus(task, 'completed')} onEdit={openForm} onDelete={(task) => { setError(''); setNotice(''); setDeleting(task); }} />
        <DailyTimeline timed={view.timed} untimed={view.untimed} />
      </div>
    </>}
    {deleting && <DeleteTaskDialog task={deleting} busy={busy} error={error} onCancel={() => { setDeleting(null); setError(''); }} onConfirm={() => mutate(() => request(`tasks/${deleting.id}`, { method: 'DELETE' }), 'Task deleted.', () => setDeleting(null))} />}
  </main>;
}
