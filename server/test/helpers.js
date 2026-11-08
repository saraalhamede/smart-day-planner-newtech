import session from 'express-session';

export const config = {
  secret: 'test-only-secret-not-for-deployment-32-characters',
  origin: 'http://127.0.0.1:5173', production: false, trustProxy: false,
};

export function testDependencies() {
  const rows = new Map();
  const store = new session.MemoryStore();
  let id = 0;
  return {
    config, store, rows,
    users: {
      async findById(userId) { return rows.get(userId) || null; },
      async findByEmail(email) { return [...rows.values()].find((row) => row.email === email) || null; },
      async findCredentialsById(userId) { return rows.get(userId) || null; },
      async updateName(userId, name) { const row = rows.get(userId); if (!row) return null; row.name = name; return row; },
      async updateEmail(userId, email, expectedHash) {
        const row = rows.get(userId);
        if (!row || row.password_hash !== expectedHash) return false;
        if ([...rows.values()].some(other => other.id !== userId && other.email === email)) throw Object.assign(new Error('Duplicate'), { code: 'ER_DUP_ENTRY' });
        row.email = email; return true;
      },
      async updatePassword(userId, expectedHash, passwordHash, sessionId) {
        const row = rows.get(userId);
        if (!row || row.password_hash !== expectedHash) return false;
        await new Promise((resolve,reject)=>store.destroy(sessionId,error=>error?reject(error):resolve()));
        row.password_hash = passwordHash; return true;
      },
      async create({ name, email, passwordHash }) {
        if ([...rows.values()].some((row) => row.email === email)) throw Object.assign(new Error('Duplicate'), { code: 'ER_DUP_ENTRY' });
        const user = { id: ++id, name, email, password_hash: passwordHash };
        rows.set(id, user);
        return user;
      },
    },
  };
}
