import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { connectDatabase } from '../src/database.js';
import { indexTasksForMonth } from '../../client/src/calendar/calendar-model.js';
import { taskStatistics } from '../../client/src/dashboard/dashboard-model.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function startBackend(port) {
  const child = spawn(process.execPath, ['server/src/index.js'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Backend startup timed out.')); }, 10000);
    child.stdout.on('data', (data) => { if (data.toString().includes('API ready')) { clearTimeout(timeout); resolve(); } });
    child.once('error', () => { clearTimeout(timeout); reject(new Error('Could not spawn backend.')); });
    child.once('exit', (code) => { clearTimeout(timeout); if (code !== null) reject(new Error('Backend exited before readiness.')); });
  });
  return child;
}

async function stopBackend(child) {
  if (child && child.exitCode === null && child.signalCode === null) {
    const stopped = new Promise((resolve) => child.once('exit', resolve));
    child.kill('SIGTERM');
    await stopped;
  }
}

test('real MySQL Tasks CRUD acceptance', async (t) => {
  const config = readConfig();
  assert.equal(config.production, false, 'Use the local development database for integration QA.');
  const db = await connectDatabase(config);
  const app = createApp({ config, ...db });
  const emails = [0, 1].map(() => `tasks-qa-${randomUUID()}@example.test`);
  const password = randomUUID() + randomUUID();
  const ids = [];
  const a = request.agent(app); const b = request.agent(app);
  const write = (client, method, path, body) => client[method](path).set('Origin', config.origin).send(body);
  const add = (body, agent = a) => write(agent, 'post', '/api/tasks', { title: 'QA task', task_date: '2032-03-01', ...body });
  let aCookie; let owned;
  try {
    for (const [index, client] of [a, b].entries()) {
      const user = await write(request(app), 'post', '/api/auth/register', { name: 'Tasks QA', email: emails[index], password }).expect(201);
      ids.push(user.body.user.id);
      const login = await write(client, 'post', '/api/auth/login', { email: emails[index], password }).expect(200);
      if (!index) aCookie = login.headers['set-cookie'][0].split(';')[0];
    }

    await t.test('create valid task with defaults, ownership and string date; GET both list URL variants', async () => {
      const created = await add({ title: '  First task  ', task_date: '2032-02-29' }).expect(201);
      owned = created.body.task;
      assert.equal(owned.user_id, ids[0]);
      assert.equal(owned.title, 'First task'); assert.equal(owned.priority, 'medium'); assert.equal(owned.status, 'waiting');
      assert.equal(owned.task_date, '2032-02-29'); assert.equal(owned.start_time, null); assert.equal(owned.end_time, null);
      await a.get(`/api/tasks/${owned.id}`).expect(200);
      for (const url of ['/api/tasks', '/api/tasks/']) await a.get(url).expect(200).expect(({ body }) => assert.ok(body.tasks.some((task) => task.id === owned.id)));
    });
    await t.test('invalid titles, dates, enum values, time pairs and injected ownership are rejected', async () => {
      for (const title of ['', ' ', 4, null, 'a'.repeat(181)]) await add({ title }).expect(400);
      for (const task_date of ['2025-02-29', '1900-02-29', '2100-02-29', '2026-04-31', '2026-11-00', '2026-13-01', '2026-1-01', '2026-01-01T00:00:00Z', '0000-01-01']) await add({ task_date }).expect(400);
      for (const body of [{ start_time: '09:00' }, { start_time: '10:00', end_time: '09:00' }, { start_time: '09:00', end_time: '09:00' }, { start_time: '23:00', end_time: '24:00' }, { priority: 'urgent' }, { status: 'done' }, { user_id: ids[1] }, { description: 'x'.repeat(2001) }]) await add(body).expect(400);
      await a.get('/api/tasks/1abc').expect(400);
      await a.get('/api/tasks?date=2026-02-30').expect(400);
      await a.get('/api/tasks?status=unknown').expect(400);
      await a.get('/api/tasks?user_id=2').expect(400);
    });
    await t.test('edit fields, change status manually and retain completed tasks', async () => {
      const changed = await write(a, 'patch', `/api/tasks/${owned.id}`, { title: 'Edited task', description: 'New details', priority: 'high', start_time: '09:00', end_time: '10:00' }).expect(200);
      assert.equal(changed.body.task.description, 'New details'); assert.equal(changed.body.task.priority, 'high'); assert.equal(changed.body.task.start_time, '09:00');
      for (const patch of [{ title: '' }, { task_date: '2026-02-30' }, { start_time: null }]) await write(a, 'patch', `/api/tasks/${owned.id}`, patch).expect(400);
      await a.get(`/api/tasks/${owned.id}`).expect(200).expect(({ body }) => { assert.equal(body.task.title, 'Edited task'); assert.equal(body.task.start_time, '09:00'); });
      await write(a, 'patch', `/api/tasks/${owned.id}`, { status: 'in_progress' }).expect(200);
      await write(a, 'patch', `/api/tasks/${owned.id}`, { status: 'completed' }).expect(200);
      await a.get(`/api/tasks/${owned.id}`).expect(200).expect(({ body }) => assert.equal(body.task.status, 'completed'));
      await write(a, 'patch', `/api/tasks/${owned.id}`, { start_time: null, end_time: null }).expect(200);
      await write(a, 'patch', `/api/tasks/${owned.id}`, {}).expect(400);
    });
    await t.test('one in-progress task per user/date on creation, edit and date move; rollback preserves old values', async () => {
      const active = (await add({ task_date: '2032-03-02', status: 'in_progress' }).expect(201)).body.task;
      await add({ task_date: '2032-03-02', status: 'in_progress' }).expect(409);
      const waiting = (await add({ task_date: '2032-03-02' }).expect(201)).body.task;
      await write(a, 'patch', `/api/tasks/${waiting.id}`, { status: 'in_progress' }).expect(409);
      const otherDay = (await add({ task_date: '2032-03-03', status: 'in_progress' }).expect(201)).body.task;
      await write(a, 'patch', `/api/tasks/${otherDay.id}`, { task_date: active.task_date }).expect(409);
      await a.get(`/api/tasks/${otherDay.id}`).expect(200).expect(({ body }) => assert.equal(body.task.task_date, '2032-03-03'));
      await add({ task_date: '2032-03-02', status: 'in_progress' }, b).expect(201);
      await write(a, 'patch', `/api/tasks/${active.id}`, { status: 'completed' }).expect(200);
      await write(a, 'patch', `/api/tasks/${waiting.id}`, { status: 'in_progress' }).expect(200);
    });
    await t.test('overlaps rejected on create, time edit and date move; adjacency and untimed tasks allowed', async () => {
      const timed = { task_date: '2032-03-04', start_time: '09:00', end_time: '10:00' };
      const first = (await add(timed).expect(201)).body.task;
      for (const [start_time, end_time] of [['09:30', '10:30'], ['08:30', '09:30'], ['08:00', '11:00'], ['09:00', '10:00']]) await add({ ...timed, start_time, end_time }).expect(409);
      const adjacent = (await add({ ...timed, start_time: '10:00', end_time: '11:00' }).expect(201)).body.task;
      await add({ ...timed, start_time: '08:00', end_time: '09:00' }).expect(201);
      await add({ task_date: timed.task_date }).expect(201);
      await write(a, 'patch', `/api/tasks/${adjacent.id}`, { start_time: '09:59' }).expect(409);
      const nextDay = (await add({ ...timed, task_date: '2032-03-05' }).expect(201)).body.task;
      await write(a, 'patch', `/api/tasks/${nextDay.id}`, { task_date: timed.task_date }).expect(409);
      await add(timed, b).expect(201);
      await write(a, 'patch', `/api/tasks/${first.id}`, { status: 'completed' }).expect(200);
      await add(timed).expect(409);
    });
    await t.test('date/status/priority filters combine correctly and exclude other users', async () => {
      await a.get('/api/tasks?date=2032-02-29&status=completed&priority=high').expect(200).expect(({ body }) => assert.deepEqual(body.tasks.map((task) => task.id), [owned.id]));
      await a.get('/api/tasks?priority=low').expect(200).expect(({ body }) => assert.equal(body.tasks.length, 0));
      await a.get('/api/tasks').expect(200).expect(({ body }) => assert.ok(body.tasks.every((task) => task.user_id === ids[0])));
    });
    await t.test('daily planner date/status flow reuses records, retains times and keeps other dates/users isolated', async () => {
      const day = '2032-03-08';
      const first = (await add({ title: 'Daily timed', task_date: day, start_time: '09:00', end_time: '10:00' }).expect(201)).body.task;
      const second = (await add({ title: 'Daily untimed', task_date: day }).expect(201)).body.task;
      const done = (await add({ title: 'Daily completed', task_date: day, start_time: '10:00', end_time: '11:00', status: 'completed' }).expect(201)).body.task;
      await add({ task_date: day }, b).expect(201);
      await write(a, 'patch', `/api/tasks/${first.id}`, { status: 'in_progress' }).expect(200);
      await write(a, 'patch', `/api/tasks/${second.id}`, { status: 'in_progress' }).expect(409);
      await write(a, 'patch', `/api/tasks/${first.id}`, { status: 'completed' }).expect(200);
      await write(a, 'patch', `/api/tasks/${second.id}`, { status: 'in_progress' }).expect(200);
      for (let i = 0; i < 2; i++) {
        const list = (await a.get(`/api/tasks?date=${day}`).expect(200)).body.tasks;
        assert.deepEqual(new Set(list.map((task) => task.id)), new Set([first.id, second.id, done.id]));
        assert.ok(list.every((task) => task.task_date === day && task.user_id === ids[0]));
        assert.equal(list.find((task) => task.id === first.id).status, 'completed');
        assert.equal(list.find((task) => task.id === first.id).start_time, '09:00');
        assert.equal(list.find((task) => task.id === first.id).end_time, '10:00');
        assert.equal(list.find((task) => task.id === second.id).start_time, null);
      }
      const [[count]] = await db.pool.execute('SELECT COUNT(*) AS total FROM tasks WHERE user_id = ? AND task_date = ?', [ids[0], day]);
      assert.equal(count.total, 3);
      await a.get(`/api/tasks?date=${day}&status=completed`).expect(200).expect(({ body }) => assert.equal(body.tasks.length, 2));
      await a.get(`/api/tasks?date=${day}&status=in_progress`).expect(200).expect(({ body }) => assert.equal(body.tasks[0].id, second.id));
    });
    await t.test('read-only Calendar counts match MySQL, isolate ownership, and leave task records unchanged', async () => {
      await add({ task_date: '2036-02-29', title: 'Calendar one' }).expect(201);
      await add({ task_date: '2036-02-29', title: 'Calendar two', status: 'completed' }).expect(201);
      await add({ task_date: '2036-02-28', title: 'Calendar earlier day' }).expect(201);
      await add({ task_date: '2036-03-01', title: 'Calendar other month' }).expect(201);
      await add({ task_date: '2036-02-29', title: 'Other owner' }, b).expect(201);
      const before = (await a.get('/api/tasks').expect(200)).body.tasks;
      const indexed = indexTasksForMonth(before, '2036-02');
      assert.equal(indexed.get('2036-02-29').length, 2);
      assert.equal(indexed.get('2036-02-28').length, 1);
      assert.equal(indexed.has('2036-03-01'), false);
      const [counts] = await db.pool.execute("SELECT DATE_FORMAT(task_date, '%Y-%m-%d') AS day, COUNT(*) AS total FROM tasks WHERE user_id = ? AND task_date >= '2036-02-01' AND task_date < '2036-03-01' GROUP BY task_date", [ids[0]]);
      for (const row of counts) assert.equal(indexed.get(row.day).length, row.total);
      for (let i = 0; i < 3; i++) {
        const after = (await a.get('/api/tasks').expect(200)).body.tasks;
        indexTasksForMonth(after, '2036-02');
        assert.deepEqual(after, before);
        assert.ok(after.every((task) => task.user_id === ids[0]));
      }
    });
    await t.test('Dashboard matches MySQL across dates, refreshes after completion/deletion, remains read-only and isolates owners', async () => {
      await request(app).get('/api/tasks').expect(401);
      const statisticsFor = async (agent, owner) => {
        const tasks = (await agent.get('/api/tasks').expect(200)).body.tasks;
        assert.ok(tasks.every(task => task.user_id === owner));
        const stats = taskStatistics(tasks);
        const [rows] = await db.pool.execute('SELECT status, COUNT(*) AS total FROM tasks WHERE user_id = ? GROUP BY status', [owner]);
        for (const status of ['waiting', 'in_progress', 'completed']) assert.equal(stats[status], rows.find(row => row.status === status)?.total || 0);
        assert.equal(stats.total, tasks.length);
        assert.equal(stats.total, stats.waiting + stats.in_progress + stats.completed);
        return { tasks, stats };
      };
      const original = await statisticsFor(a, ids[0]);
      const other = await statisticsFor(b, ids[1]);
      assert.ok(original.tasks.every(task => !other.tasks.some(item => item.id === task.id)));
      const fresh = (await add({ title: 'Dashboard update', task_date: '2040-01-01' }).expect(201)).body.task;
      const added = await statisticsFor(a, ids[0]);
      assert.equal(added.stats.total, original.stats.total + 1);
      await write(a, 'patch', `/api/tasks/${fresh.id}`, { status: 'completed' }).expect(200);
      const completed = await statisticsFor(a, ids[0]);
      assert.equal(completed.stats.completed, original.stats.completed + 1);
      assert.equal(completed.stats.completionRate, Math.round((completed.stats.completed / completed.stats.total) * 1000) / 10);
      for (let i = 0; i < 3; i++) assert.deepEqual(await statisticsFor(a, ids[0]), completed);
      await write(a, 'delete', `/api/tasks/${fresh.id}`).expect(204);
      assert.deepEqual(await statisticsFor(a, ids[0]), original);
      assert.deepEqual(await statisticsFor(b, ids[1]), other);
    });
    await t.test('other users cannot read, edit or delete tasks; owner override never accepted', async () => {
      await b.get(`/api/tasks/${owned.id}`).expect(404);
      await write(b, 'patch', `/api/tasks/${owned.id}`, { title: 'Stolen', user_id: ids[1] }).expect(404);
      await write(b, 'delete', `/api/tasks/${owned.id}`).expect(404);
      await write(a, 'patch', `/api/tasks/${owned.id}`, { user_id: ids[1] }).expect(400);
      await a.get(`/api/tasks/${owned.id}`).expect(200).expect(({ body }) => assert.equal(body.task.title, 'Edited task'));
      const otherTask = (await b.get('/api/tasks').expect(200)).body.tasks[0];
      await a.get(`/api/tasks/${otherTask.id}`).expect(404);
      await write(a, 'patch', `/api/tasks/${otherTask.id}`, { title: 'Stolen' }).expect(404);
      await write(a, 'delete', `/api/tasks/${otherTask.id}`).expect(404);
    });
    await t.test('all task endpoints require session authentication and write Origin checks remain active', async () => {
      for (const path of ['/api/tasks', `/api/tasks/${owned.id}`]) await request(app).get(path).expect(401);
      for (const [method, path] of [['post', '/api/tasks'], ['patch', `/api/tasks/${owned.id}`], ['delete', `/api/tasks/${owned.id}`]]) {
        await write(request(app), method, path, {}).expect(401);
        await a[method](path).set('Origin', 'https://attacker.test').send({}).expect(403);
      }
    });
    await t.test('concurrent overlapping creates are serialized: exactly one succeeds', async () => {
      const results = await Promise.all([0, 1].map(() => write(request(app), 'post', '/api/tasks', { title: 'Concurrent time', task_date: '2032-03-06', start_time: '09:00', end_time: '10:00' }).set('Cookie', aCookie)));
      assert.deepEqual(results.map((response) => response.status).sort(), [201, 409]);
    });
    await t.test('concurrent in-progress updates are serialized: exactly one succeeds', async () => {
      const one = (await add({ task_date: '2032-03-07' }).expect(201)).body.task;
      const two = (await add({ task_date: '2032-03-07' }).expect(201)).body.task;
      const results = await Promise.all([one, two].map((task) => write(request(app), 'patch', `/api/tasks/${task.id}`, { status: 'in_progress' }).set('Cookie', aCookie)));
      assert.deepEqual(results.map((response) => response.status).sort(), [200, 409]);
    });
    await t.test('database unique index enforces one in-progress task even outside the API', async () => {
      await assert.rejects(db.pool.execute("INSERT INTO tasks (user_id,title,description,task_date,status) VALUES (?, 'Direct QA', '', '2032-03-07', 'in_progress')", [ids[0]]), (error) => error.code === 'ER_DUP_ENTRY');
    });
    await t.test('tasks and the same login session persist after a real backend process restart', async () => {
      const port = await freePort();
      let backend;
      try {
        backend = await startBackend(port);
        const base = `http://127.0.0.1:${port}/api`;
        const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { Origin: config.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emails[0], password }) });
        assert.equal(login.status, 200);
        const cookie = login.headers.get('set-cookie').split(';')[0];
        const initial = await fetch(`${base}/tasks/${owned.id}`, { headers: { Cookie: cookie } });
        assert.equal(initial.status, 200); assert.equal((await initial.json()).task.task_date, '2032-02-29');
        await stopBackend(backend); backend = await startBackend(port);
        const restored = await fetch(`${base}/tasks/${owned.id}`, { headers: { Cookie: cookie } });
        assert.equal(restored.status, 200); assert.equal((await restored.json()).task.title, 'Edited task');
        assert.equal((await fetch(`${base}/auth/me`, { headers: { Cookie: cookie } })).status, 200);
      } finally { await stopBackend(backend); }
    });
    await t.test('delete removes only the selected task and subsequent reads return 404', async () => {
      await write(a, 'delete', `/api/tasks/${owned.id}`).expect(204);
      await a.get(`/api/tasks/${owned.id}`).expect(404);
      await write(a, 'delete', `/api/tasks/${owned.id}`).expect(404);
      await b.get('/api/tasks').expect(200).expect(({ body }) => assert.ok(body.tasks.length > 0));
    });
  } finally {
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      await db.pool.execute(`DELETE FROM tasks WHERE user_id IN (${placeholders})`, ids);
      await db.pool.execute(`DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') IN (${placeholders})`, ids);
      for (const email of emails) await db.pool.execute('DELETE FROM users WHERE email = ?', [email]);
    }
    await db.close();
  }
});
