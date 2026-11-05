import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { connectDatabase } from '../src/database.js';

test('real MySQL: registration, independent sessions, restart persistence, invalid credentials and logout', async () => {
  const config = readConfig();
  assert.equal(config.production, false, 'Run integration tests in development mode on the local independent database.');
  const database = await connectDatabase(config);
  const emails = [0, 1].map((i) => `qa-${randomUUID()}-${i}@example.test`);
  const password = 'integration-only-passphrase';
  const users = [];
  const sessionIds = new Set();
  let restarted;
  const app = createApp({ config, ...database });
  // HTTPS is simulated only when running with the explicitly configured trusted proxy.
  const client = () => request.agent(app);
  const post = (agent, endpoint, body) => {
    let req = agent.post(`/api/auth/${endpoint}`).set('Origin', config.origin);
    if (config.production) req = req.set('X-Forwarded-Proto', 'https');
    return req.send(body);
  };
  try {
    const a = client(); const b = client();
    await request(app).get('/api/auth/me').expect(401);
    for (const [index, email] of emails.entries()) {
      const registered = await post(request(app), 'register', { name: `QA ${index}`, email, password }).expect(201);
      users.push(registered.body.user.id);
      assert.equal(registered.body.user.password_hash, undefined);
    }
    const [persisted] = await database.pool.execute('SELECT password_hash FROM users WHERE id = ?', [users[0]]);
    assert.match(persisted[0].password_hash, /^scrypt\$/);
    await post(request(app), 'register', { name: 'duplicate', email: emails[0], password }).expect(409);
    await post(a, 'login', { email: emails[0], password: 'wrong-password' }).expect(401);
    const firstLogin = await post(a, 'login', { email: emails[0], password }).expect(200);
    await post(b, 'login', { email: emails[1], password }).expect(200);
    const cookie = firstLogin.headers['set-cookie'][0].split(';')[0];
    assert.match(firstLogin.headers['set-cookie'][0], /HttpOnly/);
    const [sessions] = await database.pool.query('SELECT session_id, data FROM sessions');
    for (const row of sessions) {
      if (users.includes(JSON.parse(row.data).userId)) sessionIds.add(row.session_id);
    }
    assert.equal(sessionIds.size, 2);
    await a.get('/api/auth/me').expect(200).expect(({ body }) => assert.equal(body.user.id, users[0]));
    await b.get('/api/auth/me').expect(200).expect(({ body }) => assert.equal(body.user.id, users[1]));
    // A fresh connection and session store must restore the existing browser cookie.
    restarted = await connectDatabase(config);
    const secondApp = createApp({ config, ...restarted });
    await request(secondApp).get('/api/auth/me').set('Cookie', cookie).expect(200).expect(({ body }) => assert.equal(body.user.id, users[0]));
    await post(a, 'logout', {}).expect(204);
    await a.get('/api/auth/me').expect(401);
    await request(secondApp).get('/api/auth/me').set('Cookie', cookie).expect(401);
    await b.get('/api/auth/me').expect(200);
    await post(b, 'logout', {}).expect(204);
  } finally {
    if (restarted) await restarted.close();
    // Clean up only records created by this test, never unrelated users or databases.
    for (const id of sessionIds) await database.pool.execute('DELETE FROM sessions WHERE session_id = ?', [id]);
    for (const email of emails) await database.pool.execute('DELETE FROM users WHERE email = ?', [email]);
    await database.close();
  }
});
