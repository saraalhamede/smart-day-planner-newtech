import { statusLabels } from './planner-model.js';

export default function DailyTimeline({ timed, untimed }) {
  return <aside className="daily-timeline" aria-labelledby="timeline-title">
    <p className="eyebrow">THE SHAPE OF YOUR DAY</p>
    <h2 id="timeline-title">Daily Timeline</h2>
    <p className="muted">Your chosen times, in order.</p>
    {timed.length ? <ol className="timeline-list" aria-label="Timed tasks in start-time order">
      {timed.map((task) => <li key={task.id} className={`timeline-item timeline-${task.status}`}>
        <p className="timeline-time"><time>{task.start_time}</time><span aria-hidden="true"> – </span><time>{task.end_time}</time></p>
        <h3>{task.title}</h3><span className="timeline-status">{statusLabels[task.status]}</span>
      </li>)}
    </ol> : <p className="daily-empty">No timed tasks for this day.</p>}
    <section className="untimed-section" aria-labelledby="untimed-title">
      <h3 id="untimed-title">Untimed tasks</h3>
      <p className="field-hint">These tasks have no assigned time.</p>
      {untimed.length ? <ul className="untimed-list" aria-label="Untimed tasks">
        {untimed.map((task) => <li key={task.id}><span>{task.title}</span><small>{statusLabels[task.status]}</small></li>)}
      </ul> : <p className="daily-empty">No untimed tasks for this day.</p>}
    </section>
  </aside>;
}
