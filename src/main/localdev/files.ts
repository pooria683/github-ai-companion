import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { dialog, BrowserWindow } from 'electron'

const SKIP = new Set(['node_modules','.git','.next','dist','build','coverage','vendor','.venv','venv','target','bin','obj'])
const MAX_FILE = 2 * 1024 * 1024
export class ProjectFiles {
  constructor(private getWindow: () => BrowserWindow | null) {}
  async chooseDirectory() { const result = await dialog.showOpenDialog(this.getWindow() ?? undefined as any, { properties: ['openDirectory'] }); return result.canceled ? null : result.filePaths[0] }
  async chooseFolder() { return this.chooseDirectory() }
  private async root(input: string) {
    const resolved = path.resolve(input); const home = path.resolve(os.homedir())
    if (resolved === path.parse(resolved).root || resolved === home) throw new Error('Select a project directory, not a filesystem root or home directory.')
    const canonical = await fs.realpath(resolved); const stat = await fs.stat(canonical); if (!stat.isDirectory()) throw new Error('The selected project path is not a directory.')
    return canonical
  }
  private child(root: string, relative: string) { const dest = path.resolve(root, relative); if (dest !== root && !dest.startsWith(root + path.sep)) throw new Error('Path is outside the selected project.'); if(relative.split(/[\\/]+/).some(part=>SKIP.has(part.toLowerCase()))) throw new Error('Protected project metadata and dependency paths cannot be edited.'); return dest }
  private async verifyTarget(root:string,target:string) { const canonical=await fs.realpath(target); if(canonical!==root&&!canonical.startsWith(root+path.sep)) throw new Error('Symlink target is outside the selected project.'); return canonical }
  async info(directory: string) {
    const root = await this.root(directory); let files = 0, size = 0; const languages = new Map<string,number>();
    const extMap: Record<string,string> = { '.ts':'TypeScript','.tsx':'TypeScript/React','.js':'JavaScript','.jsx':'JavaScript/React','.py':'Python','.cs':'C#','.java':'Java','.go':'Go','.rs':'Rust','.dart':'Dart','.php':'PHP','.html':'HTML','.css':'CSS','.sql':'SQL','.cpp':'C++','.h':'C/C++' }
    const scan = async (dir: string, depth: number): Promise<void> => { if(depth > 12) return; let entries; try { entries = await fs.readdir(dir,{withFileTypes:true}) } catch { return }; for(const entry of entries) { if(entry.name.startsWith('.') && entry.name !== '.github' || SKIP.has(entry.name.toLowerCase())) continue; const full = path.join(dir,entry.name); if(entry.isDirectory()) await scan(full,depth+1); else { files++; try { size += (await fs.stat(full)).size } catch {}; const ext=path.extname(entry.name).toLowerCase(); if(extMap[ext]) languages.set(extMap[ext],(languages.get(extMap[ext])??0)+1) } } }
    await scan(root,0); return { path: root, name: path.basename(root), files, size, languages: [...languages].sort((a,b)=>b[1]-a[1]).slice(0,8).map(x=>x[0]) }
  }
  async list(directory: string, relative = '') { const root=await this.root(directory), unresolved=this.child(root,relative), target=await this.verifyTarget(root,unresolved); const entries=await fs.readdir(target,{withFileTypes:true}); return Promise.all(entries.filter(e=>!SKIP.has(e.name.toLowerCase())).map(async e=>({name:e.name,path:path.relative(root,path.join(target,e.name)).replace(/\\/g,'/'),isDirectory:e.isDirectory(),size:e.isFile()?(await fs.stat(path.join(target,e.name))).size:0}))) }
  async read(directory:string,relative:string){const root=await this.root(directory),target=await this.verifyTarget(root,this.child(root,relative));const stat=await fs.stat(target);if(!stat.isFile()||stat.size>MAX_FILE)throw new Error('File is not a regular text file or exceeds the 2 MiB limit.');if(/\.(png|jpe?g|gif|ico|pdf|zip|exe|dll|woff2?)$/i.test(relative))throw new Error('Binary files cannot be opened in the code editor.');return fs.readFile(target,'utf8')}
  async write(directory:string,relative:string,content:string){const root=await this.root(directory),target=this.child(root,relative);if(!relative||Buffer.byteLength(content,'utf8')>MAX_FILE)throw new Error('Invalid file path or content exceeds the 2 MiB limit.');const parts=path.relative(root,target).split(path.sep);let cursor=root;for(const part of parts.slice(0,-1)){cursor=path.join(cursor,part);const stat=await fs.lstat(cursor).catch(()=>null);if(stat?.isSymbolicLink())throw new Error('Writing through project symlinks is not allowed.');if(stat&&!stat.isDirectory())throw new Error('A parent path is not a directory.');if(!stat)await fs.mkdir(cursor)}const finalStat=await fs.lstat(target).catch(()=>null);if(finalStat?.isSymbolicLink())throw new Error('Writing through project symlinks is not allowed.');if(finalStat&&!finalStat.isFile())throw new Error('Target path is not a regular file.');const temp=target+`.companion-${randomUUID()}.tmp`;try{await fs.writeFile(temp,content,{encoding:'utf8',flag:'wx',mode:0o600});await fs.rename(temp,target)}catch(error){await fs.unlink(temp).catch(()=>{});throw error}}
}
