import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const DB_PATH = process.env.DATABASE_PATH ?? './data/bot.db';

/**
 * 한국시간(KST, UTC+9) 기준 현재 시각을 'YYYY-MM-DD HH:mm:ss' 형태로 반환
 */
export function nowKST(): string {
  const now = new Date();
  // UTC 시간에 9시간을 더해서 KST로 변환
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  const mi = String(kst.getUTCMinutes()).padStart(2, '0');
  const ss = String(kst.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

// data 디렉토리 생성
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let db: SqlJsDatabase;

/**
 * DB 초기화 — 비동기로 sql.js WASM 로드 후 DB 인스턴스 생성
 */
export async function initDatabase(): Promise<SqlJsDatabase> {
  if (db) return db;

  const SQL = await initSqlJs();

  // 기존 DB 파일이 있으면 로드, 없으면 새로 생성
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // 테이블 초기화
  db.run(`
    CREATE TABLE IF NOT EXISTS scheduled_messages (
      id                     INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id             TEXT    NOT NULL,
      content                TEXT    NOT NULL,
      link                   TEXT    DEFAULT NULL,
      image_url              TEXT    DEFAULT NULL,
      click_url              TEXT    DEFAULT NULL,
      scheduled_at           TEXT    NOT NULL,
      timezone               TEXT    NOT NULL DEFAULT 'GMT+09:00',
      status                 TEXT    NOT NULL DEFAULT 'pending',
      author                 TEXT    NOT NULL DEFAULT 'admin',
      user_id                TEXT    DEFAULT NULL,
      interaction_message_id TEXT    DEFAULT NULL,
      created_at             TEXT    NOT NULL DEFAULT (datetime('now', '+9 hours')),
      sent_at                TEXT    DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id                TEXT PRIMARY KEY,
      timezone               TEXT NOT NULL DEFAULT 'GMT+09:00'
    );

    CREATE TABLE IF NOT EXISTS operators (
      id                     INTEGER PRIMARY KEY AUTOINCREMENT,
      login_id               TEXT    NOT NULL UNIQUE,
      password_hash          TEXT    NOT NULL,
      name                   TEXT    NOT NULL,
      email                  TEXT    NOT NULL,
      team                   TEXT    NOT NULL DEFAULT '',
      game                   TEXT    NOT NULL DEFAULT '',
      role                   TEXT    NOT NULL DEFAULT 'operator',
      status                 TEXT    NOT NULL DEFAULT 'pending',
      note                   TEXT    DEFAULT NULL,
      created_at             TEXT    NOT NULL DEFAULT (datetime('now', '+9 hours')),
      approved_at            TEXT    DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id                     INTEGER PRIMARY KEY AUTOINCREMENT,
      action_type            TEXT    NOT NULL,
      login_id               TEXT    NOT NULL,
      target_title           TEXT    DEFAULT NULL,
      target_channel         TEXT    DEFAULT NULL,
      detail                 TEXT    DEFAULT NULL,
      ip_address             TEXT    DEFAULT NULL,
      result                 TEXT    NOT NULL DEFAULT 'success',
      result_detail          TEXT    DEFAULT NULL,
      created_at             TEXT    NOT NULL DEFAULT (datetime('now', '+9 hours'))
    );
  `);

  // 초기 슈퍼관리자 계정 (없을 때만)
  const adminCheck = db.exec("SELECT COUNT(*) FROM operators WHERE login_id = 'admin'");
  const adminCount = adminCheck[0]?.values[0]?.[0] ?? 0;
  if (adminCount === 0) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin1234', 10);
    db.run(
      `INSERT INTO operators (login_id, password_hash, name, email, team, game, role, status, approved_at)
       VALUES ('admin', ?, '슈퍼관리자', 'admin@gv.com', 'System', 'ALL', 'super_admin', 'approved', datetime('now', '+9 hours'))`,
      [hash]
    );
  }

  saveDatabase();
  console.log('✅ DB 초기화 완료:', DB_PATH);

  return db;
}

/**
 * DB를 파일로 저장 (변경 후 호출)
 */
export function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

/**
 * DB 인스턴스 반환 (초기화 후 사용)
 */
export function getDb(): SqlJsDatabase {
  if (!db) throw new Error('DB가 아직 초기화되지 않았습니다. initDatabase()를 먼저 호출하세요.');
  return db;
}

// ─── 쿼리 헬퍼 함수들 ──────────────────

export function getUserTimezone(userId: string): string {
  const results = db.exec(`SELECT timezone FROM user_settings WHERE user_id = ?`, [userId]);
  const objects = resultToObjects(results);
  return objects.length > 0 ? objects[0].timezone : 'GMT+09:00';
}

export function setUserTimezone(userId: string, timezone: string) {
  db.run(
    `INSERT INTO user_settings (user_id, timezone) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET timezone = excluded.timezone`,
    [userId, timezone]
  );
  saveDatabase();
}

export function insertMessage(params: {
  channelId: string;
  content: string;
  link: string | null;
  imageUrl?: string | null;
  clickUrl?: string | null;
  scheduledAt: string;
  timezone: string;
  author: string;
  userId?: string | null;
  interactionMessageId?: string | null;
}): number {
  db.run(
    `INSERT INTO scheduled_messages (channel_id, content, link, image_url, click_url, scheduled_at, timezone, author, user_id, interaction_message_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.channelId,
      params.content,
      params.link ?? null,
      params.imageUrl ?? null,
      params.clickUrl ?? null,
      params.scheduledAt,
      params.timezone,
      params.author,
      params.userId ?? null,
      params.interactionMessageId ?? null,
      nowKST(),
    ]
  );
  const result = db.exec('SELECT last_insert_rowid() as id');
  const id = result[0].values[0][0] as number;
  saveDatabase();
  return id;
}

export function getPendingMessages(): any[] {
  const results = db.exec(`
    SELECT * FROM scheduled_messages
    WHERE status = 'pending'
      AND scheduled_at <= '${nowKST()}'
    ORDER BY scheduled_at ASC
  `);
  return resultToObjects(results);
}

export function markAsSent(id: number) {
  db.run(
    `UPDATE scheduled_messages SET status = 'sent', sent_at = ? WHERE id = ?`,
    [nowKST(), id]
  );
  saveDatabase();
}

export function markAsFailed(id: number) {
  db.run(`UPDATE scheduled_messages SET status = 'failed' WHERE id = ?`, [id]);
  saveDatabase();
}

export function cancelMessageById(id: number): number {
  db.run(`UPDATE scheduled_messages SET status = 'cancelled' WHERE id = ? AND status = 'pending'`, [id]);
  const changes = db.getRowsModified();
  saveDatabase();
  return changes;
}

export function cancelByInteractionMessageId(messageId: string): any[] {
  // 먼저 해당 메시지로 연결된 pending 예약 조회
  const results = db.exec(
    `SELECT * FROM scheduled_messages WHERE interaction_message_id = ? AND status = 'pending'`,
    [messageId]
  );
  const messages = resultToObjects(results);

  if (messages.length > 0) {
    db.run(
      `UPDATE scheduled_messages SET status = 'cancelled' WHERE interaction_message_id = ? AND status = 'pending'`,
      [messageId]
    );
    saveDatabase();
  }

  return messages;
}

export function getMessagesByUserId(userId: string): any[] {
  const results = db.exec(
    `SELECT * FROM scheduled_messages WHERE user_id = ? AND status = 'pending' ORDER BY scheduled_at ASC`,
    [userId]
  );
  return resultToObjects(results);
}

export function getAllMessages(params?: {
  status?: string;
  channel?: string;
  search?: string;
  page?: number;
  limit?: number;
}): { messages: any[]; total: number } {
  let whereClause = 'WHERE 1=1';
  const queryParams: any[] = [];

  if (params?.status && params.status !== 'all') {
    whereClause += ' AND status = ?';
    queryParams.push(params.status);
  }

  if (params?.channel && params.channel !== 'all') {
    whereClause += ' AND channel_id LIKE ?';
    queryParams.push(`%${params.channel}%`);
  }

  if (params?.search) {
    whereClause += ' AND content LIKE ?';
    queryParams.push(`%${params.search}%`);
  }

  const countResult = db.exec(`SELECT COUNT(*) as total FROM scheduled_messages ${whereClause}`, queryParams);
  const total = countResult.length > 0 ? countResult[0].values[0][0] as number : 0;

  const page = params?.page ?? 1;
  const limit = params?.limit ?? 15;
  const offset = (page - 1) * limit;

  const results = db.exec(
    `SELECT * FROM scheduled_messages ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...queryParams, limit, offset]
  );

  return { messages: resultToObjects(results), total };
}

export function getMessageById(id: number): any | null {
  const results = db.exec('SELECT * FROM scheduled_messages WHERE id = ?', [id]);
  const objects = resultToObjects(results);
  return objects.length > 0 ? objects[0] : null;
}

export function updateMessage(params: {
  id: number;
  channelId: string;
  content: string;
  link: string | null;
  scheduledAt: string;
  timezone: string;
}): number {
  db.run(
    `UPDATE scheduled_messages 
     SET channel_id = ?, content = ?, link = ?, scheduled_at = ?, timezone = ?
     WHERE id = ? AND status = 'pending'`,
    [params.channelId, params.content, params.link, params.scheduledAt, params.timezone, params.id]
  );
  const changes = db.getRowsModified();
  saveDatabase();
  return changes;
}

export function deleteMessageById(id: number): number {
  db.run(`DELETE FROM scheduled_messages WHERE id = ? AND status = 'pending'`, [id]);
  const changes = db.getRowsModified();
  saveDatabase();
  return changes;
}

export function getMessageStats(): any {
  const results = db.exec(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status = 'sent' AND strftime('%Y-%m', sent_at) = strftime('%Y-%m', 'now', 'localtime') THEN 1 ELSE 0 END) as sentThisMonth,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM scheduled_messages
  `);
  return resultToObjects(results)[0] || { total: 0, pending: 0, sent: 0, sentThisMonth: 0, cancelled: 0, failed: 0 };
}

// ─── 운영자(Operator) 관련 쿼리 헬퍼 ──────────────────

export function findOperatorByLoginId(loginId: string): any | null {
  const results = db.exec('SELECT * FROM operators WHERE login_id = ?', [loginId]);
  const objects = resultToObjects(results);
  return objects.length > 0 ? objects[0] : null;
}

export function getOperatorById(id: number): any | null {
  const results = db.exec('SELECT * FROM operators WHERE id = ?', [id]);
  const objects = resultToObjects(results);
  return objects.length > 0 ? objects[0] : null;
}

export function createOperator(params: {
  loginId: string;
  passwordHash: string;
  name: string;
  email: string;
  team: string;
  game: string;
  note?: string;
}): number {
  db.run(
    `INSERT INTO operators (login_id, password_hash, name, email, team, game, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [params.loginId, params.passwordHash, params.name, params.email, params.team, params.game, params.note ?? null, nowKST()]
  );
  const result = db.exec('SELECT last_insert_rowid() as id');
  const id = result[0].values[0][0] as number;
  saveDatabase();
  return id;
}

export function getAllOperators(): any[] {
  const results = db.exec('SELECT id, login_id, name, email, team, game, role, status, created_at, approved_at FROM operators ORDER BY created_at DESC');
  return resultToObjects(results);
}

export function updateOperatorStatus(id: number, status: string): number {
  const approvedAt = status === 'approved' ? `'${nowKST()}'` : 'NULL';
  db.run(
    `UPDATE operators SET status = ?, approved_at = ${approvedAt} WHERE id = ?`,
    [status, id]
  );
  const changes = db.getRowsModified();
  saveDatabase();
  return changes;
}

export function updateOperatorPassword(id: number, passwordHash: string): number {
  db.run('UPDATE operators SET password_hash = ? WHERE id = ?', [passwordHash, id]);
  const changes = db.getRowsModified();
  saveDatabase();
  return changes;
}

export function updateOperatorGame(id: number, game: string): number {

  db.run('UPDATE operators SET game = ? WHERE id = ?', [game, id]);
  const changes = db.getRowsModified();
  saveDatabase();
  return changes;
}

/**
 * sql.js exec 결과를 객체 배열로 변환
 */
function resultToObjects(results: any[]): any[] {
  if (!results || results.length === 0) return [];
  const { columns, values } = results[0];
  return values.map((row: any[]) => {
    const obj: any = {};
    columns.forEach((col: string, i: number) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

// ─── 활동 로그(Activity Log) 관련 쿼리 헬퍼 ──────────────────

export function insertActivityLog(params: {
  actionType: string;
  loginId: string;
  targetTitle?: string | null;
  targetChannel?: string | null;
  detail?: string | null;
  ipAddress?: string | null;
  result?: string;
  resultDetail?: string | null;
}): number {
  db.run(
    `INSERT INTO activity_logs (action_type, login_id, target_title, target_channel, detail, ip_address, result, result_detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.actionType,
      params.loginId,
      params.targetTitle ?? null,
      params.targetChannel ?? null,
      params.detail ?? null,
      params.ipAddress ?? null,
      params.result ?? 'success',
      params.resultDetail ?? null,
      nowKST(),
    ]
  );
  const result = db.exec('SELECT last_insert_rowid() as id');
  const id = result[0].values[0][0] as number;
  saveDatabase();
  return id;
}

export function getActivityLogs(params?: {
  actionType?: string;
  loginId?: string;
  targetTitle?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}): { logs: any[]; total: number } {
  let whereClause = 'WHERE 1=1';
  const queryParams: any[] = [];

  if (params?.actionType && params.actionType !== 'all') {
    whereClause += ' AND action_type = ?';
    queryParams.push(params.actionType);
  }

  if (params?.loginId) {
    whereClause += ' AND login_id LIKE ?';
    queryParams.push(`%${params.loginId}%`);
  }

  if (params?.targetTitle && params.targetTitle !== 'all') {
    whereClause += ' AND target_title = ?';
    queryParams.push(params.targetTitle);
  }

  if (params?.dateFrom) {
    whereClause += ' AND created_at >= ?';
    queryParams.push(params.dateFrom);
  }

  if (params?.dateTo) {
    whereClause += ' AND created_at <= ?';
    queryParams.push(params.dateTo + ' 23:59:59');
  }

  const countResult = db.exec(`SELECT COUNT(*) as total FROM activity_logs ${whereClause}`, queryParams);
  const total = countResult.length > 0 ? countResult[0].values[0][0] as number : 0;

  const page = params?.page ?? 1;
  const limit = params?.limit ?? 15;
  const offset = (page - 1) * limit;

  const results = db.exec(
    `SELECT * FROM activity_logs ${whereClause} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...queryParams, limit, offset]
  );

  return { logs: resultToObjects(results), total };
}

export function getActivityLogTitles(): string[] {
  const results = db.exec(`SELECT DISTINCT target_title FROM activity_logs WHERE target_title IS NOT NULL AND target_title != '' ORDER BY target_title`);
  if (!results || results.length === 0) return [];
  return results[0].values.map((row: any[]) => row[0] as string);
}
