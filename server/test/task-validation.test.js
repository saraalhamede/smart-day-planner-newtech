import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCalendarDate, validateTask, validateFilters, validateId } from '../src/tasks/validation.js';

const valid = { title: 'Read a chapter', task_date: '2032-02-29' };

test('calendar validation handles real dates, leap centuries and MySQL range without UTC conversion', () => {
  for (const date of ['2000-02-29', '2024-02-29', '2032-02-29', '1000-01-01', '9999-12-31']) assert.equal(isCalendarDate(date), true, date);
  for (const date of ['1900-02-29', '2100-02-29', '2025-02-29', '2026-04-31', '2026-00-10', '2026-13-01', '2026-01-00', '2026-1-01', '2026-01-01T00:00:00Z', '0999-12-31', '', null, 20260101]) assert.equal(isCalendarDate(date), false, String(date));
});

test('task validation enforces titles, defaults, partial updates and field allowlist', () => {
  assert.deepEqual(validateTask({ ...valid, title: '  Read a chapter  ' }), { ...valid, description: '', start_time: null, end_time: null, priority: 'medium', status: 'waiting' });
  for (const title of ['', '  ', null, 3, 'x'.repeat(181)]) assert.throws(() => validateTask({ ...valid, title }));
  assert.equal(validateTask({ ...valid, title: 'x'.repeat(180) }).title.length, 180);
  assert.equal(validateTask({ status: 'completed' }, validateTask(valid)).status, 'completed');
  for (const patch of [{ user_id: 2 }, { id: 7 }, { created_at: '2030-01-01' }, { priority: 'urgent' }, { status: 'done' }, { description: null }, { description: 'x'.repeat(2001) }]) assert.throws(() => validateTask({ ...valid, ...patch }));
  for (const value of [null, [], 'text']) assert.throws(() => validateTask(value));
  assert.throws(() => validateTask({}, validateTask(valid)));
});

test('time validation supports untimed tasks and strictly ordered minute intervals', () => {
  assert.equal(validateTask(valid).start_time, null);
  assert.equal(validateTask({ ...valid, start_time: '00:00', end_time: '23:59' }).end_time, '23:59');
  for (const times of [{ start_time: '09:00' }, { end_time: '10:00' }, { start_time: '', end_time: '' }, { start_time: '10:00', end_time: '09:00' }, { start_time: '10:00', end_time: '10:00' }, { start_time: '9:00', end_time: '10:00' }, { start_time: '23:00', end_time: '24:00' }, { start_time: '09:00:00', end_time: '10:00' }]) assert.throws(() => validateTask({ ...valid, ...times }));
});

test('query validation rejects invalid filters, arrays, owner overrides and IDs', () => {
  assert.deepEqual(validateFilters({ date: valid.task_date, status: 'waiting', priority: 'high' }), { date: valid.task_date, status: 'waiting', priority: 'high' });
  for (const filters of [{ date: '2026-02-30' }, { status: ['waiting', 'completed'] }, { user_id: '2' }, { priority: 'urgent' }]) assert.throws(() => validateFilters(filters));
  for (const id of ['0', '-1', '1abc', '1.2', '4294967296', '01']) assert.throws(() => validateId(id));
  assert.equal(validateId('123'), 123);
});
