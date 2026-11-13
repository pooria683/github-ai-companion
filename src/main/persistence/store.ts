import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import initSqlJs, { Database, SqlJsStatic } from 'sql.js'
import { ActivityEntry, AgentTask, CompanionSettings, Conversation, DEFAULT_SETTINGS, ProviderConfig, PROVIDER_DEFAULTS, ProviderId } from '@shared/types'

const ids: ProviderId[] = ['openai','gemini','nvidia','openrouter','ollama','custom']
const initialProviders: ProviderConfig[] = ids.map(id => ({ id, ...PROVIDER_DEFAULTS[id], enabled: id === 'ollama', hasKey: false, temperature: .4, maxTokens: 2048 }))

/** Persistent SQLite storage. sql.js keeps the database in memory and atomically flushes its SQLite image on writes. */
export class CompanionStore {
  private constructor(private db: Database, private file: string) {}
  static async open(): Promise<CompanionStore> {
    const folder = app.getPath('userData'); fs.mkdirSync(folder, { recursive: true })
    const file = path.join(folder, 'companion.sqlite')
    const SQL: SqlJsStatic = await initSqlJs({ locateFile: name => path.join(app.getAppPath(), 'node_modules', 'sql.js', 'dist', name) })
    const db = fs.existsSync(file) ? new SQL.Database(new Uint8Array(fs.readFileSync(file))) : new SQL.Database()
    db.run('PRAGMA foreign_keys = ON')
    db.run('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    db.run('CREATE TABLE IF NOT EXISTS providers (id TEXT PRIMARY KEY, payload TEXT NOT NULL)')
    db.run('CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, updated_at INTEGER NOT NULL, payload TEXT NOT NULL)')
    db.run('CREATE INDEX IF NOT EXISTS conversations_updated_idx ON conversations(updated_at DESC)')
    db.run('CREATE TABLE IF NOT EXISTS activity (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, payload TEXT NOT NULL)')
    db.run('CREATE INDEX IF NOT EXISTS activity_created_idx ON activity(created_at DESC)')
    db.run('CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, payload TEXT NOT NULL)')
    const store = new CompanionStore(db, file)
    if (!store.getSettingRaw()) store.updateSettings({ ...DEFAULT_SETTINGS, characterPosition: { ...DEFAULT_SETTINGS.characterPosition } })
    if (!store.getProviders().length) { for (const provider of initialProviders) store.write('INSERT OR REPLACE INTO providers(id,payload) VALUES(?,?)',[provider.id,JSON.stringify(provider)]); store.save() }
    if (!fs.existsSync(file)) store.save()
    return store
  }
  close() { this.db.close() }
  private write(sql: string, values: any[] = []) { this.db.run(sql, values) }
  private rows<T>(sql: string, values: any[] = []): T[] {
    const statement = this.db.prepare(sql); try { statement.bind(values); const result: T[] = []; while(statement.step()) result.push(statement.getAsObject() as T); return result } finally { statement.free() }
  }
  private save() {
    const tmp = this.file + '.tmp'; const bytes = this.db.export()
    const fd = fs.openSync(tmp, 'w', 0o600); try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
    fs.renameSync(tmp, this.file)
  }
  private getSettingRaw() { return this.rows<{value:string}>('SELECT value FROM settings WHERE key=?',['companion']).at(0)?.value }
  getSettings(): CompanionSettings { const raw = this.getSettingRaw(); return raw ? JSON.parse(raw) : { ...DEFAULT_SETTINGS, characterPosition: { ...DEFAULT_SETTINGS.characterPosition } } }
  updateSettings(patch: Partial<CompanionSettings>): CompanionSettings {
    const current=this.getSettings(); const next={...current,...patch,characterPosition:patch.characterPosition??current.characterPosition}
    this.write('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)',['companion',JSON.stringify(next)]);this.save();return structuredClone(next)
  }
  getConversations(): Conversation[] { return this.rows<{payload:string}>('SELECT payload FROM conversations ORDER BY updated_at DESC').map(r=>JSON.parse(r.payload)) }
  getConversation(id:string): Conversation|undefined { const row=this.rows<{payload:string}>('SELECT payload FROM conversations WHERE id=?',[id])[0];return row?JSON.parse(row.payload):undefined }
  createConversation(): Conversation {const now=Date.now();const c:Conversation={id:randomUUID(),title:'New conversation',createdAt:now,updatedAt:now,messages:[]};this.saveConversation(c);return structuredClone(c)}
  deleteConversation(id:string) {this.write('DELETE FROM conversations WHERE id=?',[id]);this.save()}
  saveConversation(c:Conversation) {this.write('INSERT OR REPLACE INTO conversations(id,updated_at,payload) VALUES(?,?,?)',[c.id,c.updatedAt,JSON.stringify(c)]);this.save()}
  getProviders(): ProviderConfig[] {return this.rows<{payload:string}>('SELECT payload FROM providers').map(r=>JSON.parse(r.payload))}
  updateProvider(config:Partial<ProviderConfig>&{id:ProviderId}) {const old=this.getProviders().find(p=>p.id===config.id);if(!old)throw new Error(`Unknown provider: ${config.id}`);const updated={...old,...config};delete (updated as any).apiKey;this.write('INSERT OR REPLACE INTO providers(id,payload) VALUES(?,?)',[updated.id,JSON.stringify(updated)]);this.save();return this.getProviders()}
  addActivity(entry:Omit<ActivityEntry,'id'|'createdAt'>) {const item:ActivityEntry={...entry,id:randomUUID(),createdAt:Date.now()};this.write('INSERT INTO activity(id,created_at,payload) VALUES(?,?,?)',[item.id,item.createdAt,JSON.stringify(item)]);this.write('DELETE FROM activity WHERE id NOT IN (SELECT id FROM activity ORDER BY created_at DESC LIMIT 300)');this.save()}
  getActivity():ActivityEntry[] {return this.rows<{payload:string}>('SELECT payload FROM activity ORDER BY created_at DESC LIMIT 300').map(r=>JSON.parse(r.payload))}
  getTasks():AgentTask[] {return this.rows<{payload:string}>('SELECT payload FROM tasks ORDER BY created_at DESC').map(r=>JSON.parse(r.payload))}
  saveTask(task:AgentTask) {this.write('INSERT OR REPLACE INTO tasks(id,created_at,payload) VALUES(?,?,?)',[task.id,task.createdAt,JSON.stringify(task)]);this.save()}
}
