import { contextBridge, ipcRenderer } from 'electron'
import { CompanionApi, ChatDelta } from '@shared/types'

const api: CompanionApi = {
 getSettings:()=>ipcRenderer.invoke('settings:get'), updateSettings:(p)=>ipcRenderer.invoke('settings:update',p),
 getConversations:()=>ipcRenderer.invoke('conversations:list'), createConversation:()=>ipcRenderer.invoke('conversations:create'), deleteConversation:(id)=>ipcRenderer.invoke('conversations:delete',id),
 sendChat:(r)=>ipcRenderer.invoke('chat:send',r), cancelChat:(id)=>ipcRenderer.invoke('chat:cancel',id),
 onChatDelta:(cb)=>{const listener=(_:Electron.IpcRendererEvent,data:ChatDelta)=>cb(data);ipcRenderer.on('chat:delta',listener);return()=>ipcRenderer.removeListener('chat:delta',listener)},
 onAssistantState:(cb)=>{const listener=(_:Electron.IpcRendererEvent,state:import('@shared/types').AssistantState)=>cb(state);ipcRenderer.on('character:state',listener);return()=>ipcRenderer.removeListener('character:state',listener)}, 
 getProviders:()=>ipcRenderer.invoke('providers:list'), updateProvider:(c)=>ipcRenderer.invoke('providers:update',c), testProvider:(id)=>ipcRenderer.invoke('providers:test',id), getModels:(id)=>ipcRenderer.invoke('providers:models',id),
 githubConnect:()=>ipcRenderer.invoke('github:connect'), githubDisconnect:()=>ipcRenderer.invoke('github:disconnect'), githubStatus:()=>ipcRenderer.invoke('github:status'), listRepositories:()=>ipcRenderer.invoke('github:repos'), githubCreateRepo:(input)=>ipcRenderer.invoke('github:createRepo',input), githubDeleteRepo:(name)=>ipcRenderer.invoke('github:deleteRepo',name), githubListIssues:(name)=>ipcRenderer.invoke('github:issues',name), githubListPullRequests:(name)=>ipcRenderer.invoke('github:prs',name),
 selectProjectDirectory:()=>ipcRenderer.invoke('project:choose'), selectFolder:()=>ipcRenderer.invoke('project:chooseFolder'), getProjectInfo:(dir)=>ipcRenderer.invoke('project:info',dir), readProjectFile:(dir,rel)=>ipcRenderer.invoke('project:read',dir,rel), writeProjectFile:(dir,rel,content)=>ipcRenderer.invoke('project:write',dir,rel,content), listDirectory:(dir,rel)=>ipcRenderer.invoke('project:list',dir,rel),
 getActivity:()=>ipcRenderer.invoke('activity:list'), addActivity:(entry)=>ipcRenderer.invoke('activity:add',entry), executeAgentTask:(message)=>ipcRenderer.invoke('agent:execute',message), listAgentTasks:()=>ipcRenderer.invoke('agent:list'), confirmAction:(id,yes)=>ipcRenderer.invoke('agent:confirm',id,yes),
 openExternal:(url)=>ipcRenderer.invoke('external:open',url), setStartup:(enabled)=>ipcRenderer.invoke('system:startup',enabled), setCharacterVisible:(visible)=>ipcRenderer.invoke('character:visible',visible), setClickThrough:(enabled)=>ipcRenderer.invoke('character:clickthrough',enabled), minimizeToTray:()=>ipcRenderer.invoke('window:minimize'), openMainWindow:()=>ipcRenderer.invoke('window:open'), openChatWindow:()=>ipcRenderer.invoke('window:openChat')
}
contextBridge.exposeInMainWorld('companion',api)
