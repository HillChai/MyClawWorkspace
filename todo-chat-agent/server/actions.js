const { v4: uuidv4 } = require('uuid');
const dbManager = require('./database');

const db = () => dbManager.get();

const query = (sql, params = []) => new Promise((resolve, reject) => {
  db().all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db().run(sql, params, function(err) { 
    err ? reject(err) : resolve({ id: this.lastID, changes: this.changes }); 
  });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  db().get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});

const formatRow = (row) => row ? {
  id: row.id, text: row.text, completed: Boolean(row.completed),
  priority: row.priority, tags: JSON.parse(row.tags || '[]'),
  createdAt: row.created_at, updatedAt: row.updated_at, completedAt: row.completed_at
} : null;

class TodoActions {
  async getAll(filters = {}) {
    let sql = 'SELECT * FROM todos WHERE 1=1';
    const params = [];
    if (filters.completed !== undefined) { 
      sql += ' AND completed = ?'; 
      params.push(filters.completed ? 1 : 0); 
    }
    if (filters.search) { 
      sql += ' AND text LIKE ?'; 
      params.push('%' + filters.search + '%'); 
    }
    sql += ' ORDER BY created_at DESC';
    const rows = await query(sql, params);
    return rows.map(formatRow);
  }

  async getById(id) {
    const row = await get('SELECT * FROM todos WHERE id = ?', [id]);
    return formatRow(row);
  }

  async create(data) {
    const id = uuidv4();
    const now = new Date().toISOString();
    await run(
      'INSERT INTO todos (id, text, completed, priority, tags, created_at, updated_at) VALUES (?, ?, 0, ?, ?, ?, ?)',
      [id, data.text, data.priority || 1, JSON.stringify(data.tags || []), now, now]
    );
    return this.getById(id);
  }

  async update(id, data) {
    const existing = await this.getById(id);
    if (!existing) return null;
    const now = new Date().toISOString();
    await run(
      'UPDATE todos SET text = ?, completed = ?, priority = ?, tags = ?, updated_at = ?, completed_at = ? WHERE id = ?',
      [
        data.text !== undefined ? data.text : existing.text,
        data.completed !== undefined ? (data.completed ? 1 : 0) : existing.completed,
        data.priority !== undefined ? data.priority : existing.priority,
        data.tags !== undefined ? JSON.stringify(data.tags) : JSON.stringify(existing.tags),
        now, 
        data.completed === true ? now : data.completed === false ? null : existing.completedAt, 
        id
      ]
    );
    return this.getById(id);
  }

  async delete(id) {
    const existing = await this.getById(id);
    if (!existing) return null;
    await run('DELETE FROM todos WHERE id = ?', [id]);
    return existing;
  }

  async toggle(id) {
    const todo = await this.getById(id);
    return todo ? this.update(id, { completed: !todo.completed }) : null;
  }
}

module.exports = new TodoActions();
