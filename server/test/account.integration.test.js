import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { readConfig } from '../src/config.js';
import { createApp } from '../src/app.js';
import { connectDatabase } from '../src/database.js';
import { hashPassword, verifyPassword } from '../src/passwords.js';
import { createUserRepository } from '../src/users.js';

async function unusedPort() {
  const server = createServer();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const port = server.address().port;
  await new Promise(resolve=>server.close(resolve)); return port;
}
async function startBackend(port) {
  const child = spawn(process.execPath,['server/src/index.js'],{cwd:fileURLToPath(new URL('../../',import.meta.url)),env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe'],windowsHide:true});
  await new Promise((resolve,reject)=>{
    const timer = setTimeout(()=>{child.kill();reject(new Error('QA backend startup timed out.'));},10000);
    child.stdout.on('data',chunk=>{if(chunk.toString().includes('API ready')){clearTimeout(timer);resolve();}});
    child.once('error',()=>{clearTimeout(timer);reject(new Error('QA backend could not start.'));});
    child.once('exit',()=>{clearTimeout(timer);reject(new Error('QA backend exited.'));});
  });
  return child;
}
async function stopBackend(child) {
  if (child && child.exitCode === null && child.signalCode === null) {
    const stopped = new Promise(resolve=>child.once('exit',resolve)); child.kill('SIGTERM'); await stopped;
  }
}

test('real MySQL Profile Settings with isolated retained QA accounts', async t => {
  const config = readConfig(); assert.equal(config.production,false);
  const db = await connectDatabase(config);
  const app = createApp({config,...db});
  const emails = [0,1].map(()=>`settings-qa-${randomUUID()}@example.test`);
  const updatedEmail = `settings-updated-${randomUUID()}@example.test`;
  const password = randomUUID()+randomUUID(), newPassword = randomUUID()+randomUUID();
  const ids = [], snapshots = [];
  const a = request.agent(app), otherSession = request.agent(app), b = request.agent(app);
  const write = (client,method,path,body)=>client[method](path).set('Origin',config.origin).send(body);
  let oldHash, otherCookie, currentCookie;
  try {
    for (const [index,client] of [a,b].entries()) {
      const registered = await write(request(app),'post','/api/auth/register',{name:`Settings QA ${index}`,email:emails[index],password}).expect(201);
      ids.push(registered.body.user.id);
      const login = await write(client,'post','/api/auth/login',{email:emails[index],password}).expect(200);
      if (!index) currentCookie=login.headers['set-cookie'][0].split(';')[0];
      const added = await write(client,'post','/api/tasks',{title:`Settings retained task ${index}`,task_date:'2032-02-29',priority:'high'}).expect(201);
      snapshots.push(added.body.task);
    }
    const secondLogin = await write(otherSession,'post','/api/auth/login',{email:emails[0],password}).expect(200);
    otherCookie=secondLogin.headers['set-cookie'][0].split(';')[0];
    oldHash=(await db.users.findCredentialsById(ids[0])).password_hash;
    await t.test('all account endpoints require sessions and exact Origin',async()=>{
      for (const [method,path,body] of [['patch','profile',{name:'Updated'}],['patch','email',{email:updatedEmail,currentPassword:password}],['post','password',{currentPassword:password,newPassword}]]) {
        await write(request(app),method,`/api/account/${path}`,body).expect(401);
        await a[method](`/api/account/${path}`).send(body).expect(403);
        await a[method](`/api/account/${path}`).set('Origin','http://invalid.test').send(body).expect(403);
      }
    });
    await t.test('name validation, authenticated ownership and session continuity',async()=>{
      for (const name of ['',' ','x'.repeat(101),null]) await write(a,'patch','/api/account/profile',{name}).expect(400);
      await write(a,'patch','/api/account/profile',{name:'Other user',user_id:ids[1]}).expect(400);
      await write(a,'patch','/api/account/profile',{name:'  Updated Settings QA  '}).expect(200).expect(({body})=>assert.deepEqual(body.user,{id:ids[0],name:'Updated Settings QA',email:emails[0]}));
      await a.get('/api/auth/me').expect(200).expect(({body})=>assert.equal(body.user.name,'Updated Settings QA'));
      await b.get('/api/auth/me').expect(200).expect(({body})=>assert.equal(body.user.name,'Settings QA 1'));
    });
    await t.test('email credentials, duplicate unique constraint, normalization and refresh',async()=>{
      await write(a,'patch','/api/account/email',{email:updatedEmail}).expect(400);
      await write(a,'patch','/api/account/email',{email:updatedEmail,currentPassword:'wrong'}).expect(401);
      await write(a,'patch','/api/account/email',{email:emails[1],currentPassword:password}).expect(409);
      await write(a,'patch','/api/account/email',{email:'bad',currentPassword:password}).expect(400);
      await write(a,'patch','/api/account/email',{email:` ${updatedEmail.toUpperCase()} `,currentPassword:password}).expect(200).expect(({body})=>assert.equal(body.user.email,updatedEmail));
      await write(a,'patch','/api/account/email',{email:updatedEmail,currentPassword:password}).expect(200);
      await otherSession.get('/api/auth/me').expect(200).expect(({body})=>assert.equal(body.user.email,updatedEmail));
      await write(request(app),'post','/api/auth/login',{email:emails[0],password}).expect(401);
      const fresh = request.agent(app);
      await write(fresh,'post','/api/auth/login',{email:updatedEmail,password}).expect(200);
      await write(fresh,'post','/api/auth/logout',{}).expect(204);
    });
    await t.test('missing current session rolls back the real password transaction',async()=>{
      const proposed = await hashPassword(newPassword);
      assert.equal(await db.users.updatePassword(ids[0],oldHash,proposed,`missing-qa-session-${randomUUID()}`),false);
      assert.equal((await db.users.findCredentialsById(ids[0])).password_hash,oldHash);
    });
    await t.test('a session deletion SQL failure rolls back the pending password update',async()=>{
      const repository = createUserRepository({ async getConnection() {
        const c = await db.pool.getConnection();
        return {
          beginTransaction:()=>c.beginTransaction(), commit:()=>c.commit(), rollback:()=>c.rollback(), release:()=>c.release(),
          execute:(sql,values)=>sql.startsWith('DELETE FROM sessions') ? Promise.reject(new Error('Synthetic session SQL failure')) : c.execute(sql,values),
        };
      }});
      await assert.rejects(repository.updatePassword(ids[0],oldHash,await hashPassword(newPassword),'synthetic-session-id'));
      assert.equal((await db.users.findCredentialsById(ids[0])).password_hash,oldHash);
    });
    await t.test('password policy, fresh hash, current-session revocation and other-session behavior',async()=>{
      await write(a,'post','/api/account/password',{currentPassword:'wrong',newPassword}).expect(401);
      await write(a,'post','/api/account/password',{currentPassword:password,newPassword:'weak'}).expect(400);
      await write(a,'post','/api/account/password',{currentPassword:password,newPassword:password}).expect(400);
      await write(a,'post','/api/account/password',{currentPassword:password,newPassword}).expect(204);
      const hash=(await db.users.findCredentialsById(ids[0])).password_hash;
      assert.notEqual(hash.split('$')[4],oldHash.split('$')[4]);
      assert.equal(await verifyPassword(newPassword,hash),true); assert.equal(await verifyPassword(password,hash),false);
      assert.ok(!hash.includes(newPassword));
      await a.get('/api/auth/me').expect(401);
      await request(app).get('/api/auth/me').set('Cookie',currentCookie).expect(401);
      await otherSession.get('/api/auth/me').expect(200); await b.get('/api/auth/me').expect(200);
      await write(request(app),'post','/api/auth/login',{email:updatedEmail,password}).expect(401);
      await write(a,'post','/api/auth/login',{email:updatedEmail,password:newPassword}).expect(200);
    });
    await t.test('stale credentials cannot overwrite newer email/password and tasks stay byte-for-byte intact',async()=>{
      assert.equal(await db.users.updateEmail(ids[0],emails[0],oldHash),false);
      assert.equal(await db.users.updatePassword(ids[0],oldHash,await hashPassword(password),`stale-qa-session-${randomUUID()}`),false);
      for (const [index,client] of [a,b].entries()) {
        const task = await client.get(`/api/tasks/${snapshots[index].id}`).expect(200);
        assert.deepEqual(task.body.task,snapshots[index]);
      }
      await b.get(`/api/tasks/${snapshots[0].id}`).expect(404);
    });
    await t.test('password update with a single-connection pool completes without session-store pool starvation',async()=>{
      const single = await connectDatabase({...config,db:{...config.db,connectionLimit:1}});
      try {
        const client=request.agent(createApp({config,...single}));
        const finalPassword=randomUUID()+randomUUID();
        await write(client,'post','/api/auth/login',{email:updatedEmail,password:newPassword}).expect(200);
        await write(client,'post','/api/account/password',{currentPassword:newPassword,newPassword:finalPassword}).timeout({response:3000,deadline:5000}).expect(204);
        await client.get('/api/auth/me').expect(401);
        await write(client,'post','/api/auth/login',{email:updatedEmail,password:newPassword}).expect(401);
        await write(client,'post','/api/auth/login',{email:updatedEmail,password:finalPassword}).expect(200);
        await write(client,'post','/api/auth/logout',{}).expect(204);
      } finally { await single.close(); }
    });
    await t.test('account changes, surviving session and tasks persist across actual QA backend restart',async()=>{
      const port=await unusedPort(); let child;
      try {
        child=await startBackend(port);
        for (let run=0;run<2;run++) {
          const me=await fetch(`http://127.0.0.1:${port}/api/auth/me`,{headers:{Cookie:otherCookie}});
          assert.equal(me.status,200); assert.deepEqual((await me.json()).user,{id:ids[0],name:'Updated Settings QA',email:updatedEmail});
          const tasks=await fetch(`http://127.0.0.1:${port}/api/tasks`,{headers:{Cookie:otherCookie}});
          assert.equal(tasks.status,200); assert.deepEqual((await tasks.json()).tasks,[snapshots[0]]);
          if(!run){await stopBackend(child);child=await startBackend(port);}
        }
      } finally {await stopBackend(child);}
    });
    for (const client of [a,b,otherSession]) await write(client,'post','/api/auth/logout',{}).expect(204);
  } finally {
    console.log(JSON.stringify({retainedSettingsQaUserIds:ids,retainedSettingsTaskIds:snapshots.map(task=>task.id)}));
    await db.close();
  }
});
