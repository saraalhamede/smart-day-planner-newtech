import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { verifyPassword } from '../src/passwords.js';
import { testDependencies, config } from './helpers.js';

const password = 'account-only-test-passphrase';
const nextPassword = 'replacement-only-test-passphrase';
const write = (agent, method, path, body) => agent[method](path).set('Origin', config.origin).send(body);
async function fixture() {
  const deps = testDependencies(); const app = createApp(deps);
  for (const [i, email] of ['a@example.test', 'b@example.test'].entries()) await write(request(app), 'post', '/api/auth/register', { name: `Account ${i}`, email, password }).expect(201);
  const a = request.agent(app), second = request.agent(app), b = request.agent(app);
  let cookie;
  for (const [agent, email] of [[a,'a@example.test'],[second,'a@example.test'],[b,'b@example.test']]) {
    const login = await write(agent,'post','/api/auth/login',{email,password}).expect(200);
    if (agent === a) cookie = login.headers['set-cookie'][0].split(';')[0];
  }
  return { deps, app, a, second, b, cookie };
}
test('account routes require authentication and exact Origin; profile ownership and validation', async () => {
  const { app, a, b } = await fixture();
  for (const [method,path,body] of [['patch','profile',{name:'New'}],['patch','email',{email:'c@example.test',currentPassword:password}],['post','password',{currentPassword:password,newPassword:nextPassword}]]) {
    await write(request(app),method,`/api/account/${path}`,body).expect(401);
    await a[method](`/api/account/${path}`).send(body).expect(403);
    await a[method](`/api/account/${path}`).set('Origin','http://untrusted.test').send(body).expect(403);
  }
  const other = (await b.get('/api/auth/me')).body.user;
  for (const name of ['', ' ', null, 4, 'x'.repeat(101)]) await write(a,'patch','/api/account/profile',{name}).expect(400);
  for (const extra of [{user_id:2},{id:2},{password_hash:'x'}]) await write(a,'patch','/api/account/profile',{name:'Intruder',...extra}).expect(400);
  await write(a,'patch','/api/account/profile?user_id=2',{name:'  My new name  '}).expect(200).expect(({body})=>assert.deepEqual(body.user,{id:1,name:'My new name',email:'a@example.test'}));
  await a.get('/api/auth/me').expect(200).expect(({body})=>assert.equal(body.user.name,'My new name'));
  await b.get('/api/auth/me').expect(200).expect(({body})=>assert.deepEqual(body.user,other));
});
test('email requires credentials, normalizes like registration and rejects duplicates without ending session', async () => {
  const { a,b,app } = await fixture();
  for (const body of [{email:'c@example.test'},{email:'bad',currentPassword:password},{email:'x'.repeat(255),currentPassword:password},{email:'c@example.test',currentPassword:password,user_id:2}]) await write(a,'patch','/api/account/email',body).expect(400);
  await write(a,'patch','/api/account/email',{email:'c@example.test',currentPassword:'wrong'}).expect(401).expect(({body})=>assert.equal(body.code,'INVALID_CURRENT_PASSWORD'));
  await write(a,'patch','/api/account/email',{email:'b@example.test',currentPassword:password}).expect(409);
  await write(a,'patch','/api/account/email',{email:' UPDATED@EXAMPLE.TEST ',currentPassword:password}).expect(200).expect(({body})=>assert.deepEqual(body.user,{id:1,name:'Account 0',email:'updated@example.test'}));
  await a.get('/api/auth/me').expect(200).expect(({body})=>assert.equal(body.user.email,'updated@example.test'));
  await b.get('/api/auth/me').expect(200).expect(({body})=>assert.equal(body.user.email,'b@example.test'));
  await write(request(app),'post','/api/auth/login',{email:'a@example.test',password}).expect(401);
  await write(request(app),'post','/api/auth/login',{email:'updated@example.test',password}).expect(200);
});
test('password validates policy, hashes with fresh salt, revokes current cookie only and supports new login', async () => {
  const { a,second,b,app,deps,cookie } = await fixture();
  const before = deps.rows.get(1).password_hash;
  for (const newPassword of ['', 'short', 'x'.repeat(129), null]) await write(a,'post','/api/account/password',{currentPassword:password,newPassword}).expect(400);
  await write(a,'post','/api/account/password',{currentPassword:'wrong',newPassword:nextPassword}).expect(401);
  await write(a,'post','/api/account/password',{currentPassword:password,newPassword:password}).expect(400);
  await write(a,'post','/api/account/password',{currentPassword:password,newPassword:nextPassword,user_id:2}).expect(400);
  const changed = await write(a,'post','/api/account/password',{currentPassword:password,newPassword:nextPassword}).expect(204);
  assert.match(changed.headers['set-cookie'][0],/HttpOnly/); assert.match(changed.headers['set-cookie'][0],/SameSite=Lax/);
  assert.notEqual(before.split('$')[4],deps.rows.get(1).password_hash.split('$')[4]);
  assert.equal(await verifyPassword(nextPassword,deps.rows.get(1).password_hash),true);
  assert.equal(await verifyPassword(password,deps.rows.get(1).password_hash),false);
  assert.ok(!deps.rows.get(1).password_hash.includes(nextPassword));
  await a.get('/api/auth/me').expect(401);
  await request(app).get('/api/auth/me').set('Cookie',cookie).expect(401);
  await second.get('/api/auth/me').expect(200); await b.get('/api/auth/me').expect(200);
  await write(request(app),'post','/api/auth/login',{email:'a@example.test',password}).expect(401);
  await write(request(app),'post','/api/auth/login',{email:'a@example.test',password:nextPassword}).expect(200);
});
test('sensitive account rate limit is shared per authenticated account and leaves another account usable', async () => {
  const { a,second,b } = await fixture();
  for (let i=0;i<10;i++) await write(i%2?a:second,'patch','/api/account/email',{email:'c@example.test',currentPassword:'wrong'}).expect(401);
  await write(a,'post','/api/account/password',{currentPassword:password,newPassword:nextPassword}).expect(429);
  await write(b,'patch','/api/account/email',{email:'other@example.test',currentPassword:password}).expect(200);
});
test('unexpected account errors are redacted and failed session invalidation does not change password', async () => {
  const { a,deps } = await fixture();
  deps.users.updateName = async () => { throw new Error('private database connection details'); };
  await write(a,'patch','/api/account/profile',{name:'Changed'}).expect(500).expect(({body})=>assert.equal(body.error,'Something went wrong. Please try again.'));
  const before = deps.rows.get(1).password_hash;
  deps.store.destroy = (id,callback) => callback(new Error('private session store details'));
  await write(a,'post','/api/account/password',{currentPassword:password,newPassword:nextPassword}).expect(500);
  assert.equal(deps.rows.get(1).password_hash,before);
});
test('a stale update rejects credentials; a failed transaction returns a safe error without changing password', async () => {
  const { a,deps } = await fixture();
  const before = deps.rows.get(1).password_hash;
  deps.users.updatePassword = async () => false;
  await write(a,'post','/api/account/password',{currentPassword:password,newPassword:nextPassword}).expect(401).expect(({body})=>assert.equal(body.code,'INVALID_CURRENT_PASSWORD'));
  await a.get('/api/auth/me').expect(200);
  deps.users.updatePassword = async () => { throw new Error('private transaction failure'); };
  await write(a,'post','/api/account/password',{currentPassword:password,newPassword:nextPassword}).expect(500).expect(({body})=>assert.deepEqual(body,{error:'Something went wrong. Please try again.'}));
  assert.equal(deps.rows.get(1).password_hash,before);
  await a.get('/api/auth/me').expect(200);
});
