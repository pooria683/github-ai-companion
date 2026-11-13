import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
vi.mock('electron',()=>({dialog:{showOpenDialog:vi.fn()}}))
import { ProjectFiles } from '../../src/main/localdev/files'

let base:string, project:string, outside:string, files:ProjectFiles
beforeEach(async()=>{base=await mkdtemp(join(tmpdir(),'companion-files-'));project=join(base,'project');outside=join(base,'outside');await mkdir(project);await mkdir(outside);await writeFile(join(project,'readme.md'),'hello');await writeFile(join(outside,'secret.txt'),'private');files=new ProjectFiles(()=>null)})
afterEach(async()=>rm(base,{recursive:true,force:true}))

describe('scoped local project files',()=>{
 it('reads and atomically writes project files beneath the selected root',async()=>{expect(await files.read(project,'readme.md')).toBe('hello');await files.write(project,'src/new.ts','export const answer=42');expect(await readFile(join(project,'src/new.ts'),'utf8')).toBe('export const answer=42')})
 it('rejects traversal, protected metadata, and symlinks outside the project',async()=>{await expect(files.read(project,'../outside/secret.txt')).rejects.toThrow('outside the selected project');await expect(files.read(project,'.git/config')).rejects.toThrow('Protected');await symlink(join(outside,'secret.txt'),join(project,'leak.txt'));await expect(files.read(project,'leak.txt')).rejects.toThrow('Symlink target is outside');await expect(files.write(project,'leak.txt','overwrite')).rejects.toThrow('symlinks is not allowed');expect(await readFile(join(outside,'secret.txt'),'utf8')).toBe('private')})
 it('enforces the text file size bound',async()=>{await writeFile(join(project,'large.txt'),'x'.repeat(2*1024*1024+1));await expect(files.read(project,'large.txt')).rejects.toThrow('2 MiB limit')})
})
