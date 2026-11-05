import { TaskError, validateTask } from './validation.js';

// DATE/TIME are selected as text, never passed through JavaScript Date/UTC conversion.
const columns = `id, user_id, title, description, DATE_FORMAT(task_date, '%Y-%m-%d') AS task_date,
  TIME_FORMAT(start_time, '%H:%i') AS start_time, TIME_FORMAT(end_time, '%H:%i') AS end_time,
  priority, status, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
  DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at`;
const fields = ['title', 'description', 'task_date', 'start_time', 'end_time', 'priority', 'status'];

export function createTaskRepository(pool) {
  async function get(connection, userId, id) {
    const [rows] = await connection.execute(`SELECT ${columns} FROM tasks WHERE user_id = ? AND id = ?`, [userId, id]);
    if (!rows[0]) throw new TaskError(404, 'Task not found.');
    return rows[0];
  }

  async function write(userId, action) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      // All task mutations for a user take this same lock, including date changes and deletes.
      // This is a locking read; it never updates the user record.
      const [users] = await connection.execute('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
      if (!users.length) throw new TaskError(401, 'Authentication required.');
      const result = await action(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      if (error.code === 'ER_DUP_ENTRY') throw new TaskError(409, 'Only one task may be in progress per day.');
      if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) throw new TaskError(503, 'Another change is being saved. Please retry.');
      throw error;
    } finally { connection.release(); }
  }

  async function checkConflicts(connection, userId, task, id = 0) {
    if (task.status === 'in_progress') {
      const [active] = await connection.execute("SELECT id FROM tasks WHERE user_id = ? AND task_date = ? AND status = 'in_progress' AND id <> ? FOR UPDATE", [userId, task.task_date, id]);
      if (active.length) throw new TaskError(409, 'Only one task may be in progress per day.');
    }
    if (task.start_time !== null) {
      const [overlap] = await connection.execute('SELECT id FROM tasks WHERE user_id = ? AND task_date = ? AND id <> ? AND start_time < ? AND end_time > ? FOR UPDATE', [userId, task.task_date, id, task.end_time, task.start_time]);
      if (overlap.length) throw new TaskError(409, 'This time overlaps another task on the same date.');
    }
  }

  return {
    async list(userId, filters) {
      const where = ['user_id = ?']; const values = [userId];
      for (const [key, column] of [['date', 'task_date'], ['status', 'status'], ['priority', 'priority']]) {
        if (filters[key] !== undefined) { where.push(`${column} = ?`); values.push(filters[key]); }
      }
      const [rows] = await pool.execute(`SELECT ${columns} FROM tasks WHERE ${where.join(' AND ')} ORDER BY task_date, start_time IS NULL, start_time, id`, values);
      return rows;
    },
    get: (userId, id) => get(pool, userId, id),
    create: (userId, body) => write(userId, async (connection) => {
      const task = validateTask(body);
      await checkConflicts(connection, userId, task);
      const [result] = await connection.execute(`INSERT INTO tasks (user_id, ${fields.join(', ')}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [userId, ...fields.map((key) => task[key])]);
      return get(connection, userId, result.insertId);
    }),
    update: (userId, id, body) => write(userId, async (connection) => {
      const existing = await get(connection, userId, id);
      const task = validateTask(body, existing);
      await checkConflicts(connection, userId, task, id);
      await connection.execute(`UPDATE tasks SET ${fields.map((key) => `${key} = ?`).join(', ')} WHERE user_id = ? AND id = ?`, [...fields.map((key) => task[key]), userId, id]);
      return get(connection, userId, id);
    }),
    remove: (userId, id) => write(userId, async (connection) => {
      const [result] = await connection.execute('DELETE FROM tasks WHERE user_id = ? AND id = ?', [userId, id]);
      if (!result.affectedRows) throw new TaskError(404, 'Task not found.');
    }),
  };
}
