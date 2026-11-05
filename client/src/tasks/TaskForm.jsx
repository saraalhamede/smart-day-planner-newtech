import { useState } from 'react';

export default function TaskForm({ task, date, busy, onSave, onCancel }) {
  const [timed, setTimed] = useState(Boolean(task?.start_time));
  function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    onSave({ ...values, start_time: timed ? values.start_time : null, end_time: timed ? values.end_time : null });
  }
  return <section className="task-form-panel" aria-labelledby="task-form-title">
    <p className="eyebrow">{task ? 'A LITTLE UPDATE' : 'MAKE ROOM FOR WHAT MATTERS'}</p>
    <h2 id="task-form-title">{task ? 'Edit task' : 'Add a task'}</h2>
    <p className="muted">Keep it simple. Start with a title and a date.</p>
    <form onSubmit={submit}>
      <fieldset disabled={busy}>
        <label>Task title<input name="title" placeholder="What would you like to do?" defaultValue={task?.title || ''} required maxLength={180} /></label>
        <label>Description <span className="optional">optional</span><textarea name="description" rows={3} defaultValue={task?.description || ''} maxLength={2000} placeholder="A few details, if you need them." /></label>
        <label>Task date<input name="task_date" type="date" required min="1000-01-01" max="9999-12-31" defaultValue={task?.task_date || date} /></label>
        <div className="form-row">
          <label>Priority<select name="priority" defaultValue={task?.priority || 'medium'}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
          <label>Status<select name="status" defaultValue={task?.status || 'waiting'}><option value="waiting">Waiting</option><option value="in_progress">In Progress</option><option value="completed">Completed</option></select></label>
        </div>
        <label className="timed-toggle"><input type="checkbox" checked={timed} onChange={(event) => setTimed(event.target.checked)} />Set a time <span className="optional">optional</span></label>
        {timed && <div className="form-row">
          <label>Start time<input name="start_time" type="time" step="60" required defaultValue={task?.start_time || ''} /></label>
          <label>End time<input name="end_time" type="time" step="60" required defaultValue={task?.end_time || ''} /></label>
        </div>}
        <p className="field-hint task-hint">One task in progress per day. Timed tasks must not overlap.</p>
        <button className="primary" type="submit">{busy ? 'Saving…' : task ? 'Save changes' : 'Add task'}<span aria-hidden="true"> →</span></button>
        {task && <button type="button" className="quiet cancel-edit" onClick={onCancel}>Cancel editing</button>}
      </fieldset>
    </form>
  </section>;
}
