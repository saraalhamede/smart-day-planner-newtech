import TaskList from '../tasks/TaskList.jsx';
import { statusLabels } from './planner-model.js';

const empty = {
  waiting: 'No waiting tasks for this day.',
  in_progress: 'Nothing in progress. Start a waiting task when you are ready.',
  completed: 'No completed tasks for this day yet.',
};

export default function DailySections({ view, busy, onStart, onComplete, onEdit, onDelete }) {
  return <div className="daily-status-sections">
    {Object.keys(statusLabels).map((status) => <section key={status} className={`daily-section section-${status}`} aria-labelledby={`section-${status}`}>
      <div className="daily-section-heading"><h2 id={`section-${status}`}>{statusLabels[status]}</h2><span className="section-count" aria-label={`${view[status].length} ${statusLabels[status]} tasks`}>{view[status].length}</span></div>
      {view[status].length ? <TaskList tasks={view[status]} busy={busy} onStart={onStart} onComplete={onComplete} onEdit={onEdit} onDelete={onDelete} /> : <p className="daily-empty">{empty[status]}</p>}
    </section>)}
  </div>;
}
