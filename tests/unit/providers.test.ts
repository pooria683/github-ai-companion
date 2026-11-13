import { afterEach, describe, expect, it, vi } from 'vitest'
import { OpenAICompatibleProvider } from '../../src/main/ai/providers'
import { ProviderConfig, ProviderId, PROVIDER_DEFAULTS } from '../../src/shared/types'

function config(id: ProviderId, overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return { id, ...PROVIDER_DEFAULTS[id], enabled: true, hasKey: true, temperature: .4, maxTokens: 1024, ...overrides }
}
const response = (body: string, status=200, contentType='text/event-stream') => new Response(body,{status,headers:{'Content-Type':contentType}})

afterEach(() => vi.unstubAllGlobals())

describe('streaming AI providers', () => {
  it('streams OpenAI-compatible deltas and sends the selected model', async () => {
    const fetchMock=vi.fn().mockResolvedValue(response('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\ndata: [DONE]\n\n'))
    vi.stubGlobal('fetch',fetchMock)
    const provider=new OpenAICompatibleProvider('openai',config('openai',{model:'gpt-test'}),'secret')
    const pieces:string[]=[]
    await provider.chat({messages:[{role:'user',content:'Hi'}],signal:new AbortController().signal,onDelta:t=>pieces.push(t)})
    expect(pieces.join('')).toBe('Hello world')
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer secret')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe('gpt-test')
  })

  it('uses Gemini native streaming request format without a bearer token', async () => {
    const fetchMock=vi.fn().mockResolvedValue(response('data: {"candidates":[{"content":{"parts":[{"text":"Gemini"}]}}]}\n\ndata: [DONE]\n\n'))
    vi.stubGlobal('fetch',fetchMock)
    const provider=new OpenAICompatibleProvider('gemini',config('gemini',{model:'gemini-test'}),'gemini-secret')
    const pieces:string[]=[]
    await provider.chat({messages:[{role:'system',content:'Be concise'},{role:'user',content:'Hi'}],signal:new AbortController().signal,onDelta:t=>pieces.push(t)})
    const [url,options]=fetchMock.mock.calls[0]
    expect(String(url)).toContain('/models/gemini-test:streamGenerateContent?alt=sse&key=gemini-secret')
    expect(options.headers.Authorization).toBeUndefined()
    expect(JSON.parse(options.body).systemInstruction.parts[0].text).toBe('Be concise')
    expect(pieces.join('')).toBe('Gemini')
  })

  it('reads Ollama newline-delimited JSON streams', async () => {
    const fetchMock=vi.fn().mockResolvedValue(response('{"message":{"content":"local "},"done":false}\n{"message":{"content":"reply"},"done":true}\n'))
    vi.stubGlobal('fetch',fetchMock)
    const provider=new OpenAICompatibleProvider('ollama',config('ollama',{baseUrl:'http://127.0.0.1:11434',model:'llama3'}),'')
    const pieces:string[]=[]
    await provider.chat({messages:[{role:'user',content:'Hi'}],signal:new AbortController().signal,onDelta:t=>pieces.push(t)})
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:11434/api/chat')
    expect(pieces.join('')).toBe('local reply')
  })

  it('surfaces provider HTTP errors with status and response details', async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('invalid key',{status:401})))
    const provider=new OpenAICompatibleProvider('openai',config('openai'),'secret')
    await expect(provider.chat({messages:[],signal:new AbortController().signal,onDelta:()=>{}})).rejects.toThrow('Provider error 401: invalid key')
  })
})
