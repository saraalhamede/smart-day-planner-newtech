import { useEffect, useState } from 'react';
import { adjacentDate, isPlannerDate, localToday } from './planner-model.js';

export default function DateNavigation({ date, busy, editing, onChange, onRefresh, loading }) {
  const [draft, setDraft] = useState(date);
  useEffect(() => { setDraft(date); }, [date]);
  function apply(value) { setDraft(value); if (isPlannerDate(value)) onChange(value); }
  const previous = adjacentDate(date, -1);
  const next = adjacentDate(date, 1);
  const locked = busy || editing;
  return <section className="day-navigation" aria-label="Daily planner date navigation">
    <div className="day-controls">
      <button type="button" className="secondary" disabled={locked || !previous} onClick={() => onChange(previous)} aria-label="Previous day">← Previous</button>
      <label className="day-date-label">Selected date<input type="date" required min="1000-01-01" max="9999-12-31" value={draft} disabled={locked} onChange={(event) => apply(event.target.value)} onBlur={(event) => { if (isPlannerDate(event.target.value)) apply(event.target.value); else setDraft(date); }} /></label>
      <button type="button" className="secondary" disabled={locked || !next} onClick={() => onChange(next)} aria-label="Next day">Next →</button>
      <button type="button" className="quiet" disabled={locked} onClick={() => onChange(localToday())}>Today</button>
    </div>
    <button type="button" className="quiet" disabled={busy || loading} onClick={onRefresh}>Refresh day</button>
    {editing && <p className="day-edit-hint">Finish or cancel the task form to change the day.</p>}
  </section>;
}
