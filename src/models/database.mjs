import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { root } from '../config.mjs';
const dbPath=process.env.DB_PATH || resolve(root,'data/training.db');
mkdirSync(dirname(dbPath),{recursive:true});
const db=new DatabaseSync(dbPath);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('trainer','learner')));
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS courses(id INTEGER PRIMARY KEY,owner INTEGER REFERENCES users(id),title TEXT NOT NULL,category TEXT NOT NULL,description TEXT NOT NULL,minutes INTEGER NOT NULL,content TEXT NOT NULL,video TEXT NOT NULL,published INTEGER NOT NULL DEFAULT 0,pass INTEGER NOT NULL DEFAULT 80,questions TEXT NOT NULL DEFAULT '[]',revision INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS progress(user_id INTEGER REFERENCES users(id),course_id INTEGER REFERENCES courses(id),completed INTEGER NOT NULL DEFAULT 0,notes TEXT NOT NULL DEFAULT '',PRIMARY KEY(user_id,course_id));
CREATE TABLE IF NOT EXISTS attempts(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),course_id INTEGER REFERENCES courses(id),score INTEGER NOT NULL,passed INTEGER NOT NULL,answers TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,revision INTEGER NOT NULL);
`);
// Additive migration preserves IDs and history.
if (!db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'access_level')) {
  db.exec("BEGIN IMMEDIATE; ALTER TABLE users ADD COLUMN access_level TEXT; ALTER TABLE users ADD COLUMN permissions TEXT; UPDATE users SET access_level=role; UPDATE users SET access_level='admin' WHERE id=(SELECT MIN(id) FROM users WHERE role='trainer'); COMMIT;");
}

export { db };
