import { CompanionStore } from '../persistence/store'
import { SecretStore } from '../security/secrets'
import { ProviderId, PROVIDER_DEFAULTS, ProviderConfig } from '@shared/types'

export interface ProviderMessage { role: 'system'|'user'|'assistant'; content: string }
export interface ChatOptions { messages: ProviderMessage[]; onDelta: (text: string) => void; signal: AbortSignal }
export interface AIProvider { id: ProviderId; chat(options: ChatOptions): Promise<void>; test(): Promise<{ ok: boolean; message: string; models: string[] }> }

export class OpenAICompatibleProvider implements AIProvider {
  constructor(public id: ProviderId, private config: ProviderConfig, private key: string) {}
  private url(path: string) { const base = this.config.baseUrl.replace(/\/$/, ''); return this.id === 'ollama' ? `${base}${path}` : `${base}${path}` }
  async test() {
    try {
      const headers: Record<string,string> = {}; if (this.key && this.id !== 'gemini') headers.Authorization = `Bearer ${this.key}`
      let url = this.url(this.id === 'ollama' ? '/api/tags' : this.id === 'gemini' ? '/models' : '/models')
      if (this.id === 'gemini') url += `?key=${encodeURIComponent(this.key)}`
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(8000) })
      if (!response.ok) return { ok: false, message: `Provider returned HTTP ${response.status}`, models: [] }
      const data: any = await response.json()
      const models = this.id === 'ollama' ? (data.models ?? []).map((m: any) => m.name) : this.id === 'gemini' ? (data.models??[]).filter((m:any)=>(m.supportedGenerationMethods??[]).includes('generateContent')).map((m:any)=>m.name.replace(/^models\//,'')) : (data.data ?? []).map((m: any) => m.id)
      return { ok: true, message: 'Connection successful', models: models.slice(0, 100) }
    } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'Connection failed', models: [] } }
  }
  async chat({ messages, onDelta, signal }: ChatOptions) {
    const gemini = this.id === 'gemini'
    const system = messages.find(m=>m.role==='system')?.content
    const body = this.id === 'ollama'
      ? { model: this.config.model, messages, stream: true, options: { temperature: this.config.temperature, num_predict: this.config.maxTokens } }
      : gemini ? { contents: messages.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})), ...(system?{systemInstruction:{parts:[{text:system}]}}:{}), generationConfig:{temperature:this.config.temperature,maxOutputTokens:this.config.maxTokens} }
      : { model: this.config.model, messages, stream: true, temperature: this.config.temperature, max_tokens: this.config.maxTokens }
    const url = gemini ? `${this.url(`/models/${encodeURIComponent(this.config.model)}:streamGenerateContent`)}?alt=sse&key=${encodeURIComponent(this.key)}` : this.url(this.id === 'ollama' ? '/api/chat' : '/chat/completions')
    const headers: Record<string,string> = { 'Content-Type': 'application/json' }; if (this.key && !gemini) headers.Authorization = `Bearer ${this.key}`
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal })
    if (!response.ok) {
      const text = (await response.text()).slice(0, 1200)
      throw new Error(`Provider error ${response.status}: ${text}`)
    }
    if (!response.body) throw new Error('Provider did not return a response stream')
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
    while (true) {
      const { value, done } = await reader.read(); if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n'); buffer = lines.pop() ?? ''
      for (const line of lines) {
        const clean = line.trim(); if (!clean || clean === 'data: [DONE]') continue
        let chunk: any
        try { chunk = JSON.parse(clean.startsWith('data:') ? clean.slice(5).trim() : clean) } catch { continue }
        const text = this.id === 'ollama' ? chunk.message?.content : this.id === 'gemini' ? chunk.candidates?.[0]?.content?.parts?.map((part:any)=>part.text??'').join('') : chunk.choices?.[0]?.delta?.content
        if (text) onDelta(text)
      }
    }
  }
}

export class ProviderRegistry {
  constructor(private store: CompanionStore, private secrets: SecretStore) {}
  provider(id: ProviderId): OpenAICompatibleProvider {
    const config = this.store.getProviders().find(p => p.id === id)
    if (!config) throw new Error(`Unknown provider: ${id}`)
    if (id !== 'ollama' && !this.secrets.get(`provider:${id}`)) throw new Error(`Add an API key for ${config.label} in AI Models settings.`)
    return new OpenAICompatibleProvider(id, config, this.secrets.get(`provider:${id}`) ?? '')
  }
  async test(id: ProviderId) { return this.provider(id).test() }
  async models(id: ProviderId) { const result = await this.provider(id).test(); if (!result.ok) throw new Error(result.message); return result.models }
  set(config: Partial<ProviderConfig> & { id: ProviderId; apiKey?: string }) {
    const { apiKey, ...safeConfig } = config
    if (apiKey !== undefined && config.id !== 'ollama') this.secrets.set(`provider:${config.id}`, apiKey)
    const hasKey = config.id === 'ollama' || Boolean(apiKey || this.secrets.get(`provider:${config.id}`))
    return this.store.updateProvider({ ...safeConfig, hasKey })
  }
}
