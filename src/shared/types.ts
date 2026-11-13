export type AssistantState = 'idle' | 'thinking' | 'coding' | 'working' | 'listening' | 'speaking' | 'success' | 'error' | 'notification' | 'sleeping' | 'loading'
export type ProviderId = 'openai' | 'gemini' | 'nvidia' | 'openrouter' | 'ollama' | 'custom'
export type PermissionMode = 'read-only' | 'assisted' | 'trusted'

export interface ProviderConfig {
  id: ProviderId
  label: string
  baseUrl: string
  model: string
  enabled: boolean
  hasKey: boolean
  temperature: number
  maxTokens: number
}
export interface ChatMessage { id: string; role: 'user' | 'assistant' | 'system'; content: string; createdAt: number; provider?: string; model?: string; status?: 'streaming' | 'done' | 'error'; }
export interface Conversation { id: string; title: string; createdAt: number; updatedAt: number; messages: ChatMessage[] }
export interface CompanionSettings {
  theme: 'dark' | 'light'; provider: ProviderId; model: string; permissionMode: PermissionMode
  characterVisible: boolean; characterSize: number; characterPosition: { x: number; y: number }
  launchAtStartup: boolean; startMinimized: boolean; notifications: boolean; autoSpeak: boolean; clickThrough: boolean
  ollamaUrl: string; projectDirectory: string; githubConnected: boolean
}
export interface RepoSummary { id: number; name: string; fullName: string; description: string | null; private: boolean; htmlUrl: string; updatedAt: string; language: string | null; stars: number; }
export interface ActivityEntry { id: string; kind: 'task' | 'github' | 'system' | 'agent'; title: string; detail: string; createdAt: number; status: 'success' | 'info' | 'warning' | 'error' }
export interface ChatRequest { conversationId: string; message: string; }
export interface ChatDelta { conversationId: string; messageId: string; delta: string; done?: boolean; error?: string }
export interface AgentTask { id: string; title: string; status: 'planning' | 'running' | 'approval' | 'completed' | 'failed' | 'cancelled'; steps: { id: string; title: string; status: 'pending' | 'running' | 'completed' | 'failed' }[]; createdAt: number; }

export const DEFAULT_SETTINGS: CompanionSettings = {
  theme: 'dark', provider: 'ollama', model: 'llama3.2', permissionMode: 'assisted',
  characterVisible: false, characterSize: 112, characterPosition: { x: 40, y: 50 },
  launchAtStartup: false, startMinimized: false, notifications: true, autoSpeak: false, clickThrough: false,
  ollamaUrl: 'http://127.0.0.1:11434', projectDirectory: '', githubConnected: false
}

export const PROVIDER_DEFAULTS: Record<ProviderId, { label: string; baseUrl: string; model: string }> = {
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  gemini: { label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.0-flash' },
  nvidia: { label: 'NVIDIA NIM', baseUrl: 'https://integrate.api.nvidia.com/v1', model: 'meta/llama-3.1-8b-instruct' },
  openrouter: { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  ollama: { label: 'Ollama (local)', baseUrl: 'http://127.0.0.1:11434', model: 'llama3.2' },
  custom: { label: 'Custom OpenAI-compatible', baseUrl: '', model: '' }
}

export interface CompanionApi {
  getSettings(): Promise<CompanionSettings>
  updateSettings(patch: Partial<CompanionSettings>): Promise<CompanionSettings>
  getConversations(): Promise<Conversation[]>
  createConversation(): Promise<Conversation>
  deleteConversation(id: string): Promise<void>
  sendChat(request: ChatRequest): Promise<{ messageId: string }>
  cancelChat(conversationId: string): Promise<void>
  onChatDelta(callback: (delta: ChatDelta) => void): () => void
  onAssistantState(callback: (state: AssistantState) => void): () => void
  getProviders(): Promise<ProviderConfig[]>
  updateProvider(config: Partial<ProviderConfig> & { id: ProviderId; apiKey?: string }): Promise<ProviderConfig[]>
  testProvider(id: ProviderId): Promise<{ ok: boolean; message: string; models: string[] }>
  getModels(id: ProviderId): Promise<string[]>
  githubConnect(): Promise<{ login: string; name?: string }>
  githubDisconnect(): Promise<void>
  githubStatus(): Promise<{ connected: boolean; login?: string }>
  listRepositories(): Promise<RepoSummary[]>
  githubCreateRepo(input: { name: string; description?: string; isPrivate: boolean }): Promise<RepoSummary>
  githubDeleteRepo(fullName: string): Promise<void>
  githubListIssues(fullName: string): Promise<unknown[]>
  githubListPullRequests(fullName: string): Promise<unknown[]>
  selectProjectDirectory(): Promise<string | null>
  selectFolder(): Promise<string | null>
  getProjectInfo(directory: string): Promise<{ path: string; name: string; files: number; size: number; languages: string[] }>
  readProjectFile(directory: string, relativePath: string): Promise<string>
  writeProjectFile(directory: string, relativePath: string, content: string): Promise<void>
  listDirectory(directory: string, relativePath?: string): Promise<{ name: string; path: string; isDirectory: boolean; size: number }[]>
  getActivity(): Promise<ActivityEntry[]>
  addActivity(entry: Omit<ActivityEntry, 'id' | 'createdAt'>): Promise<void>
  executeAgentTask(message: string): Promise<AgentTask>
  listAgentTasks(): Promise<AgentTask[]>
  confirmAction(id: string, approved: boolean): Promise<void>
  openExternal(url: string): Promise<void>
  setStartup(enabled: boolean): Promise<boolean>
  setCharacterVisible(visible: boolean): Promise<void>
  setClickThrough(enabled: boolean): Promise<void>
  minimizeToTray(): Promise<void>
  openMainWindow(): Promise<void>
  openChatWindow(): Promise<void>
}

declare global { interface Window { companion: CompanionApi } }
