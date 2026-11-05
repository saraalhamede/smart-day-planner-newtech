import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig, DATABASE_NAME } from '../src/config.js';
import { hashPassword, verifyPassword } from '../src/passwords.js';

const env = { SESSION_SECRET: 'a'.repeat(48), CLIENT_ORIGIN: 'http://127.0.0.1:5173', DB_NAME: DATABASE_NAME, DB_USER: 'test-user', DB_PASSWORD: 'test-only-password' };

test('config confines database access and validates required local settings', () => {
  assert.equal(readConfig(env).db.database, DATABASE_NAME);
  for (const patch of [{ DB_NAME: 'another_database' }, { SESSION_SECRET: 'short' }, { DB_PASSWORD: '' }, { DB_PASSWORD: 'replace-locally' }, { CLIENT_ORIGIN: 'http://localhost:5173/' }, { CLIENT_ORIGIN: 'file:///tmp' }, { PORT: 'NaN' }, { DB_PORT: '-1' }, { NODE_ENV: 'production' }]) {
    assert.throws(() => readConfig({ ...env, ...patch }));
  }
  assert.equal(readConfig({ ...env, NODE_ENV: 'production', CLIENT_ORIGIN: 'https://planner.example.test' }).production, true);
});

test('password hashing uses unique salts and verifies passwords safely', async () => {
  const password = 'a very long test passphrase';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('wrong', first), false);
  assert.equal(await verifyPassword(password, 'invalid'), false);
});
