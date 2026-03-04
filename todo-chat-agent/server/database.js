/**
 * SQLite Database Module (async)
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('./config');

class DatabaseManager {
  constructor() {
    this.db = null;
  }

  async init() {
    const dbDir = path.dirname(config.dbPath);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(config.dbPath, (err) => {
        if (err) return reject(err);
        console.log('Database connected:', config.dbPath);
        this.createTables().then(() => resolve(this)).catch(reject);
      });
    });
  }

  async createTables() {
    const run = (sql) => new Promise((resolve, reject) => {
      this.db.run(sql, (err) => err ? reject(err) : resolve());
    });

    await run(`CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY, text TEXT NOT NULL, completed INTEGER DEFAULT 0,
      priority INTEGER DEFAULT 1, tags TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME, completed_at DATETIME)`);

    await run(`CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed)`);

    await run(`CREATE TABLE IF NOT EXISTS user_patterns (
      id INTEGER PRIMARY KEY, session_id TEXT, pattern TEXT, action TEXT,
      parameters TEXT, confidence REAL, usage_count INTEGER DEFAULT 1, last_used DATETIME)`);

    await run(`CREATE TABLE IF NOT EXISTS correction_logs (
      id INTEGER PRIMARY KEY, session_id TEXT, user_input TEXT,
      parsed_action TEXT, correct_action TEXT, correct_parameters TEXT, created_at DATETIME)`);

    await run(`CREATE TABLE IF NOT EXISTS session_context (
      session_id TEXT PRIMARY KEY, last_discussed_ids TEXT, recent_topics TEXT,
      preferred_format TEXT, updated_at DATETIME)`);
  }

  get() {
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }

  async close() {
    if (this.db) {
      await new Promise((resolve) => this.db.close(resolve));
      this.db = null;
    }
  }
}

module.exports = new DatabaseManager();
