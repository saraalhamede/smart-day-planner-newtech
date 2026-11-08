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
    async findCredentialsById(id) {
      const [rows] = await pool.execute('SELECT id, password_hash FROM users WHERE id = ?', [id]);
      return rows[0] || null;
    },
    async updateName(id, name) {
      await pool.execute('UPDATE users SET name = ? WHERE id = ?', [name, id]);
      const [rows] = await pool.execute('SELECT id, name, email FROM users WHERE id = ?', [id]);
      return rows[0] || null;
    },
    async updateEmail(id, email, expectedHash) {
      const [result] = await pool.execute('UPDATE users SET email = ? WHERE id = ? AND password_hash = ?', [email, id, expectedHash]);
      return result.affectedRows > 0;
    },
    async updatePassword(id, expectedHash, passwordHash, sessionId) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [rows] = await connection.execute('SELECT password_hash FROM users WHERE id = ? FOR UPDATE', [id]);
        if (!rows[0] || rows[0].password_hash !== expectedHash) { await connection.rollback(); return false; }
        await connection.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
        // Same MySQL connection: credential update and current-session revocation commit or roll back together.
        // Do not call the pool-backed session store while holding a pool connection (pool starvation).
        const [session] = await connection.execute("DELETE FROM sessions WHERE session_id = ? AND JSON_EXTRACT(data, '$.userId') = ?", [sessionId, id]);
        if (!session.affectedRows) { await connection.rollback(); return false; }
        await connection.commit();
        return true;
      } catch (error) { await connection.rollback(); throw error; }
      finally { connection.release(); }
    },
    async create({ name, email, passwordHash }) {
      const [result] = await pool.execute('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, passwordHash]);
      return { id: result.insertId, name, email };
    },
  };
}
