import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs'
import path from 'node:path'

/** Keys live encrypted with Electron's OS-backed safeStorage. Refuses plaintext fallback. */
export class SecretStore {
  private file = path.join(app.getPath('userData'), 'secrets.bin')
  private data: Record<string, string> = {}
  constructor() {
    mkdirSync(path.dirname(this.file), { recursive: true })
    if (!existsSync(this.file)) return
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure credential storage is unavailable; saved credentials were not loaded.')
    try { this.data = JSON.parse(safeStorage.decryptString(readFileSync(this.file))) }
    catch { throw new Error('Saved credentials could not be decrypted. No credentials were overwritten.') }
  }
  get(key: string): string | undefined { return this.data[key] }
  set(key: string, value: string): void {
    if (value) this.data[key] = value; else delete this.data[key]
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure credential storage is not available on this system; refusing to store secrets in plaintext.')
    const temp = this.file + '.tmp'
    writeFileSync(temp, safeStorage.encryptString(JSON.stringify(this.data)), { mode: 0o600 })
    renameSync(temp, this.file)
  }
}
