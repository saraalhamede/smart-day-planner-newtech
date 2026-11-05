export function createUserRepository(pool) {
  return {
    async findById(id) {
      const [rows] = await pool.execute('SELECT id, name, email FROM users WHERE id = ?', [id]);
      return rows[0] || null;
    },
    async findByEmail(email) {
      const [rows] = await pool.execute('SELECT id, name, email, password_hash FROM users WHERE email = ?', [email]);
      return rows[0] || null;
    },
    async create({ name, email, passwordHash }) {
      const [result] = await pool.execute('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, passwordHash]);
      return { id: result.insertId, name, email };
    },
  };
}
