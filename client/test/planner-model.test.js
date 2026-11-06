import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { adjacentDate, dailyView, isPlannerDate, localToday, selectedDay } from '../src/planner/planner-model.js';

test('today uses the local calendar near midnight in both positive and negative time zones', () => {
  assert.equal(localToday(new Date(2026, 10, 6, 0, 5)), '2026-11-06');
  const modelUrl = new URL('../src/planner/planner-model.js', import.meta.url).href;
  for (const zone of ['Asia/Jerusalem', 'Pacific/Kiritimati', 'America/Los_Angeles']) {
    const code = `import {localToday} from ${JSON.stringify(modelUrl)}; console.log(localToday(new Date(2026,0,1,0,5))); console.log(localToday(new Date(2026,11,31,23,55)));`;
    const dates = execFileSync(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, TZ: zone }, encoding: 'utf8' }).trim().split(/\r?\n/);
    assert.deepEqual(dates, ['2026-01-01', '2026-12-31'], zone);
  }
});

test('previous and next date cross month/year and leap boundaries in both directions', () => {
  for (const [from, to] of [['2026-12-31', '2027-01-01'], ['2026-04-30', '2026-05-01'], ['2026-02-28', '2026-03-01'], ['2028-02-28', '2028-02-29'], ['2028-02-29', '2028-03-01'], ['1900-02-28', '1900-03-01'], ['2000-02-28', '2000-02-29'], ['2100-02-28', '2100-03-01']]) {
    assert.equal(adjacentDate(from, 1), to);
    assert.equal(adjacentDate(to, -1), from);
  }
  assert.equal(adjacentDate('1000-01-01', -1), null);
  assert.equal(adjacentDate('9999-12-31', 1), null);
});

test('invalid selected dates are rejected and only a valid URL day restores after refresh', () => {
  for (const value of ['', null, '2026-2-01', '2026-02-30', '2027-02-29', '2026-01-01T00:00:00Z', '0999-12-31']) {
    assert.equal(isPlannerDate(value), false);
    assert.equal(adjacentDate(value, 1), null);
  }
  assert.equal(selectedDay('?day=2028-02-29', '2026-11-06'), '2028-02-29');
  assert.equal(selectedDay('?day=2027-02-29', '2026-11-06'), '2026-11-06');
  assert.equal(selectedDay('', '2026-11-06'), '2026-11-06');
});

const date = '2028-02-29';
const tasks = [
  { id: 1, task_date: date, status: 'waiting', title: 'Later', start_time: '14:00', end_time: '15:00' },
  { id: 2, task_date: date, status: 'in_progress', title: 'Active', start_time: '09:00', end_time: '10:00' },
  { id: 3, task_date: date, status: 'completed', title: 'Done', start_time: '08:00', end_time: '09:00' },
  { id: 4, task_date: date, status: 'waiting', title: 'Untimed', start_time: null, end_time: null },
  { id: 5, task_date: '2028-03-01', status: 'waiting', title: 'Other day', start_time: '07:00', end_time: '08:00' },
];

test('daily status sections include only the selected date and preserve completed tasks', () => {
  const view = dailyView(tasks, date);
  assert.deepEqual(view.waiting.map((task) => task.id), [1, 4]);
  assert.deepEqual(view.in_progress.map((task) => task.id), [2]);
  assert.deepEqual(view.completed.map((task) => task.id), [3]);
  assert.equal(dailyView(tasks, '2026-11-06').waiting.length, 0);
});

test('timeline sorts all statuses by start time, separates untimed tasks and never mutates or duplicates records', () => {
  const original = JSON.stringify(tasks);
  const view = dailyView(tasks, date);
  assert.deepEqual(view.timed.map((task) => task.id), [3, 2, 1]);
  assert.deepEqual(view.untimed.map((task) => task.id), [4]);
  const sections = [...view.waiting, ...view.in_progress, ...view.completed];
  assert.equal(new Set(sections.map((task) => task.id)).size, 4);
  assert.deepEqual(new Set([...view.timed, ...view.untimed].map((task) => task.id)), new Set(sections.map((task) => task.id)));
  assert.equal(JSON.stringify(tasks), original);
});
