import { statusLabels } from '../planner/planner-model.js';

export default function CalendarDaySummary({ date, tasks, onOpenDaily }) {
  return <section className="calendar-summary" aria-labelledby="selected-day-title">
    <p className="eyebrow">A CLOSER LOOK</p><h2 id="selected-day-title">Selected day</h2>
    <p className="selected-day-date"><time dateTime={date}>{date}</time></p>
    <p className="muted" role="status" aria-live="polite">{tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} for this day.</p>
    {tasks.length ? <ul className="calendar-summary-list">{tasks.map((task) => <li key={task.id}>
      <h3>{task.title}</h3><p>{task.start_time ? `${task.start_time} – ${task.end_time}` : 'No set time'}<span> · {statusLabels[task.status]}</span></p>
    </li>)}</ul> : <p className="daily-empty">No tasks for this day. Open Daily Planner to manage your day.</p>}
    <button type="button" className="primary" onClick={() => onOpenDaily(date)}>Open Daily Planner <span aria-hidden="true">→</span></button>
    <p className="calendar-readonly">Manage tasks in Daily Planner.</p>
  </section>;
}
