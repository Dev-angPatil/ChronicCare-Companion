/* ----------------------------------------------------
   SQLITE DATABASE SCHEMA & CONNECTION (server/db.js)
   ---------------------------------------------------- */

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'chronic_care.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err);
  } else {
    console.log('Connected to SQLite database at:', DB_PATH);
  }
});

// Enable Foreign Key constraints in SQLite
db.run('PRAGMA foreign_keys = ON;');

// Initialize tables
db.serialize(() => {
  // 1. Users Table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Profiles Table
  db.run(`
    CREATE TABLE IF NOT EXISTS profiles (
      user_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      conditions TEXT,
      physician_name TEXT,
      physician_phone TEXT,
      physician_clinic TEXT,
      glucose_min INTEGER DEFAULT 80,
      glucose_max INTEGER DEFAULT 130,
      bp_sys_max INTEGER DEFAULT 130,
      bp_dia_max INTEGER DEFAULT 80,
      bp_stage TEXT DEFAULT 'Normal',
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 3. Medications Table
  db.run(`
    CREATE TABLE IF NOT EXISTS medications (
      id TEXT,
      user_id INTEGER,
      name TEXT NOT NULL,
      dose TEXT NOT NULL,
      frequency TEXT,
      taken INTEGER DEFAULT 0,
      remaining_hours INTEGER DEFAULT 24,
      PRIMARY KEY (id, user_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 4. Daily Health Logs Table
  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      user_id INTEGER,
      date TEXT,
      glucose INTEGER,
      bp_systolic INTEGER,
      bp_diastolic INTEGER,
      meal TEXT,
      symptoms TEXT,
      PRIMARY KEY (user_id, date),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 5. Chat History Table
  db.run(`
    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      sender TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      category TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 6. Activity/Audit Logs Table
  db.run(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action_type TEXT NOT NULL,
      description TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
});

// Promise-based Query Helper Methods
export function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

export function getRow(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function getAllRows(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export default db;
