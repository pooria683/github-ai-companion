import { Octokit } from '@octokit/rest'
import { app, shell, dialog, BrowserWindow } from 'electron'
import { SecretStore } from '../security/secrets'
import { RepoSummary } from '@shared/types'

export class GitHubService {
  private octokit?: Octokit
  private login?: string
  constructor(private secrets: SecretStore) { this.load() }
  private load() { const token = this.secrets.get('github:token'); if (token) { this.octokit = new Octokit({ auth: token }); this.login = this.secrets.get('github:login') } }
  status() { return { connected: Boolean(this.octokit), login: this.login } }
  private api() { if (!this.octokit) throw new Error('Connect your GitHub account first.'); return this.octokit }
  async connect(parent: BrowserWindow | null): Promise<{ login: string; name?: string }> {
    const clientId = process.env.GITHUB_CLIENT_ID
    if (!clientId) throw new Error('GitHub OAuth is not configured. Set GITHUB_CLIENT_ID, enable Device Flow in your GitHub OAuth App, and restart the app.')
    const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' }
    const deviceResponse = await fetch('https://github.com/login/device/code', { method: 'POST', headers, body: JSON.stringify({ client_id: clientId, scope: 'repo read:user user:email' }), signal: AbortSignal.timeout(15000) })
    const device: any = await deviceResponse.json()
    if (!deviceResponse.ok || !device.device_code) throw new Error(device.error_description ?? 'GitHub device authorization could not be started. Check the OAuth App client ID and confirm Device Flow is enabled.')
    await shell.openExternal(device.verification_uri)
    const instruction = await dialog.showMessageBox(parent ?? undefined as any, { type: 'info', title: 'Connect GitHub', message: `Enter this one-time code on GitHub:\n\n${device.user_code}`, detail: 'A browser window has opened to github.com/login/device. Approve the requested access, then choose Continue. This code expires shortly.', buttons: ['Continue', 'Cancel'], defaultId: 0, cancelId: 1, noLink: true })
    if (instruction.response !== 0) throw new Error('GitHub sign-in was cancelled.')
    const expiresAt = Date.now() + Math.min(Number(device.expires_in ?? 900), 900) * 1000
    let interval = Math.max(3, Number(device.interval ?? 5)) * 1000
    while (Date.now() < expiresAt) {
      await new Promise(resolve => setTimeout(resolve, interval))
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', { method: 'POST', headers, body: JSON.stringify({ client_id: clientId, device_code: device.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }), signal: AbortSignal.timeout(15000) })
      const result: any = await tokenResponse.json()
      if (result.access_token) {
        const client = new Octokit({ auth: result.access_token }); const { data: profile } = await client.users.getAuthenticated()
        this.secrets.set('github:token', result.access_token); this.secrets.set('github:login', profile.login); this.octokit = client; this.login = profile.login
        return { login: profile.login, name: profile.name ?? undefined }
      }
      if (result.error === 'authorization_pending') continue
      if (result.error === 'slow_down') { interval += 5000; continue }
      if (result.error === 'access_denied') throw new Error('GitHub authorization was denied.')
      if (result.error === 'expired_token') throw new Error('GitHub device code expired. Start the sign-in process again.')
      if (result.error) throw new Error(result.error_description ?? `GitHub authorization error: ${result.error}`)
    }
    throw new Error('GitHub device code expired. Start the sign-in process again.')
  }
  disconnect() { this.secrets.set('github:token', ''); this.secrets.set('github:login', ''); this.octokit = undefined; this.login = undefined }
  private repo(r: any): RepoSummary { return { id: r.id, name: r.name, fullName: r.full_name, description: r.description, private: r.private, htmlUrl: r.html_url, updatedAt: r.updated_at ?? r.pushed_at, language: r.language, stars: r.stargazers_count } }
  async listRepositories() { const { data } = await this.api().repos.listForAuthenticatedUser({ sort: 'updated', per_page: 100, affiliation: 'owner,collaborator,organization_member' }); return data.map(r => this.repo(r)) }
  async createRepo(input: { name: string; description?: string; isPrivate: boolean }) { const { data } = await this.api().repos.createForAuthenticatedUser({ name: input.name, description: input.description, private: input.isPrivate, auto_init: true }); return this.repo(data) }
  async deleteRepo(fullName: string) { if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName)) throw new Error('Repository must be specified as owner/name.'); const [owner, repo] = fullName.split('/'); await this.api().repos.delete({ owner, repo }) }
  async listIssues(fullName: string) { const [owner, repo] = fullName.split('/'); const { data } = await this.api().issues.listForRepo({ owner, repo, state: 'open', per_page: 50 }); return data.filter(i => !i.pull_request).map(i => ({ number: i.number, title: i.title, state: i.state, url: i.html_url, user: i.user?.login, labels: i.labels.map(l => typeof l === 'string' ? l : l.name) })) }
  async listPullRequests(fullName: string) { const [owner, repo] = fullName.split('/'); const { data } = await this.api().pulls.list({ owner, repo, state: 'open', per_page: 50 }); return data.map(pr => ({ number: pr.number, title: pr.title, state: pr.state, url: pr.html_url, user: pr.user?.login, head: pr.head.ref, base: pr.base.ref, draft: pr.draft })) }
}
