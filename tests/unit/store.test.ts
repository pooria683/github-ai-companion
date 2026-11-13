import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const testPaths = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({ app: { getPath: () => testPaths.userData, getAppPath: () => process.cwd() } }))
import { CompanionStore } from '../../src/main/persistence/store'

let directory: string
beforeEach(() => { directory = mkdtempSync(join(tmpdir(),'companion-store-')); testPaths.userData = directory })
afterEach(() => rmSync(directory,{recursive:true,force:true}))

describe('SQLite companion persistence', () => {
  it('persists settings, conversations, activity and agent tasks in a SQLite database', async () => {
    let store = await CompanionStore.open()
    store.updateSettings({ model:'test-model', characterPosition:{x:444,y:222} })
    const conversation = store.createConversation(); conversation.title='Persisted conversation'; store.saveConversation(conversation)
    store.addActivity({kind:'system',title:'Database test',detail:'saved',status:'success'})
    const task={id:'task-test',title:'Test plan',status:'completed' as const,steps:[{id:'step',title:'Plan persisted',status:'completed' as const}],createdAt:1234}
    store.saveTask(task); store.close()
    store = await CompanionStore.open()
    expect(store.getSettings()).toMatchObject({model:'test-model',characterPosition:{x:444,y:222}})
    expect(store.getConversations()[0].title).toBe('Persisted conversation')
    expect(store.getActivity()[0].title).toBe('Database test')
    expect(store.getTasks()[0]).toMatchObject({id:'task-test',status:'completed'})
    store.close()
  })
})
