import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taskStatistics } from '../src/dashboard/dashboard-model.js';
import { workspaceFromSearch, workspaceUrl } from '../src/navigation.js';
import { selectedDay } from '../src/planner/planner-model.js';

const task = (id, status) => ({ id, status });
test('empty dashboard has zero counts and 0.0 percent', () => {
  assert.deepEqual(taskStatistics([]), { total: 0, waiting: 0, in_progress: 0, completed: 0, completionRate: 0 });
  assert.equal(taskStatistics([]).completionRate.toFixed(1), '0.0');
});
test('only waiting tasks are counted once with no completions', () => {
  assert.deepEqual(taskStatistics([task(1, 'waiting'), task(2, 'waiting')]), { total: 2, waiting: 2, in_progress: 0, completed: 0, completionRate: 0 });
});
test('only completed tasks remain included in total with 100.0 percent', () => {
  assert.deepEqual(taskStatistics([task(1, 'completed'), task(2, 'completed')]), { total: 2, waiting: 0, in_progress: 0, completed: 2, completionRate: 100 });
});
test('mixed statuses across all dates count each task exactly once without mutation', () => {
  const tasks = Object.freeze([
    Object.freeze({ ...task(1, 'waiting'), task_date: '2025-01-01' }),
    Object.freeze({ ...task(2, 'in_progress'), task_date: '2026-11-06' }),
    Object.freeze({ ...task(3, 'completed'), task_date: '2028-02-29' }),
    Object.freeze({ ...task(4, 'completed'), task_date: '2028-03-01' }),
  ]);
  const before = JSON.stringify(tasks);
  const stats = taskStatistics(tasks);
  assert.deepEqual(stats, { total: 4, waiting: 1, in_progress: 1, completed: 2, completionRate: 50 });
  assert.equal(stats.total, stats.waiting + stats.in_progress + stats.completed);
  assert.equal(stats.total, tasks.length);
  assert.equal(JSON.stringify(tasks), before);
});
test('completion percentages round to one decimal place in both directions', () => {
  assert.equal(taskStatistics([task(1, 'completed'), task(2, 'waiting'), task(3, 'waiting')]).completionRate.toFixed(1), '33.3');
  assert.equal(taskStatistics([task(1, 'completed'), task(2, 'completed'), task(3, 'waiting')]).completionRate.toFixed(1), '66.7');
  assert.equal(taskStatistics(Array.from({ length: 16 }, (_, i) => task(i, i === 0 ? 'completed' : 'waiting'))).completionRate, 6.3);
});
test('fresh data after task completion updates the status counts and rate', () => {
  const before = [task(1, 'waiting'), task(2, 'in_progress')];
  const after = before.map(item => item.id === 2 ? { ...item, status: 'completed' } : item);
  assert.equal(taskStatistics(before).completionRate, 0);
  assert.deepEqual(taskStatistics(after), { total: 2, waiting: 1, in_progress: 0, completed: 1, completionRate: 50 });
});
test('fresh data after deletion and a serialized refresh uses the remaining tasks only', () => {
  const tasks = [task(1, 'completed'), task(2, 'waiting'), task(3, 'waiting')];
  const remaining = tasks.filter(item => item.id !== 2);
  assert.equal(taskStatistics(tasks).completionRate, 33.3);
  assert.equal(taskStatistics(remaining).completionRate, 50);
  assert.deepEqual(taskStatistics(JSON.parse(JSON.stringify(remaining))), taskStatistics(remaining));
});
test('Dashboard navigation restores view on refresh and preserves the planner date', () => {
  const path = workspaceUrl('http://127.0.0.1:5173/?view=calendar&day=2028-02-29', { view: 'dashboard' });
  const search = new URL(path, 'http://127.0.0.1:5173').search;
  assert.equal(workspaceFromSearch(search), 'dashboard');
  assert.equal(selectedDay(search), '2028-02-29');
});
