import { useEffect, useState } from 'react';
import { localToday } from '../planner/planner-model.js';
import { adjacentMonth, indexTasksForMonth, isCalendarMonth, monthLabel } from './calendar-model.js';
import CalendarGrid from './CalendarGrid.jsx';
import CalendarDaySummary from './CalendarDaySummary.jsx';
import useCalendarTasks from './useCalendarTasks.js';
import '../tasks/tasks.css';
import '../planner/planner.css';
import './calendar.css';

export default function CalendarPage({ user, date, onDateChange, onOpenDaily, onLogout, signingOut, authError, onSessionExpired }) {
  const month = date.slice(0, 7);
  const [draftMonth, setDraftMonth] = useState(month);
  const { tasks, loading, error, refresh } = useCalendarTasks(onSessionExpired);
  useEffect(() => { setDraftMonth(month); }, [month]);
  const previous = adjacentMonth(month, -1); const next = adjacentMonth(month, 1);
  const byDate = indexTasksForMonth(tasks, month);
  function changeMonth(value) { setDraftMonth(value); if (isCalendarMonth(value) && value !== month) onDateChange(`${value}-01`); }
  return <main className="calendar-page">
    <div className="tasks-heading"><div><p className="eyebrow">A LITTLE PERSPECTIVE</p><h1>Your month,<br /><span>one day at a time.</span></h1><p className="muted">Welcome, {user.name}. See where your tasks fit, then choose a day.</p></div><button className="secondary" disabled={signingOut} onClick={onLogout}>{signingOut ? 'Signing out…' : 'Sign out'}</button></div>
    {authError && <p className="message error" role="alert">{authError}</p>}
    <section className="calendar-toolbar" aria-label="Calendar month navigation">
      <div className="calendar-month-controls"><button className="secondary" type="button" disabled={!previous || signingOut} aria-label="Previous month" onClick={() => changeMonth(previous)}>← Previous</button>
        <label>Displayed month<input type="month" min="1000-01" max="9999-12" required value={draftMonth} disabled={signingOut} onChange={(event) => changeMonth(event.target.value)} onBlur={(event) => { if (isCalendarMonth(event.target.value)) changeMonth(event.target.value); else setDraftMonth(month); }} /></label>
        <button className="secondary" type="button" disabled={!next || signingOut} aria-label="Next month" onClick={() => changeMonth(next)}>Next →</button>
        <button className="quiet" type="button" disabled={signingOut} onClick={() => onDateChange(localToday())}>This month</button>
      </div>
      <button className="quiet" type="button" disabled={loading || signingOut} onClick={refresh}>Refresh Calendar</button>
    </section>
    {loading ? <p className="empty-state" role="status">Loading your calendar…</p> : error ? <div className="empty-state" role="alert"><p>Could not load Calendar. {error}</p><button className="secondary" type="button" onClick={refresh}>Retry Calendar</button></div> : <>
      <div className="calendar-month-heading"><h2>{monthLabel(month)}</h2><p><span className="calendar-legend-dot" aria-hidden="true" /> Task counts shown on each date</p></div>
      {!byDate.size && <p className="calendar-month-empty" role="status">No tasks in this month.</p>}
      <div className="calendar-layout">
        <section className="calendar-board" aria-label="Monthly Calendar"><CalendarGrid month={month} selectedDate={date} today={localToday()} byDate={byDate} onSelect={onDateChange} /><p className="calendar-key-hint">Arrow keys move by day or week. Home and End move to the first and last day of the month.</p></section>
        <CalendarDaySummary date={date} tasks={byDate.get(date) || []} onOpenDaily={onOpenDaily} />
      </div>
    </>}
  </main>;
}
