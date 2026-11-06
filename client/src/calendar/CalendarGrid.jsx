import { useEffect, useRef } from 'react';
import { keyboardDate, monthGrid, monthLabel, weekdayLabels } from './calendar-model.js';

export default function CalendarGrid({ month, selectedDate, today, byDate, onSelect }) {
  const buttons = useRef(new Map());
  const moveFocus = useRef(false);
  useEffect(() => {
    if (moveFocus.current) { buttons.current.get(selectedDate)?.focus(); moveFocus.current = false; }
  }, [selectedDate]);
  function navigate(event, date) {
    const next = keyboardDate(date, event.key);
    if (!next) return;
    event.preventDefault(); moveFocus.current = true; onSelect(next);
  }
  return <table className="month-grid" aria-label={`${monthLabel(month)} calendar`}>
    <thead><tr>{weekdayLabels.map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
    <tbody>{monthGrid(month).map((week, row) => <tr key={row}>{week.map((date, column) => <td key={date || `blank-${column}`} className={date ? '' : 'calendar-blank'}>
      {date && <button type="button" ref={(node) => { if (node) buttons.current.set(date, node); else buttons.current.delete(date); }}
        className={`calendar-day ${date === selectedDate ? 'is-selected' : ''} ${date === today ? 'is-today' : ''}`}
        tabIndex={date === selectedDate ? 0 : -1} aria-pressed={date === selectedDate} aria-current={date === today ? 'date' : undefined}
        aria-label={`${date}, ${byDate.get(date)?.length || 0} ${(byDate.get(date)?.length || 0) === 1 ? 'task' : 'tasks'}`}
        onClick={() => onSelect(date)} onKeyDown={(event) => navigate(event, date)}>
        <span className="calendar-day-number" aria-hidden="true">{Number(date.slice(8))}</span>
        {byDate.has(date) && <span className="day-task-count" aria-hidden="true">{byDate.get(date).length}<span className="task-count-word"> {byDate.get(date).length === 1 ? 'task' : 'tasks'}</span></span>}
      </button>}
    </td>)}</tr>)}</tbody>
  </table>;
}
