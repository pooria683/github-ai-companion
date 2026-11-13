import { create } from 'zustand'
import { ActivityEntry, AgentTask, CompanionSettings, Conversation, DEFAULT_SETTINGS, ProviderConfig, RepoSummary } from '@shared/types'
interface State {
 settings: CompanionSettings; conversations: Conversation[]; providers: ProviderConfig[]; activity: ActivityEntry[]; tasks: AgentTask[]; repos: RepoSummary[]; github?:{connected:boolean;login?:string}; ollamaOnline:boolean; loading:boolean; error?:string;
 load:()=>Promise<void>;update:(patch:Partial<CompanionSettings>)=>Promise<void>;refreshConversations:()=>Promise<void>;refreshActivity:()=>Promise<void>;refreshProviders:()=>Promise<void>;refreshGithub:()=>Promise<void>;refreshTasks:()=>Promise<void>;setError:(e?:string)=>void
}
export const useAppStore=create<State>((set,get)=>({settings:DEFAULT_SETTINGS,conversations:[],providers:[],activity:[],tasks:[],repos:[],ollamaOnline:false,loading:true,
 load:async()=>{try{const [settings,conversations,providers,activity,github,tasks]=await Promise.all([window.companion.getSettings(),window.companion.getConversations(),window.companion.getProviders(),window.companion.getActivity(),window.companion.githubStatus(),window.companion.listAgentTasks()]);set({settings,conversations,providers,activity,github,tasks,loading:false});const p=providers.find(x=>x.id==='ollama');if(p)try{await window.companion.testProvider('ollama');set({ollamaOnline:true})}catch{set({ollamaOnline:false})}}catch(e){set({loading:false,error:e instanceof Error?e.message:'Failed to initialize'})}},
 update:async(patch)=>{try{const settings=await window.companion.updateSettings(patch);set({settings})}catch(e){set({error:e instanceof Error?e.message:'Could not save settings'})}},
 refreshConversations:async()=>set({conversations:await window.companion.getConversations()}),refreshActivity:async()=>set({activity:await window.companion.getActivity()}),refreshProviders:async()=>set({providers:await window.companion.getProviders()}),refreshGithub:async()=>set({github:await window.companion.githubStatus()}),refreshTasks:async()=>set({tasks:await window.companion.listAgentTasks()}),setError:(error)=>set({error})
}))
