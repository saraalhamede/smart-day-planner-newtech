import session from 'express-session';

export const config = {
  secret: 'test-only-secret-not-for-deployment-32-characters',
  origin: 'http://127.0.0.1:5173', production: false, trustProxy: false,
};

export function testDependencies() {
  const rows = new Map();
  let id = 0;
  return {
    config, store: new session.MemoryStore(), rows,
    users: {
      async findById(userId) { return rows.get(userId) || null; },
      async findByEmail(email) { return [...rows.values()].find((row) => row.email === email) || null; },
      async create({ name, email, passwordHash }) {
        if ([...rows.values()].some((row) => row.email === email)) throw Object.assign(new Error('Duplicate'), { code: 'ER_DUP_ENTRY' });
        const user = { id: ++id, name, email, password_hash: passwordHash };
        rows.set(id, user);
        return user;
      },
    },
  };
}
