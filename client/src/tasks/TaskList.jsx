export default function TaskList({ tasks, busy, onStatus, onEdit, onDelete }) {
  return <ul className="task-list">
    {tasks.map((task) => <li key={task.id} className={`task-item ${task.status === 'completed' ? 'is-completed' : ''}`}>
      <div className="task-item-top"><span className={`priority-badge ${task.priority}`}>{task.priority} priority</span><span className="task-date">{task.task_date}</span></div>
      <h3>{task.title}</h3>
      {task.description && <p className="task-description">{task.description}</p>}
      <p className="task-time">{task.start_time ? `${task.start_time} – ${task.end_time}` : 'No set time'}</p>
      <div className="task-actions">
        <label className="status-label">Status<select aria-label={`Status for ${task.title}`} value={task.status} disabled={busy} onChange={(event) => onStatus(task, event.target.value)}><option value="waiting">Waiting</option><option value="in_progress">In Progress</option><option value="completed">Completed</option></select></label>
        <button type="button" className="quiet" disabled={busy} onClick={() => onEdit(task)} aria-label={`Edit ${task.title}`}>Edit</button>
        <button type="button" className="quiet danger-text" disabled={busy} onClick={() => onDelete(task)} aria-label={`Delete ${task.title}`}>Delete</button>
      </div>
    </li>)}
  </ul>;
}
