import { useEffect, useMemo, useState } from 'react'
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { Activity, Bot, Boxes, Check, ChevronDown, CircleHelp, Code2, Command, GitBranch, GitPullRequest, Github, LayoutDashboard, MessageSquare, PanelLeftClose, PanelLeftOpen, Plus, Radio, Search, Send, Settings, ShieldCheck, Sparkles, TerminalSquare, TriangleAlert, Workflow, X } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Chat from './pages/Chat'
import GitHub from './pages/GitHub'
import Projects from './pages/Projects'
import Models from './pages/Models'
import Tasks from './pages/Tasks'
import SettingsPage from './pages/Settings'
import Character from './pages/Character'
import { useAppStore } from './stores/app'
import { CompanionSettings } from '@shared/types'

const links=[{to:'/',label:'Dashboard',icon:LayoutDashboard},{to:'/chat',label:'AI Chat',icon:MessageSquare},{to:'/github',label:'GitHub',icon:Github},{to:'/projects',label:'Local projects',icon:Code2},{to:'/models',label:'AI models',icon:Boxes},{to:'/tasks',label:'Agent tasks',icon:Workflow},{to:'/settings',label:'Settings',icon:Settings}]
export default function App(){
 const character=location.hash.includes('/character');const {settings,load,update,error,setError}=useAppStore();const [collapsed,setCollapsed]=useState(false);const [quick,setQuick]=useState(false);const nav=useNavigate()
 useEffect(()=>{void load();const onKey=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setQuick(v=>!v)}if(e.key==='Escape'){setQuick(false)}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[])
 useEffect(()=>{document.documentElement.dataset.theme=settings?.theme??'dark'},[settings?.theme])
 if(character)return <Character/>
 return <div className="app-shell">
  <aside className={`sidebar ${collapsed?'collapsed':''}`}>
   <div className="brand"><div className="brand-mark"><Sparkles size={17}/></div>{!collapsed&&<><div className="brand-name">Companion<span>AI developer</span></div><button className="icon-btn sidebar-collapse" title="Collapse sidebar" onClick={()=>setCollapsed(true)}><PanelLeftClose size={16}/></button></>}</div>
   {collapsed&&<button className="icon-btn restore" onClick={()=>setCollapsed(false)} title="Expand sidebar"><PanelLeftOpen size={17}/></button>}
   <button className="workspace-switch" onClick={()=>setQuick(true)}><div className="workspace-icon"><Github size={15}/></div>{!collapsed&&<><div className="workspace-info"><b>Personal workspace</b><span>Free plan</span></div><ChevronDown size={15}/></>}</button>
   {!collapsed&&<div className="nav-label">WORKSPACE</div>}
   <nav className="nav-list">{links.map(({to,label,icon:Icon})=><NavLink title={collapsed?label:undefined} to={to} end={to==='/'} key={to} className={({isActive})=>`nav-link ${isActive?'active':''}`}><Icon size={17}/>{!collapsed&&<span>{label}</span>}{!collapsed&&to==='/tasks'&&<span className="nav-count">{useAppStore.getState().tasks.filter(t=>t.status==='running').length||'0'}</span>}</NavLink>)}</nav>
   {!collapsed&&<><div className="nav-label nav-label-spaced">CONNECTED SERVICES</div><button className="service-row" onClick={()=>nav('/github')}><span className={`status-dot ${useAppStore.getState().github?.connected?'online':''}`}/><Github size={16}/><span>GitHub</span><span className="service-status">{useAppStore.getState().github?.connected?'Connected':'Not connected'}</span></button><button className="service-row" onClick={()=>nav('/models')}><span className={`status-dot ${useAppStore.getState().ollamaOnline?'online':''}`}/><div className="ollama-glyph">O</div><span>Ollama</span><span className="service-status">{useAppStore.getState().ollamaOnline?'Online':'Offline'}</span></button></>}
   <div className="sidebar-bottom"><div className="credit-card"><div className="credit-icon"><Sparkles size={15}/></div>{!collapsed&&<div><b>Your AI workspace</b><p>Bring your own model API key</p><button onClick={()=>nav('/models')}>Configure models <span>↗</span></button></div>}</div><button className="profile-row" onClick={()=>nav('/settings')}><div className="avatar">{useAppStore.getState().github?.login?.[0]?.toUpperCase()||'A'}</div>{!collapsed&&<><div className="profile-copy"><b>{useAppStore.getState().github?.login||'Local workspace'}</b><span>Settings & account</span></div><Settings size={15}/></>}</button></div>
  </aside>
  <main className="main-area"><header className="topbar"><div className="breadcrumbs"><span>Companion</span><span className="crumb-slash">/</span><b>{links.find(l=>l.to===location.hash.slice(1))?.label??links.find(l=>l.to===window.location.hash.slice(1))?.label??'Workspace'}</b></div><div className="top-actions"><button className="search-trigger" onClick={()=>setQuick(true)}><Search size={15}/><span>Search anything...</span><kbd>⌘ K</kbd></button><span className="top-separator"/><span className="secure-chip"><ShieldCheck size={14}/> Local & secure</span><button className="help-btn" title="Help"><CircleHelp size={17}/></button></div></header><div className="page-wrap"><Routes><Route path="/" element={<Dashboard/>}/><Route path="/chat" element={<Chat/>}/><Route path="/github" element={<GitHub/>}/><Route path="/projects" element={<Projects/>}/><Route path="/models" element={<Models/>}/><Route path="/tasks" element={<Tasks/>}/><Route path="/settings" element={<SettingsPage/>}/><Route path="*" element={<Dashboard/>}/></Routes></div>
   <footer className="statusbar"><div><span className="status-dot online"/> All systems operational</div><div className="status-right"><span><Command size={12}/> Ctrl+Shift+G quick chat</span><span className="status-divider"/>{settings?.permissionMode==='read-only'?'Read-only mode':settings?.permissionMode==='trusted'?'Trusted mode':'Assisted mode'}</div></footer>
  </main>
  {error&&<div className="global-toast" role="alert"><TriangleAlert size={15}/><span>{error}</span><button onClick={()=>setError(undefined)}><X size={14}/></button></div>}
  {quick&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setQuick(false)}}><div className="quick-modal"><div className="quick-search"><Search size={18}/><input autoFocus placeholder="Type a command, search..." onKeyDown={e=>{if(e.key==='Escape')setQuick(false);if(e.key==='Enter'){nav('/chat');setQuick(false)}}}/><kbd>ESC</kbd></div><div className="quick-section">QUICK NAVIGATION</div>{links.map(({to,label,icon:Icon})=><button className="quick-item" key={to} onClick={()=>{nav(to);setQuick(false)}}><Icon size={16}/><span>{label}</span><span className="quick-enter">↵</span></button>)}<div className="quick-footer"><Sparkles size={14}/> Ask the agent to help with a development task</div></div></div>}
 </div>
}
