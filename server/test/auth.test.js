import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { testDependencies, config } from './helpers.js';

const account = { name: 'Sara', email: 'sara@example.test', password: 'a long unique passphrase' };
const post = (client, path, body) => client.post(`/api/auth/${path}`).set('Origin', config.origin).send(body);

test('registration, hashing, login, session restoration, isolation, rotation, logout and revoked-cookie replay', async () => {
  const deps = testDependencies();
  const app = createApp(deps);
  const alice = request.agent(app);
  const bob = request.agent(app);
  await request(app).get('/api/auth/me').expect(401);
  await request(app).get('/api/auth/me').set('userId', '1').expect(401);
  await post(request(app), 'register', { ...account, email: ' SARA@EXAMPLE.TEST ', userId: 900 }).expect(201).expect(({ body }) => {
    assert.deepEqual(body.user, { id: 1, name: 'Sara', email: account.email });
    assert.equal(body.user.password_hash, undefined);
  });
  const stored = deps.rows.get(1).password_hash;
  assert.match(stored, /^scrypt\$32768\$8\$1\$/);
  assert.ok(!stored.includes(account.password));
  await post(request(app), 'register', account).expect(409);
  await post(request(app), 'register', { ...account, email: 'bob@example.test', name: 'Bob' }).expect(201);
  await post(alice, 'login', { ...account, password: 'incorrect-password' }).expect(401);
  await post(alice, 'login', { ...account, email: 'missing@example.test' }).expect(401);
  const login = await post(alice, 'login', { ...account, userId: 2 }).expect(200);
  const firstCookie = login.headers['set-cookie'][0].split(';')[0];
  assert.match(login.headers['set-cookie'][0], /HttpOnly/);
  assert.match(login.headers['set-cookie'][0], /SameSite=Lax/);
  assert.equal(login.body.user.id, 1);
  await alice.get('/api/auth/me').expect(200).expect(({ body }) => assert.equal(body.user.id, 1));
  // A new HTTP client with the browser cookie represents a refreshed page.
  await request(app).get('/api/auth/me').set('Cookie', firstCookie).expect(200);
  await post(bob, 'login', { ...account, email: 'bob@example.test' }).expect(200);
  await bob.get('/api/auth/me').expect(200).expect(({ body }) => assert.equal(body.user.id, 2));
  const relogin = await post(alice, 'login', account).expect(200);
  const secondCookie = relogin.headers['set-cookie'][0].split(';')[0];
  assert.notEqual(firstCookie, secondCookie);
  await request(app).get('/api/auth/me').set('Cookie', firstCookie).expect(401);
  const logout = await post(alice, 'logout', {}).expect(204);
  assert.match(logout.headers['set-cookie'][0], /Expires=Thu, 01 Jan 1970/);
  await alice.get('/api/auth/me').expect(401);
  await request(app).get('/api/auth/me').set('Cookie', secondCookie).expect(401);
  await bob.get('/api/auth/me').expect(200);
  await post(request(app), 'logout', { userId: 2 }).expect(401);
});

test('invalid inputs, oversized bodies, malformed JSON and cross-site requests are rejected', async () => {
  const app = createApp(testDependencies());
  for (const data of [null, {}, { ...account, password: 'short' }, { ...account, password: 'a'.repeat(129) }, { ...account, name: ' ' }, { ...account, email: 'invalid' }, { ...account, name: 'x'.repeat(101) }]) {
    await post(request(app), 'register', data).expect(400);
  }
  await post(request(app), 'login', { email: {}, password: [] }).expect(400);
  await request(app).post('/api/auth/login').set('Origin', config.origin).set('Content-Type', 'application/json').send('{broken').expect(400);
  await post(request(app), 'register', { ...account, name: 'x'.repeat(9000) }).expect(413);
  for (const endpoint of ['login', 'register', 'logout']) {
    await request(app).post(`/api/auth/${endpoint}`).set('Origin', 'https://attacker.test').send(account).expect(403);
    await request(app).post(`/api/auth/${endpoint}`).send(account).expect(403);
  }
  await request(app).get('/api/missing').expect(404).expect('Cache-Control', 'no-store');
});

test('deleted users lose access and server errors do not leak database details', async () => {
  const deps = testDependencies();
  const app = createApp(deps);
  const agent = request.agent(app);
  await post(agent, 'register', account).expect(201);
  await post(agent, 'login', account).expect(200);
  deps.rows.clear();
  await agent.get('/api/auth/me').expect(401);
  deps.users.findByEmail = async () => { throw new Error('private-database-credential'); };
  await post(request(app), 'login', account).expect(500).expect(({ body }) => assert.ok(!JSON.stringify(body).includes('private-database-credential')));
});

test('production cookies require HTTPS and are HttpOnly, Secure and SameSite=Lax', async () => {
  const deps = testDependencies();
  deps.config = { ...config, production: true, trustProxy: true, origin: 'https://planner.example.test' };
  const app = createApp(deps);
  const securePost = (path) => request(app).post(`/api/auth/${path}`).set('Origin', deps.config.origin).set('X-Forwarded-Proto', 'https').send(account);
  await securePost('register').expect(201);
  const response = await securePost('login').expect(200);
  assert.match(response.headers['set-cookie'][0], /; Secure/);
  assert.match(response.headers['set-cookie'][0], /; HttpOnly/);
  assert.match(response.headers['set-cookie'][0], /; SameSite=Lax/);
});

test('authentication attempts are rate limited', async () => {
  const app = createApp(testDependencies());
  for (let i = 0; i < 30; i++) await post(request(app), 'login', {}).expect(400);
  await post(request(app), 'login', {}).expect(429);
});
