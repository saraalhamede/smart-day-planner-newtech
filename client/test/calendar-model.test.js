import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { adjacentMonth, daysInMonth, indexTasksForMonth, isCalendarMonth, keyboardDate, monthGrid, monthLabel, weekdayLabels } from '../src/calendar/calendar-model.js';
import { selectedDay } from '../src/planner/planner-model.js';
import { workspaceFromSearch, workspaceUrl } from '../src/navigation.js';

test('monthly grids align with Monday–Sunday headers and contain each real date once', () => {
  assert.deepEqual(weekdayLabels, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  const november = monthGrid('2026-11').flat();
  assert.deepEqual(november.slice(0, 6), Array(6).fill(null));
  assert.equal(november[6], '2026-11-01');
  assert.equal(november[35], '2026-11-30');
  assert.equal(november.filter(Boolean).length, 30);
  assert.equal(new Set(november.filter(Boolean)).size, 30);
  assert.equal(monthGrid('2021-02').length, 4);
  assert.ok(monthGrid('2026-11').every((week) => week.length === 7));
  assert.equal(monthLabel('2026-11'), 'November 2026');
});

test('February grids respect leap years and century boundaries', () => {
  for (const [month, days] of [['2025-02', 28], ['2028-02', 29], ['1900-02', 28], ['2000-02', 29], ['2100-02', 28]]) {
    const dates = monthGrid(month).flat().filter(Boolean);
    assert.equal(daysInMonth(month), days);
    assert.equal(dates.length, days);
    assert.equal(dates.at(-1), `${month}-${days}`);
  }
  assert.equal(monthGrid('2028-02')[0][1], '2028-02-01');
});

test('month navigation crosses years and stops at the existing date range', () => {
  assert.equal(adjacentMonth('2026-12', 1), '2027-01');
  assert.equal(adjacentMonth('2027-01', -1), '2026-12');
  assert.equal(adjacentMonth('2028-03', -1), '2028-02');
  assert.equal(adjacentMonth('1000-01', -1), null);
  assert.equal(adjacentMonth('9999-12', 1), null);
  for (const value of ['', null, '2026-2', '2026-13', '0999-12']) { assert.equal(isCalendarMonth(value), false); assert.equal(adjacentMonth(value, 1), null); }
});

const tasks = Object.freeze([
  Object.freeze({ id: 1, task_date: '2028-02-29', title: 'One', status: 'waiting', priority: 'high', start_time: '09:00', end_time: '10:00' }),
  Object.freeze({ id: 2, task_date: '2028-02-29', title: 'Two', status: 'completed', priority: 'medium', start_time: null, end_time: null }),
  Object.freeze({ id: 3, task_date: '2028-02-28', title: 'Three', status: 'in_progress', start_time: null, end_time: null }),
  Object.freeze({ id: 4, task_date: '2028-03-01', title: 'Other month', status: 'waiting', start_time: null, end_time: null }),
]);

test('date indicators count all statuses and multiple tasks without changing or duplicating records', () => {
  const before = JSON.stringify(tasks);
  const index = indexTasksForMonth(tasks, '2028-02');
  assert.equal(index.size, 2);
  assert.equal(index.get('2028-02-29').length, 2);
  assert.deepEqual(index.get('2028-02-29').map((task) => task.id), [1, 2]);
  assert.equal(index.get('2028-02-28').length, 1);
  const indexed = [...index.values()].flat();
  assert.equal(indexed.length, new Set(indexed.map((task) => task.id)).size);
  assert.equal(JSON.stringify(tasks), before);
});

test('empty days and months stay empty and adjacent-month tasks are excluded', () => {
  const index = indexTasksForMonth(tasks, '2028-02');
  assert.equal(index.get('2028-02-27'), undefined);
  assert.equal(index.has('2028-03-01'), false);
  assert.equal(indexTasksForMonth(tasks, '2027-02').size, 0);
  assert.equal(indexTasksForMonth([], '2028-02').size, 0);
});

test('keyboard navigation supports days, weeks, month ends and year boundaries', () => {
  assert.equal(keyboardDate('2028-02-29', 'ArrowRight'), '2028-03-01');
  assert.equal(keyboardDate('2028-03-01', 'ArrowLeft'), '2028-02-29');
  assert.equal(keyboardDate('2026-12-28', 'ArrowDown'), '2027-01-04');
  assert.equal(keyboardDate('2027-01-04', 'ArrowUp'), '2026-12-28');
  assert.equal(keyboardDate('2028-02-15', 'Home'), '2028-02-01');
  assert.equal(keyboardDate('2028-02-15', 'End'), '2028-02-29');
  assert.equal(keyboardDate('1000-01-01', 'ArrowLeft'), null);
  assert.equal(keyboardDate('2028-02-15', 'Tab'), null);
});

test('month layout stays identical in positive and negative time zones', () => {
  const url = new URL('../src/calendar/calendar-model.js', import.meta.url).href;
  const code = `import {monthGrid} from ${JSON.stringify(url)}; console.log(JSON.stringify(monthGrid('2028-02')));`;
  for (const zone of ['Asia/Jerusalem', 'Pacific/Kiritimati', 'America/Los_Angeles']) {
    const grid = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', env: { ...process.env, TZ: zone } }));
    assert.deepEqual(grid, monthGrid('2028-02'), zone);
  }
});

test('Calendar and Daily Planner share the selected date and restore the requested view after refresh', () => {
  const calendar = workspaceUrl('http://127.0.0.1:5173/', { view: 'calendar', day: '2028-02-29' });
  const daily = workspaceUrl(`http://127.0.0.1:5173${calendar}`, { view: 'planner' });
  const back = workspaceUrl(`http://127.0.0.1:5173${daily}`, { view: 'calendar' });
  for (const [path, view] of [[calendar, 'calendar'], [daily, 'planner'], [back, 'calendar']]) {
    const search = new URL(path, 'http://127.0.0.1:5173').search;
    assert.equal(workspaceFromSearch(search), view);
    assert.equal(selectedDay(search), '2028-02-29');
  }
  assert.equal(workspaceFromSearch('?view=dashboard'), 'planner');
  assert.equal(workspaceFromSearch(''), 'planner');
  assert.throws(() => workspaceUrl('http://127.0.0.1:5173/', { day: '2027-02-29' }));
});
