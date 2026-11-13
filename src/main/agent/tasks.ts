import { randomUUID } from 'node:crypto'
import { AgentTask } from '@shared/types'
import { CompanionStore } from '../persistence/store'
import { ProviderRegistry } from '../ai/providers'

export class AgentTasks {
  private tasks = new Map<string, AgentTask>()
  private approvals = new Map<string, (approved: boolean) => void>()
  constructor(private store: CompanionStore, private providers: ProviderRegistry, private getModel: () => { provider: any; model: string }) { for (const task of store.getTasks()) this.tasks.set(task.id,task) }
  list() { return [...this.tasks.values()].map(t=>structuredClone(t)) }
  async execute(message: string): Promise<AgentTask> {
    const task: AgentTask={id:randomUUID(),title:message.slice(0,90),status:'planning',steps:[{id:'plan',title:'Analyze request and prepare a safe execution plan',status:'running'},{id:'respond',title:'Respond with a verified plan',status:'pending'}],createdAt:Date.now()};this.tasks.set(task.id,task);this.store.saveTask(task)
    const {provider,model}=this.getModel()
    try {
      const p=this.providers.provider(provider);let plan='';
      await p.chat({messages:[{role:'system',content:'You are the planning component of GitHub AI Companion. Break down the user request into a concise ordered plan, identify required permissions and risky/destructive actions, and state any missing inputs. Do not claim to execute anything. Return plain text.'},{role:'user',content:message}],signal:AbortSignal.timeout(60000),onDelta:(x)=>{plan+=x}})
      task.steps[0].status='completed';task.steps[1].status='completed';task.status='completed';task.steps.push({id:'plan-result',title:plan||'No plan returned',status:'completed'});this.store.addActivity({kind:'agent',title:'Task plan prepared',detail:task.title,status:'success'})
    } catch(e) {task.steps[0].status='failed';task.status='failed';task.steps.push({id:'error',title:e instanceof Error?e.message:'Planning failed',status:'failed'});this.store.addActivity({kind:'agent',title:'Task planning failed',detail:e instanceof Error?e.message:'Unknown error',status:'error'})}
    this.store.saveTask(task)
    return structuredClone(task)
  }
  confirm(id:string,approved:boolean){this.approvals.get(id)?.(approved);this.approvals.delete(id)}
}
