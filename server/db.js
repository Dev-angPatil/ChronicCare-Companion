/* ----------------------------------------------------
   DUAL DATABASE DRIVER (server/db.js)
   ---------------------------------------------------- */

import sqlite3 from 'sqlite3';
import pg from 'pg';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isPostgres = !!process.env.DATABASE_URL;
let dbSqlite = null;
let pgPool = null;

if (isPostgres) {
  console.log('Database configuration: Cloud PostgreSQL (Supabase) detected.');
  pgPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for Supabase SSL
  });
} else {
  console.log('Database configuration: Local SQLite fallback active.');
  const DB_PATH = path.join(__dirname, 'chronic_care.db');
  dbSqlite = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Failed to connect to SQLite:', err);
    } else {
      console.log('Connected to SQLite at:', DB_PATH);
    }
  });

  // Enable SQLite Foreign Keys
  dbSqlite.run('PRAGMA foreign_keys = ON;');

  // Initialize SQLite tables
  dbSqlite.serialize(() => {
    dbSqlite.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'patient',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    dbSqlite.run(`
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

    dbSqlite.run(`
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

    dbSqlite.run(`
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

    dbSqlite.run(`
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

    dbSqlite.run(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action_type TEXT NOT NULL,
        description TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    dbSqlite.run(`
      CREATE TABLE IF NOT EXISTS physician_patient_links (
        physician_id INTEGER,
        patient_id INTEGER,
        status TEXT DEFAULT 'pending',
        PRIMARY KEY (physician_id, patient_id),
        FOREIGN KEY(physician_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(patient_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  });
}

// SQL Query Translators (transforms "?" to "$1, $2" for Postgres compatibility)
function translateSql(sql) {
  if (!isPostgres) return sql;
  let count = 1;
  let res = sql.replace(/\?/g, () => `$${count++}`);
  
  // Postgres requires "RETURNING id" to capture inserted auto-increments
  if (res.trim().toUpperCase().startsWith('INSERT') && !res.toUpperCase().includes('RETURNING')) {
    res += ' RETURNING id';
  }
  return res;
}

export function runQuery(sql, params = []) {
  const finalSql = translateSql(sql);
  
  if (isPostgres) {
    return pgPool.query(finalSql, params).then(res => {
      const insertedId = res.rows[0]?.id || null;
      return { id: insertedId, changes: res.rowCount };
    });
  } else {
    return new Promise((resolve, reject) => {
      dbSqlite.run(finalSql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }
}

export function getRow(sql, params = []) {
  const finalSql = translateSql(sql);

  if (isPostgres) {
    return pgPool.query(finalSql, params).then(res => res.rows[0] || null);
  } else {
    return new Promise((resolve, reject) => {
      dbSqlite.get(finalSql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
}

export function getAllRows(sql, params = []) {
  const finalSql = translateSql(sql);

  if (isPostgres) {
    return pgPool.query(finalSql, params).then(res => res.rows);
  } else {
    return new Promise((resolve, reject) => {
      dbSqlite.all(finalSql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}
