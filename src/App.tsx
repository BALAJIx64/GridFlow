import React, { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Bell, Building2, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, CircleDollarSign, CircleHelp, ClipboardList, Clock3, CreditCard, Database, Download, Eye, EyeOff, FileBarChart, FileText, Filter, Gauge, Home, Layers3, LayoutDashboard, Leaf, Lightbulb, LockKeyhole, LogOut, MapPin, Menu, MoreHorizontal, Plus, RadioTower, RefreshCw, Search, Settings, Shield, SlidersHorizontal, Sparkles, Trash2, UserRound, Users, Wallet, Wifi, Wrench, X, Zap, type LucideIcon } from 'lucide-react'
import { type Bill, type Consumer, type Meter, type ServiceRecord, type Technician } from './data'
import { api, consumerSignIn, currentAdmin, currentConsumer, demoMode, signIn, signOutAll, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASS, supabase, type Analytics, type Tariff, type Zone } from './services'
import { DataTable, PageToolbar, Pill, SearchControl, SectionHeading, SelectControl, StatusPill } from './components/ui'
import { SqlToasts } from './components/SqlToasts'
import { DatabaseConsole } from './pages/DatabaseConsole'
import { DatabaseExplorer } from './pages/DatabaseExplorer'
import { UserSettings, ZoneSettings } from './pages/SettingsExtra'
import { isAdmin, isSuperAdmin, PERMISSION_MESSAGE, roleLabel, type Profile } from './lib/roles'
import { opLog, useShowOps } from './lib/opLogger'

type Page='Dashboard'|'Consumers'|'Meters'|'Bills'|'Technicians'|'Reports'|'Settings'|'Database Console'|'Database Explorer'
type Notice={id:number;text:string;kind?:'success'|'error'}
type Modal={type:'consumer'|'technician'|'bill'|'meter'|'reading'|'service'|'delete'|'details';id?:string}
const pageIcons:Record<Page,LucideIcon>={Dashboard:LayoutDashboard,Consumers:Users,Meters:Gauge,Bills:FileText,Technicians:Wrench,Reports:FileBarChart,Settings,'Database Console':Database,'Database Explorer':Layers3}
const consumptionData:{month:string;usage:number;last:number}[]=[]
const collectionData:{month:string;paid:number;pending:number}[]=[]
const activities:{icon:string;title:string;detail:string;time:string;tone:string}[]=[]
const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(n)

const ADMIN_PAGES:Page[]=['Database Console','Database Explorer']
const ALL_PAGES:Page[]=['Dashboard','Consumers','Meters','Bills','Technicians','Reports','Settings','Database Console','Database Explorer']
const pageSlug=(p:Page)=>p.toLowerCase().replace(/\s+/g,'-')
const pageFromHash=():Page|null=>ALL_PAGES.find(p=>window.location.hash===`#/${pageSlug(p)}`)||null

function Brand({light=false}:{light?:boolean}){return <div className={`brand ${light?'brand-light':''}`}><span className="brand-symbol"><i/><i/><i/><i/></span><span>gridflow</span></div>}
function IconButton({icon:I,label,onClick}:{icon:LucideIcon;label:string;onClick?:()=>void}){return <button className="icon-button" aria-label={label} title={label} onClick={onClick}><I size={17}/></button>}
function Toasts({items,dismiss}:{items:Notice[];dismiss:(id:number)=>void}){return <div className="toast-stack" aria-live="polite">{items.map(n=><motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:8}} key={n.id} className={`toast toast-${n.kind||'success'}`}><CheckCircle2 size={17}/>{n.text}<button onClick={()=>dismiss(n.id)} aria-label="Dismiss"><X size={15}/></button></motion.div>)}</div>}

export default function App(){
 const [page,setPage]=useState<Page>('Dashboard'),[dashboard,setDashboard]=useState<boolean>(()=>!!currentAdmin()),[login,setLogin]=useState(false),[menu,setMenu]=useState(false),[search,setSearch]=useState(''),[query,setQuery]=useState(''),[notices,setNotices]=useState<Notice[]>([]),[modal,setModalRaw]=useState<Modal|null>(null),[selected,setSelected]=useState<string|null>(null),[profileMenu,setProfileMenu]=useState(false),[notif,setNotif]=useState(false),[dateRange,setDateRange]=useState('Last 30 days'),[chartFilter,setChartFilter]=useState('This year'),[activityFilter,setActivityFilter]=useState(false)
 const reduced=useReducedMotion(),showOps=useShowOps()
 const [consumers,setConsumers]=useState<Consumer[]>([]),[meters,setMeters]=useState<Meter[]>([]),[bills,setBills]=useState<Bill[]>([]),[technicians,setTechnicians]=useState<Technician[]>([]),[serviceRecords,setServiceRecords]=useState<ServiceRecord[]>([]),[tariffs,setTariffs]=useState<Tariff[]>([]),[zones,setZones]=useState<Zone[]>([]),[profile,setProfile]=useState<Profile|null>(()=>currentAdmin()),[consumerUser,setConsumerUser]=useState<Consumer|null>(()=>currentConsumer()),[analytics,setAnalytics]=useState<Analytics>({monthly_energy:[],monthly_collection:[],consumer_distribution:{},recent_activity:[]}),[authReady,setAuthReady]=useState(false),[busy,setBusy]=useState(false)
 const notify=(text:string,kind:'success'|'error'='success')=>{const id=Date.now()+Math.random();setNotices(a=>[...a,{id,text,kind}]);window.setTimeout(()=>setNotices(a=>a.filter(n=>n.id!==id)),3800)}
 const applySession=async():Promise<boolean>=>{try{const p=await api.currentProfile();if(!p||!p.is_active){notify('Your account is awaiting approval by a super admin.','error');setProfile(null);setDashboard(false);return false}setProfile(p);setConsumerUser(null);setDashboard(true);setLogin(false);const target=pageFromHash();setPage(target&&(isAdmin(p.role)||!ADMIN_PAGES.includes(target))?target:'Dashboard');await api.markOverdue();void refreshData();return true}catch(e){notify(e instanceof Error?e.message:'Could not load your profile. Apply the v2 migration in Supabase.','error');setDashboard(false);return false}}
 const refreshData=async()=>{if(!supabase)return;setBusy(true);try{const [c,m,b,t,s,tr,a,z]=await Promise.all([api.consumers(),api.meters(),api.bills(),api.technicians(),api.serviceRecords(),api.tariffs(),api.analytics(),api.zones()]);setConsumers(c);setMeters(m);setBills(b);setTechnicians(t);setServiceRecords(s);setTariffs(tr);setAnalytics(a);setZones(z);setConsumerUser(prev=>{if(!prev)return null;const found=c.find(item=>item.id===prev.id||item.account===prev.account);return found||prev})}catch(e){notify(e instanceof Error?e.message:'Could not load workspace data.','error')}finally{setBusy(false)}}
 useEffect(()=>{const client=supabase;const savedAdmin=currentAdmin();const savedConsumer=currentConsumer();if(savedConsumer){setConsumerUser(savedConsumer);setDashboard(false);setLogin(false);void refreshData()}else if(savedAdmin){setProfile(savedAdmin);setDashboard(true);setLogin(false);void refreshData()}if(!client){setAuthReady(true);return}let active=true;client.auth.getSession().then(async({data})=>{if(!active)return;if(data.session?.user&&!currentConsumer()){const ok=await applySession();if(!ok)await client.auth.signOut()}setAuthReady(true)}).catch(()=>{if(active)setAuthReady(true)});const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{if(!active)return;if(!session&&!currentAdmin()&&!currentConsumer()){setDashboard(false);setProfile(null);setConsumerUser(null);setConsumers([]);setMeters([]);setBills([]);setTechnicians([])}});return()=>{active=false;subscription.unsubscribe()}},[])
 useEffect(()=>{if(!dashboard||!supabase)return;const channel=supabase.channel('gridflow-live-updates').on('postgres_changes',{event:'*',schema:'public'},()=>window.setTimeout(()=>void refreshData(),200)).subscribe();return()=>{void supabase?.removeChannel(channel)}},[dashboard])
 const role=profile?.role
 const setModal=(m:Modal|null)=>{if(m&&['consumer','meter','technician','bill','delete'].includes(m.type)&&!isAdmin(role)){notify(PERMISSION_MESSAGE,'error');return}setModalRaw(m)}
 useEffect(()=>{if(!dashboard)return;const next=`#/${pageSlug(page)}`;if(window.location.hash!==next)window.location.hash=next},[page,dashboard])
 useEffect(()=>{const f=()=>{const p=pageFromHash();if(!p||!dashboard)return;if(ADMIN_PAGES.includes(p)&&!isAdmin(role)){notify(PERMISSION_MESSAGE,'error');setPage('Dashboard');return}setPage(p)};window.addEventListener('hashchange',f);return()=>window.removeEventListener('hashchange',f)},[dashboard,role])
 useEffect(()=>{if(authReady&&!dashboard&&!consumerUser&&window.location.hash)window.history.replaceState(null,'',window.location.pathname+window.location.search)},[authReady,dashboard,consumerUser])
 const go=(p:Page)=>{if(!supabase||!dashboard){openLogin();return}if(ADMIN_PAGES.includes(p)&&!isAdmin(role)){notify(PERMISSION_MESSAGE,'error');return}setPage(p);setDashboard(true);setLogin(false);setMenu(false);setSearch('');setSelected(null);window.scrollTo({top:0,behavior:'smooth'})}
 const openDashboard=()=>{if(consumerUser)return;if(!supabase||!dashboard){openLogin();return}setPage('Dashboard');setDashboard(true);setLogin(false);setMenu(false);window.scrollTo({top:0,behavior:'smooth'})}
 const openLogin=()=>{setLogin(true);setDashboard(false);setConsumerUser(null);window.scrollTo({top:0,behavior:'smooth'})}
 const filtered=useMemo(()=>consumers.filter(c=>`${c.name} ${c.account} ${c.address} ${c.zone} ${c.plan}`.toLowerCase().includes(query.toLowerCase())),[consumers,query])
 const active=consumers.filter(c=>c.status==='Active').length,paid=bills.filter(b=>b.status==='Paid').reduce((a,b)=>a+b.amount,0)
 return <>
  {!authReady?<div className="login-screen" role="status">Connecting securely to GridFlow…</div>:!dashboard&&!login&&!consumerUser?<Landing openDashboard={openDashboard} openLogin={openLogin} go={go}/>:login?<Login onBack={()=>{setLogin(false);setDashboard(false)}} onAdminSignIn={async(u,p)=>{const r=await signIn(u,p);if(r.ok&&r.profile){notify('Signed in as Super Administrator.');setProfile(r.profile);setConsumerUser(null);setLogin(false);setDashboard(true);const t=pageFromHash();setPage(t&&(isAdmin(r.profile.role)||!ADMIN_PAGES.includes(t))?t:'Dashboard');await api.markOverdue();void refreshData();return {ok:true}}return {ok:false,message:r.message||'Admin sign-in failed.'}}} onConsumerSignIn={async(email,acct)=>{const r=await consumerSignIn(email,acct);if(r.ok&&r.consumer){notify(`Welcome back, ${r.consumer.name}!`);setConsumerUser(r.consumer);setProfile(null);setLogin(false);setDashboard(false);void refreshData();return {ok:true}}return {ok:false,message:r.message||'Consumer sign-in failed.'}}}/>:consumerUser?<ConsumerPortal consumer={consumerUser} meters={meters} bills={bills} serviceRecords={serviceRecords} tariffs={tariffs} refresh={refreshData} notify={notify} onSignOut={async()=>{await signOutAll();setConsumerUser(null);setProfile(null);setDashboard(false);setLogin(false);notify('You have been signed out.')}}/>:<div className="app-shell">
   <aside className={`sidebar ${menu?'sidebar-open':''}`}><div className="sidebar-brand"><Brand/><button className="sidebar-collapse" aria-label="Collapse sidebar">⌃⌄</button></div><div className="workspace-switcher"><span className="workspace-mark">N</span><span className="workspace-copy"><b>GridFlow Utility</b><small>Organization</small></span><ChevronDown size={15}/></div>
    <div className="side-label">WORKSPACE</div><nav className="side-nav" aria-label="Main navigation">{(['Dashboard','Consumers','Meters','Bills','Technicians','Reports'] as Page[]).map(item=>{const I=pageIcons[item];return <button key={item} className={`side-link ${page===item?'selected':''}`} onClick={()=>go(item)}><I size={18}/><span>{item}</span>{item==='Bills'&&bills.some(x=>x.status!=='Paid')&&<span className="nav-count">{bills.filter(x=>x.status!=='Paid').length}</span>}</button>})}</nav>
    {isAdmin(role)&&<><div className="side-label side-label-tools">DATABASE</div><nav className="side-nav" aria-label="Database tools">{(['Database Console','Database Explorer'] as Page[]).map(item=>{const I=pageIcons[item];return <button key={item} className={`side-link ${page===item?'selected':''}`} onClick={()=>go(item)}><I size={18}/><span>{item}</span></button>})}</nav></>}<div className="side-label side-label-tools">PREFERENCES</div><nav className="side-nav"><button className={`side-link ${page==='Settings'?'selected':''}`} onClick={()=>go('Settings')}><Settings size={18}/><span>Settings</span></button><button className="side-link" onClick={()=>notify('Help center is ready to connect.')}><CircleHelp size={18}/><span>Help center</span></button></nav>
    <div className="sidebar-bottom"><div className="sync-card"><div className="sync-card-top"><span className="sync-orb"><RefreshCw size={14}/></span><b>{busy?'Syncing data':'Connected to database'}</b><i className="live-dot"/></div><p>Workspace data is synced with your GridFlow database.</p><div className="sync-track"><i/></div><div className="sync-foot"><span>Last sync</span><b>{busy?'In progress':'Just now'}</b></div></div><div className="sidebar-user"><div className="avatar avatar-user">GF</div><div className="sidebar-user-copy"><b>{profile?(profile.full_name||profile.email):'Administrator'}</b><small>{profile?roleLabel[profile.role]:'GridFlow workspace'}</small></div><button className="user-more" onClick={()=>setProfileMenu(!profileMenu)} aria-label="Profile options"><MoreHorizontal size={17}/></button>{profileMenu&&<div className="profile-pop"><button onClick={()=>{setProfileMenu(false);go('Settings')}}><UserRound size={15}/> Profile settings</button><button onClick={async()=>{setProfileMenu(false);await signOutAll();setProfile(null);setConsumerUser(null);setDashboard(false);setLogin(false);setPage('Dashboard')}}><LogOut size={15}/> Sign out</button></div>}</div></div>
   </aside>{menu&&<button className="mobile-scrim" aria-label="Close menu" onClick={()=>setMenu(false)}/>}
   <main className="main-area"><header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={()=>setMenu(true)}><Menu size={18}/></button><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14}/><b>{page}</b></div></div><div className="topbar-actions"><label className="global-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search anything..."/><kbd>⌘ K</kbd></label><span className="topbar-divider"/><button className="period-button sql-toggle" aria-pressed={showOps} aria-label="Show Database Operations" title="Show Database Operations" onClick={()=>opLog.setShowOps(!showOps)}><Database size={15}/>Database Operations<i className="sql-toggle-dot"/></button><button className="period-button" onClick={()=>setDateRange(dateRange==='Last 30 days'?'Last 7 days':'Last 30 days')}><CalendarDays size={15}/>{dateRange}<ChevronDown size={14}/></button><div className="notification-wrap"><IconButton icon={Bell} label="Notifications" onClick={()=>setNotif(!notif)}/><i className="notification-indicator"/>{notif&&<div className="notification-pop"><b>Notifications</b><p><CheckCircle2/> Sync complete · just now</p><p><CreditCard/> {bills.filter(b=>b.status==='Pending'||b.status==='Overdue').length} bills awaiting payment</p><p><Gauge/> {meters.length} connected meters</p><button onClick={()=>setNotif(false)}>Mark all as read</button></div>}</div><div className="avatar avatar-user top-avatar">{(profile?.full_name||profile?.email||'GF').slice(0,2).toUpperCase()}</div></div></header>
    <div className="page-content"><AnimatePresence mode="wait"><motion.div key={page} initial={{opacity:0,y:reduced?0:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reduced?0:-5}} transition={{duration:.2}}>
     {page==='Dashboard'&&<DashboardPage consumers={consumers} meters={meters} bills={bills} technicians={technicians} analytics={analytics} active={active} paid={paid} go={go} chartFilter={chartFilter} setChartFilter={setChartFilter} setQuery={setQuery} activityFilter={activityFilter} setActivityFilter={setActivityFilter}/>}
     {page==='Consumers'&&<ConsumersPage rows={filtered} query={query} setQuery={setQuery} add={()=>{setSelected(null);setModal({type:'consumer'})}} edit={id=>{setSelected(id);setModal({type:'consumer',id})}} del={id=>setModal({type:'delete',id})} view={id=>setModal({type:'details',id})}/>}
     {page==='Meters'&&<MetersPage rows={meters} add={()=>setModal({type:'meter'})} recordReading={()=>setModal({type:'reading'})} edit={id=>setModal({type:'meter',id})}/>}
     {page==='Bills'&&<BillsPage rows={bills} generate={()=>setModal({type:'bill'})} markPaid={async bill=>{try{if(bill.dbId){await api.markBillPaid(bill.dbId);await refreshData();notify('Payment recorded successfully.')}}catch(e){notify(e instanceof Error?e.message:'Payment could not be recorded.','error')}}} exportData={()=>exportRows(bills,'gridflow-bills.csv')}/>}
     {page==='Technicians'&&<TechniciansPage rows={technicians} records={serviceRecords} consumers={consumers} meters={meters} add={()=>setModal({type:'technician'})} schedule={()=>setModal({type:'service'})} edit={id=>{setSelected(id);setModal({type:'technician',id})}}/>}
     {page==='Reports'&&<ReportsPage consumers={consumers} bills={bills} meters={meters} analytics={analytics} exportData={()=>exportRows(bills,'gridflow-report.csv')}/>}
     {page==='Settings'&&<SettingsPage demoMode={demoMode} tariffs={tariffs} zones={zones} me={profile} refresh={refreshData} notify={notify}/>}
      {page==='Database Console'&&isAdmin(role)&&<DatabaseConsole/>}
      {page==='Database Explorer'&&isAdmin(role)&&<DatabaseExplorer/>}
    </motion.div></AnimatePresence></div></main></div>}
  <AnimatePresence>{modal&&<EntityModal modal={modal} close={()=>setModal(null)} zones={zones} consumers={consumers} meters={meters} bills={bills} technicians={technicians} refresh={refreshData} notify={notify}/>}</AnimatePresence><Toasts items={notices} dismiss={id=>setNotices(n=>n.filter(x=>x.id!==id))}/><SqlToasts/>
 </>
}

function Landing({openDashboard,openLogin,go}:{openDashboard:()=>void;openLogin:()=>void;go:(p:Page)=>void}){
 const [mobile,setMobile]=useState(false),[scrolled,setScrolled]=useState(false)
 React.useEffect(()=>{const f=()=>setScrolled(window.scrollY>90);window.addEventListener('scroll',f,{passive:true});return()=>window.removeEventListener('scroll',f)},[])
 return <div className="landing"><section className="hero" id="overview"><video className="hero-video" autoPlay loop muted playsInline preload="metadata" aria-hidden="true"><source src="/videos/gemini-loop.webm" type="video/webm"/></video><div className="hero-shade"/><div className={`site-nav ${scrolled?'site-nav-scrolled':''}`}><button className="landing-brand-button" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}><Brand light/></button><div className={`site-nav-links ${mobile?'nav-mobile-open':''}`}><a href="#overview" onClick={()=>setMobile(false)}>Overview</a><a href="#platform" onClick={()=>setMobile(false)}>Platform</a><a href="#analytics" onClick={()=>setMobile(false)}>Analytics</a><a href="#features" onClick={()=>setMobile(false)}>Features</a><button className="nav-login" onClick={openLogin}>Log in <ArrowUpRight size={15}/></button></div><button className="nav-mobile-toggle" aria-label="Toggle navigation" onClick={()=>setMobile(!mobile)}>{mobile?<X size={21}/>:<Menu size={21}/>}</button></div>
  <div className="hero-content"><div className="hero-copy"><motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="eyebrow hero-eyebrow"><span className="eyebrow-line"/> ENERGY OPERATIONS, IN SYNC</motion.div><motion.h1 initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{duration:.65,delay:.08}}>Powering transparent<br/>energy <em>management.</em></motion.h1><motion.p initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:.17}}>Monitor consumers, manage smart meters, automate billing, and see your network’s performance in real time.</motion.p><div className="hero-ctas"><button className="button-primary hero-primary" onClick={openDashboard}>Access dashboard <ArrowRight size={17}/></button><a className="hero-secondary" href="#analytics">Explore analytics <ArrowDownRight size={16}/></a></div><div className="hero-proof"><div><div className="proof-stars">SECURE · PRIVATE · LIVE</div><span>Your utility operations, in one place</span></div></div></div><div className="hero-aside"><div className="hero-live-pill"><i className="live-dot"/> GRIDFLOW ADMIN PORTAL</div><div className="hero-aside-bottom"><span className="mini-wave"><Wifi size={16}/></span><span>Every connection.<br/>In perfect sync.</span><ArrowUpRight size={16}/></div></div></div>
  <div className="hero-bottom"><span className="hero-coordinate">GRIDFLOW ADMINISTRATION</span><span className="hero-scroll">SCROLL TO EXPLORE <i/></span><span className="hero-edition">GRIDFLOW PLATFORM <b>01 — 06</b></span></div>
  <div className="hero-stats">{[{label:'Consumers connected',value:'—',icon:Users},{label:'Units tracked',value:'—',icon:Zap},{label:'Collection rate',value:'—',icon:CircleDollarSign},{label:'Field technicians',value:'—',icon:Wrench}].map((s,i)=><motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:.25+i*.08}} key={s.label} className="hero-stat"><span className="hero-stat-icon"><s.icon size={17}/></span><div><b>{s.value}</b><span>{s.label}</span></div><ArrowUpRight className="hero-stat-arrow" size={15}/></motion.div>)}</div>
 </section>
 <section className="landing-analytics" id="analytics"><div className="analytics-watermark">GRIDFLOW</div><div className="landing-section-wrap"><div className="analytics-intro"><div className="eyebrow light-eyebrow"><span/> BUILT FOR WHAT’S NEXT</div><h2>When the grid gets<br/>smarter, <em>everyone wins.</em></h2><p>One clear view of your entire operation. From the first meter reading to the final payment.</p><button className="button-primary dashboard-cta" onClick={openDashboard}>Step inside GridFlow <ArrowUpRight size={17}/></button><div className="intro-footnote"><i className="green-pulse"/> SIGN IN TO VIEW LIVE DATA <i/> REFRESHED JUST NOW</div></div>
  <div className="floating-stats-card"><div className="floating-card-header"><div><span className="floating-label">SYSTEM OVERVIEW</span><b>Network pulse</b></div><span className="connection-pill"><i/> EMPTY WORKSPACE</span></div><div className="floating-total"><b>—</b><span>kWh <i>from recorded readings</i></span></div><div className="floating-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={consumptionData}><defs><linearGradient id="floatArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5694ff" stopOpacity={.3}/><stop offset="100%" stopColor="#5694ff" stopOpacity={0}/></linearGradient></defs><Area type="monotone" dataKey="usage" stroke="#67a5ff" strokeWidth={2} fill="url(#floatArea)"/><XAxis dataKey="month" tick={false} axisLine={false} tickLine={false}/></AreaChart></ResponsiveContainer></div><div className="floating-card-foot"><span><i className="legend-blue"/> THIS MONTH</span><span>SYNCED FROM DATABASE <RefreshCw size={12}/></span></div><div className="floating-live-callout"><div className="callout-icon"><Zap size={17}/></div><span><b>Waiting for your first meter reading</b><small>Synced as meter data arrives</small></span><Activity size={23} className="callout-wave"/></div></div>
  <div className="energy-node node-a"><span><Zap size={14}/></span></div><div className="energy-node node-b"><span><RadioTower size={14}/></span></div><div className="energy-node node-c"><span><Home size={14}/></span></div><div className="energy-caption caption-a">SMART INFRASTRUCTURE <span>↗ 0 UNITS</span></div><div className="energy-caption caption-b">REAL-TIME NETWORK <span>● ONLINE</span></div></div>
  <div className="landing-below-metrics">{[{label:'Smart meters online',value:'—',trend:'',icon:Gauge,color:'cyan'},{label:'Energy delivered',value:'—',trend:'',icon:Zap,color:'blue'},{label:'Carbon avoided',value:'—',trend:'',icon:Leaf,color:'green'}].map(v=><div key={v.label} className="below-metric"><span className={`below-metric-icon ${v.color}`}><v.icon size={17}/></span><div><small>{v.label}</small><b>{v.value}</b></div><span className="metric-trend">↗ {v.trend}</span></div>)}</div>
 </section>
 <section id="platform" className="platform-section"><div className="section-heading"><div><div className="eyebrow section-eyebrow"><span/> MADE FOR THE MODERN GRID</div><h2>Complex systems.<br/><em>Clear decisions.</em></h2></div><p>All the moving parts of your energy operation, working together beautifully.</p></div><div className="platform-grid"><FeatureCard icon={Users} tag="01 / CUSTOMERS" title={<>Every customer,<br/>in their right place.</>} copy="A clearer picture of your people, their plans, and the power they use." color="blue" onClick={()=>go('Consumers')}/><FeatureCard icon={Gauge} tag="02 / METERING" title={<>Know what’s happening.<br/>As it happens.</>} copy="Live meter intelligence that helps your entire network run smarter." color="cyan" onClick={()=>go('Meters')}/><FeatureCard icon={CreditCard} tag="03 / BILLING" title={<>Billing that just<br/>makes sense.</>} copy="From accurate usage to on-time payment. Every detail in sync." color="violet" onClick={()=>go('Bills')}/><FeatureCard icon={Wrench} tag="04 / FIELD OPS" title={<>Your team, always<br/>one step ahead.</>} copy="Better visibility for the people keeping your infrastructure running." color="green" onClick={()=>go('Technicians')}/></div></section>
 <section id="features" className="platform-detail"><div className="detail-art"><div className="orbit orbit-1"/><div className="orbit orbit-2"/><div className="orbit orbit-3"/><div className="detail-core"><Brand/><span className="core-halo"><Zap size={26}/></span><span className="core-label">THE GRIDFLOW NETWORK</span></div><div className="detail-orb orb-one"><Home size={16}/></div><div className="detail-orb orb-two"><Gauge size={16}/></div><div className="detail-orb orb-three"><Lightbulb size={16}/></div><div className="detail-orb orb-four"><RadioTower size={16}/></div><span className="detail-orbit-label ol-one">SMART HOMES</span><span className="detail-orbit-label ol-two">LIVE METERING</span><span className="detail-orbit-label ol-three">INTELLIGENCE</span></div><div className="detail-copy"><div className="eyebrow section-eyebrow"><span/> A MORE CONNECTED FUTURE</div><h2>The grid isn’t<br/>going to wait.<br/><em>Now you don’t have to.</em></h2><p>Bring the whole picture into focus. GridFlow connects the people, data, and systems that keep your energy network moving forward.</p><div className="detail-points"><span><Check size={15}/>One view across every operation</span><span><Check size={15}/>Information as it happens</span><span><Check size={15}/>Made to grow with your network</span></div><button className="button-dark" onClick={openDashboard}>Explore the platform <ArrowRight size={17}/></button></div></section>
 <section className="closing-cta"><div className="closing-light"/><div className="eyebrow"><span/> YOUR GRID, REIMAGINED</div><h2>A clearer way<br/>to keep <em>everything moving.</em></h2><p>Bring your entire energy operation into focus.</p><button className="button-white" onClick={openDashboard}>Enter GridFlow <ArrowRight size={17}/></button><span className="closing-deco">G</span></section>
 <footer className="landing-footer"><Brand/><span>© 2026 GridFlow Technologies</span><div><a href="#overview">Privacy</a><a href="#overview">Terms</a><a href="#overview">Status <i className="footer-status"/></a></div><span>BUILT FOR A BRIGHTER GRID <i>✳</i></span></footer></div>
}

function FeatureCard({icon:Icon,tag,title,copy,color,onClick}:{icon:LucideIcon;tag:string;title:React.ReactNode;copy:string;color:string;onClick:()=>void}){return <button className={`feature-card feature-${color}`} onClick={onClick}><div className="feature-head"><span className="feature-icon"><Icon size={20}/></span><ArrowUpRight size={17}/></div><span className="feature-tag">{tag}</span><h3>{title}</h3><p>{copy}</p><span className="feature-line"/></button>}

function Login({
  onBack,
  onAdminSignIn,
  onConsumerSignIn
}: {
  onBack: () => void;
  onAdminSignIn: (u: string, p: string) => Promise<{ ok: boolean; message?: string }>;
  onConsumerSignIn: (email: string, acct: string) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [tab, setTab] = useState<'admin' | 'consumer'>('admin')
  const [adminEmail, setAdminEmail] = useState(SUPER_ADMIN_EMAIL)
  const [adminPass, setAdminPass] = useState(SUPER_ADMIN_PASS)
  const [consumerEmail, setConsumerEmail] = useState('')
  const [consumerAcct, setConsumerAcct] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminEmail.trim() || !adminPass.trim()) {
      setError('Enter your administrator email and password.')
      return
    }
    setBusy(true); setError('')
    try {
      const res = await onAdminSignIn(adminEmail, adminPass)
      if (!res.ok) setError(res.message || 'Authentication failed.')
    } finally { setBusy(false) }
  }

  const handleConsumerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!consumerEmail.trim() || !consumerAcct.trim()) {
      setError('Please enter both your registered email and Account ID.')
      return
    }
    setBusy(true); setError('')
    try {
      const res = await onConsumerSignIn(consumerEmail, consumerAcct)
      if (!res.ok) setError(res.message || 'Consumer verification failed.')
    } finally { setBusy(false) }
  }

  return (
    <div className="login-screen">
      <video className="hero-video login-video" autoPlay loop muted playsInline preload="metadata">
        <source src="/videos/gemini-loop.webm" type="video/webm" />
      </video>
      <div className="login-overlay" />
      <button className="login-back" onClick={onBack}><ArrowLeft size={16} /> Back to overview</button>
      <div className="login-center">
        <div className="login-brand"><Brand light /></div>
        <div className="login-card">
          <div className="login-logo"><Zap size={22} /></div>
          <div className="login-eyebrow">
            {tab === 'admin' ? 'SYSTEM CONTROL CENTER' : 'CONSUMER PORTAL'}
          </div>
          <h1>{tab === 'admin' ? 'Administrator' : 'Consumer'}<br />access.</h1>
          <p className="login-sub">
            {tab === 'admin'
              ? 'Authorized access for GridFlow system management and database controls.'
              : 'Passwordless access for utility consumers to view meters and pay bills.'}
          </p>

          <div className="login-tabs">
            <button
              type="button"
              className={`login-tab-btn ${tab === 'admin' ? 'active' : ''}`}
              onClick={() => { setTab('admin'); setError('') }}
            >
              <Shield size={14} /> Administrator
            </button>
            <button
              type="button"
              className={`login-tab-btn ${tab === 'consumer' ? 'active' : ''}`}
              onClick={() => { setTab('consumer'); setError('') }}
            >
              <Users size={14} /> Consumer
            </button>
          </div>

          {tab === 'admin' ? (
            <form onSubmit={handleAdminSubmit}>
              <label htmlFor="admin-email">
                <span>Administrator email</span>
                <div className="login-input-wrap">
                  <UserRound size={17} />
                  <input
                    id="admin-email"
                    type="email"
                    autoComplete="username"
                    value={adminEmail}
                    onChange={e => setAdminEmail(e.target.value)}
                    placeholder="balaji.c.m.x64@gmail.com"
                  />
                </div>
              </label>
              <label htmlFor="admin-pass">
                <span>Password</span>
                <div className="login-input-wrap">
                  <LockKeyhole size={17} />
                  <input
                    id="admin-pass"
                    type={show ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={adminPass}
                    onChange={e => setAdminPass(e.target.value)}
                    placeholder="Enter password"
                  />
                  <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)}>
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              <div className="login-hint">Super Admin: <b>balaji.c.m.x64@gmail.com</b></div>
              {error && <div className="login-error"><CircleAlert size={15} />{error}</div>}
              <button type="submit" className="button-primary login-submit" disabled={busy}>
                {busy ? 'Verifying credentials…' : 'Access control center'}
                <ArrowRight size={17} />
              </button>
            </form>
          ) : (
            <form onSubmit={handleConsumerSubmit}>
              <label htmlFor="consumer-email">
                <span>Registered email</span>
                <div className="login-input-wrap">
                  <UserRound size={17} />
                  <input
                    id="consumer-email"
                    type="email"
                    value={consumerEmail}
                    onChange={e => setConsumerEmail(e.target.value)}
                    placeholder="e.g. maya.patel@example.com"
                  />
                </div>
              </label>
              <label htmlFor="consumer-acct">
                <span>Account ID / Consumer ID</span>
                <div className="login-input-wrap">
                  <FileText size={17} />
                  <input
                    id="consumer-acct"
                    type="text"
                    value={consumerAcct}
                    onChange={e => setConsumerAcct(e.target.value)}
                    placeholder="e.g. GF-2048"
                  />
                </div>
              </label>
              <div className="login-hint">Passwordless login. Enter the email and Account ID assigned to your connection.</div>
              {error && <div className="login-error"><CircleAlert size={15} />{error}</div>}
              <button type="submit" className="button-primary login-submit" disabled={busy}>
                {busy ? 'Looking up account…' : 'Sign in to Consumer Portal'}
                <ArrowRight size={17} />
              </button>
            </form>
          )}

          <div className="login-foot">
            <Shield size={13} /> SECURE PORTAL <i /> <span className="live-dot" /> SYSTEM ONLINE
          </div>
        </div>
        <span className="login-copyright">© 2026 GridFlow Technologies</span>
      </div>
    </div>
  )
}


function DashboardPage({consumers,meters,bills,technicians,analytics,active,paid,go,chartFilter,setChartFilter,setQuery,activityFilter,setActivityFilter}:{consumers:Consumer[];meters:Meter[];bills:Bill[];technicians:Technician[];analytics:Analytics;active:number;paid:number;go:(p:Page)=>void;chartFilter:string;setChartFilter:(v:string)=>void;setQuery:(v:string)=>void;activityFilter:boolean;setActivityFilter:(v:boolean)=>void}){
 const online=meters.filter(m=>m.status==='Online').length,collection=Math.round(100*bills.filter(b=>b.status==='Paid').length/Math.max(1,bills.length))
 const consumptionData=analytics.monthly_energy.map(x=>({month:x.month,usage:x.usage_kwh/1000}))
 const collectionData=analytics.monthly_collection.map(x=>({month:x.month,paid:100*x.paid/Math.max(1,x.paid+x.pending),pending:100*x.pending/Math.max(1,x.paid+x.pending)}))
 const pieData=['Residential','Business','Commercial'].map((name,i)=>({name,value:analytics.consumer_distribution[name]||analytics.consumer_distribution[name.toLowerCase()]||0,color:['#4664f5','#34b1d6','#99decf'][i]})).filter(d=>d.value>0)
 const activities=analytics.recent_activity.map(x=>({icon:x.entity==='meter'?'meter':x.entity==='consumer'?'user':'check',title:x.action,detail:`${x.entity}${x.entity_id?` · ${x.entity_id}`:''}`,time:new Date(x.created_at).toLocaleString(),tone:x.entity==='bill'?'green':'blue'}))
 return <div className="dashboard-page"><SectionHeading eyebrow={new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).toUpperCase()} title="GridFlow overview" subtitle="Here’s what’s happening across your energy network today." action={<div className="title-actions"><span className="data-mode-pill"><i/> LIVE DATA</span><button className="button-outline" onClick={()=>window.print()}><Download size={15}/> Export overview</button></div>}/>
  <div className="welcome-banner"><div className="welcome-glow"/><span className="welcome-icon"><Zap size={20}/></span><div><b>Your network is running smoothly.</b><p>{consumers.length} consumers, {meters.length} meters, and {bills.length} bills synced from your database.</p></div><span className="banner-status"><i/> SYSTEMS NOMINAL</span><ArrowUpRight className="welcome-arrow" size={18}/></div>
   <div className="stats-grid">{[{label:'Total consumers',value:consumers.length.toLocaleString(),delta:'',icon:Users,sub:`${active} active accounts`,color:'blue'},{label:'Energy consumed',value:meters.reduce((n,m)=>n+m.reading,0).toLocaleString(),unit:'kWh',delta:'',icon:Zap,sub:'Across all connected meters',color:'cyan'},{label:'Collection rate',value:`${collection}%`,delta:'',icon:Wallet,sub:`${money(paid)} collected this month`,color:'green'},{label:'Active technicians',value:technicians.length.toLocaleString(),delta:'',icon:Wrench,sub:`${technicians.length} currently assigned`,color:'violet'}].map(s=><div className="stat-card" key={s.label}><div className="stat-card-top"><span>{s.label}</span><span className={`stat-icon ${s.color}`}><s.icon size={18}/></span></div><div className="stat-value">{s.value}<small>{s.unit}</small></div><div className="stat-card-bottom"><span className="stat-delta">↗ {s.delta}</span><span>{s.sub}</span></div><div className={`stat-spark ${s.color}`}><span/></div></div>)}</div>
  <div className="dashboard-main-grid"><div className="panel consumption-panel"><div className="panel-head"><div><h3>Energy consumption</h3><p>Monthly energy usage across the network</p></div><SelectControl value={chartFilter} onChange={setChartFilter} options={['This year','Last 12 months','This quarter']}/></div><div className="chart-key"><span><i className="key-current"/> This year</span><span className="chart-measure">MWh</span></div><div className="consumption-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={consumptionData} margin={{top:12,right:10,left:-12,bottom:0}}><defs><linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5572f5" stopOpacity={.19}/><stop offset="95%" stopColor="#5572f5" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#eef0f5" strokeDasharray="3 4" vertical={false}/><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill:'#949aaa',fontSize:11}} dy={8}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#949aaa',fontSize:11}} domain={[0,40]} ticks={[0,10,20,30,40]}/><Tooltip contentStyle={{border:'1px solid #edf0f4',borderRadius:10,fontSize:12,boxShadow:'0 8px 25px rgba(20,25,50,.08)'}} formatter={(v)=>[`${v} MWh`,'Usage']}/><Area type="monotone" dataKey="last" stroke="#cbd1df" strokeWidth={1.7} strokeDasharray="5 5" fill="none"/><Area type="monotone" dataKey="usage" stroke="#5572f5" strokeWidth={2.5} fill="url(#usageFill)" activeDot={{r:5,fill:'#5572f5',stroke:'white',strokeWidth:3}}/></AreaChart></ResponsiveContainer></div><div className="chart-bottom"><span><i className="green-pulse"/> Database readings</span><span>LIVE DATABASE SYNC <RefreshCw size={12}/></span></div></div>
   <div className="panel distribution-panel"><div className="panel-head"><div><h3>Consumer distribution</h3><p>Accounts by service type</p></div><button className="plain-icon" aria-label="More options"><MoreHorizontal size={18}/></button></div><div className="distribution-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="68%" outerRadius="91%" paddingAngle={4} stroke="none" startAngle={90} endAngle={-270}>{pieData.map(d=><Cell key={d.name} fill={d.color}/>)}</Pie><Tooltip formatter={(v)=>[`${v} consumers`,'Accounts']}/></PieChart></ResponsiveContainer><div className="donut-center"><b>{consumers.length.toLocaleString()}</b><span>CONSUMERS</span></div></div><div className="distribution-legend">{pieData.map(d=><div key={d.name}><i style={{background:d.color}}/><span>{d.name}</span><b>{Math.round(d.value/Math.max(1,consumers.length)*100)}%</b></div>)}</div><button className="panel-link" onClick={()=>go('Consumers')}>View all consumers <ArrowRight size={15}/></button></div>
  </div>
  <div className="dashboard-lower-grid"><div className="panel collection-panel"><div className="panel-head"><div><h3>Bill collection</h3><p>Payment performance by month</p></div><button className="panel-link compact" onClick={()=>go('Bills')}>All bills <ArrowRight size={14}/></button></div><div className="collection-summary"><b>{money(paid)}</b><small>collected this month</small></div><div className="bar-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={collectionData} margin={{top:6,right:5,left:-28,bottom:0}} barCategoryGap="28%"><CartesianGrid stroke="#eff1f5" vertical={false} strokeDasharray="3 4"/><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill:'#9298a8',fontSize:10}} dy={7}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#9298a8',fontSize:10}} ticks={[0,50,100]} tickFormatter={v=>`${v}%`}/><Tooltip cursor={{fill:'#f7f8fa'}} formatter={v=>[`${v}%`,'Bills']}/><Bar dataKey="paid" fill="#5370f4" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></div>
   <div className="panel activity-panel"><div className="panel-head"><div><h3>Live activity</h3><p>Recent updates across your network</p></div><button className={`plain-icon ${activityFilter?'filter-active':''}`} aria-label="Filter activity" onClick={()=>setActivityFilter(!activityFilter)}><Filter size={16}/></button></div>{activityFilter&&<div className="activity-filter-note">Showing all recent events <button onClick={()=>setActivityFilter(false)}>Clear</button></div>}<div className="activity-list">{activities.filter((_,i)=>!activityFilter||i<3).map((a,i)=><div className="activity-item" key={a.title}><span className={`activity-icon activity-${a.tone}`}>{a.icon==='check'?<Check size={15}/>:a.icon==='meter'?<Gauge size={15}/>:a.icon==='user'?<Users size={15}/>:<CreditCard size={15}/>}</span><div><b>{a.title}</b><small>{a.detail}</small></div><span className="activity-time">{a.time}</span>{i<activities.length-1&&<i className="activity-line"/>}</div>)}</div><button className="panel-link" onClick={()=>go('Reports')}>View activity log <ArrowRight size={15}/></button></div>
  </div>
  <div className="dashboard-bottom-line"><span><i className="live-dot"/> Supabase workspace connected</span><span><RefreshCw size={12}/> Last synchronization just now</span><span><span className="tiny-shield"><Shield size={12}/></span> Live database · sync enabled</span></div>
 </div>
}


function ConsumersPage({rows,query,setQuery,add,edit,del,view}:{rows:Consumer[];query:string;setQuery:(v:string)=>void;add:()=>void;edit:(id:string)=>void;del:(id:string)=>void;view:(id:string)=>void}){
 const [status,setStatus]=useState('All statuses'),[sort,setSort]=useState('Newest first'),[page,setPage]=useState(1)
 useEffect(()=>setPage(1),[query,status,sort])
 const visible=rows.filter(c=>status==='All statuses'||c.status===status).slice().sort((a,b)=>sort==='Name A–Z'?a.name.localeCompare(b.name):sort==='Highest usage'?b.usage-a.usage:0)
 const pageSize=8,pageCount=Math.max(1,Math.ceil(visible.length/pageSize))
 const pageRows=visible.slice((page-1)*pageSize,page*pageSize)
 return <div className="entity-page"><SectionHeading eyebrow="CUSTOMER OPERATIONS" title="Consumers" subtitle="Manage every connection, account, and customer relationship." action={<button className="button-primary" onClick={add}><Plus size={16}/> Add consumer</button>}/><div className="entity-summary-strip"><div><span className="summary-icon blue"><Users size={17}/></span><span><small>Total consumers</small><b>{rows.length}</b></span></div><div><span className="summary-icon green"><Check size={17}/></span><span><small>Active accounts</small><b>{rows.filter(x=>x.status==='Active').length}</b></span></div><div><span className="summary-icon gray"><Clock3 size={17}/></span><span><small>Inactive accounts</small><b>{rows.filter(x=>x.status==='Inactive').length}</b></span></div><div><span className="summary-icon violet"><MapPin size={17}/></span><span><small>Service zones</small><b>{new Set(rows.map(x=>x.zone).filter(Boolean)).size}</b></span></div></div><div className="panel table-panel"><PageToolbar><SearchControl value={query} onChange={setQuery} placeholder="Find by name, account, address..."/><SelectControl value={status} onChange={setStatus} options={['All statuses','Active','Inactive']}/><SelectControl value={sort} onChange={setSort} options={['Newest first','Name A–Z','Highest usage']}/><button className="button-outline" onClick={()=>exportRows(visible,'gridflow-consumers.csv')}><Download size={15}/> Export</button></PageToolbar><DataTable headers={['CONSUMER','ACCOUNT ID','SERVICE ADDRESS','PLAN','USAGE (KWH)','STATUS','']}>
 {pageRows.map(c=><tr key={c.id} onDoubleClick={()=>view(c.id)}><td><button className="table-person" onClick={()=>view(c.id)}><span className={`avatar avatar-${c.id.charCodeAt(2)%5}`}>{c.name.split(' ').map(x=>x[0]).join('')}</span><b>{c.name}</b></button></td><td className="mono-cell">{c.account}</td><td><span className="address-cell">{c.address}</span></td><td><Pill tone="blue">{c.plan}</Pill></td><td className="usage-cell">{c.usage.toLocaleString()} <small>kWh</small></td><td><StatusPill status={c.status}/></td><td><div className="row-actions"><button aria-label="View consumer" onClick={()=>view(c.id)}><ArrowUpRight size={15}/></button><button aria-label="Edit consumer" onClick={()=>edit(c.id)}><MoreHorizontal size={16}/></button><button aria-label="Delete consumer" onClick={()=>del(c.id)}><Trash2 size={14}/></button></div></td></tr>)}</DataTable>{visible.length===0&&<div className="empty-state"><Search size={23}/><b>No consumers found</b><p>Try adjusting the search or filters.</p></div>}<div className="table-footer"><span>Showing <b>{pageRows.length?((page-1)*pageSize+1):0}–{Math.min(page*pageSize,visible.length)}</b> of <b>{visible.length}</b> consumers</span><div className="pagination"><button disabled={page===1} aria-label="Previous page" onClick={()=>setPage(page-1)}><ChevronLeft size={15}/></button><button className="page-active">{page} / {pageCount}</button><button disabled={page>=pageCount} aria-label="Next page" onClick={()=>setPage(page+1)}><ChevronRight size={15}/></button></div></div></div></div>
}

function MetersPage({rows,add,recordReading,edit}:{rows:Meter[];add:()=>void;recordReading:()=>void;edit:(id:string)=>void}){
 const [q,setQ]=useState(''),[filter,setFilter]=useState('All statuses')
 const visible=rows.filter(m=>`${m.serial} ${m.consumer} ${m.zone}`.toLowerCase().includes(q.toLowerCase())&&(filter==='All statuses'||m.status===filter))
 return <div className="entity-page"><SectionHeading eyebrow="SMART METERING" title="Meters" subtitle="Track every connected meter, reading, and signal across your network." action={<div className="title-actions"><button className="button-outline" onClick={recordReading} disabled={!rows.length}><Plus size={16}/> Record reading</button><button className="button-primary" onClick={add}><Plus size={16}/> Register meter</button></div>}/><div className="entity-summary-strip"><div><span className="summary-icon blue"><Gauge size={17}/></span><span><small>Total installed</small><b>{rows.length}</b></span></div><div><span className="summary-icon green"><Wifi size={17}/></span><span><small>Online now</small><b>{rows.filter(x=>x.status==='Online').length}</b></span><i className="summary-trend">99.2%</i></div><div><span className="summary-icon red"><RadioTower size={17}/></span><span><small>Offline</small><b>{rows.filter(x=>x.status==='Offline').length}</b></span></div><div><span className="summary-icon violet"><Zap size={17}/></span><span><small>Readings today</small><b>0</b></span></div></div><div className="meter-grid">{visible.map((m,i)=><div className="meter-card panel" key={m.id}><div className="meter-card-head"><span className="meter-id-icon"><Gauge size={18}/></span><StatusPill status={m.status}/><button aria-label="Edit meter" onClick={()=>edit(m.id)}><MoreHorizontal size={17}/></button></div><h3>{m.serial}</h3><p className="meter-customer">{m.consumer} <span>·</span> {m.zone}</p><div className="meter-reading"><span>Latest reading</span><b>{m.reading.toLocaleString()} <small>kWh</small></b></div><div className="meter-signal"><span>Signal strength</span><div className="signal-bars">{[1,2,3,4,5].map(n=><i key={n} className={m.signal>=n*20?'signal-on':''}/>)}</div><b>{m.signal||'—'}%</b></div><div className="meter-card-foot"><span><i className={m.status==='Online'?'live-dot':'muted-dot'}/>{m.status==='Online'?'Synced just now':m.status==='Offline'?'Last seen 2h ago':'Install scheduled'}</span><ArrowUpRight size={15}/></div><div className={`meter-card-glow meter-glow-${i%4}`}/></div>)}<button className="add-meter-card" onClick={add}><span><Plus size={19}/></span><b>Add a meter</b><small>Connect a smart meter to your network</small></button></div><div className="panel table-panel meter-table-panel"><PageToolbar><h3>All connected meters</h3><SearchControl value={q} onChange={setQ} placeholder="Search serial, consumer or zone"/><SelectControl value={filter} onChange={setFilter} options={['All statuses','Online','Offline','Installing']}/></PageToolbar><DataTable headers={['METER SERIAL','ASSIGNED CONSUMER','ZONE','LATEST READING','SIGNAL','STATUS','']} >{visible.map(m=><tr key={m.id}><td className="mono-cell">{m.serial}</td><td>{m.consumer}</td><td>{m.zone}</td><td className="usage-cell">{m.reading.toLocaleString()} <small>kWh</small></td><td><span className="signal-inline">{m.signal}%</span></td><td><StatusPill status={m.status}/></td><td><button className="plain-icon" onClick={()=>edit(m.id)} aria-label="Meter details"><ArrowUpRight size={15}/></button></td></tr>)}</DataTable></div></div>
}

function BillsPage({rows,generate,markPaid,exportData}:{rows:Bill[];generate:()=>void;markPaid:(bill:Bill)=>void;exportData:()=>void}){
 const [q,setQ]=useState(''),[filter,setFilter]=useState('All statuses')
 const visible=rows.filter(b=>`${b.id} ${b.consumer} ${b.account}`.toLowerCase().includes(q.toLowerCase())&&(filter==='All statuses'||b.status===filter))
 const total=rows.reduce((a,b)=>a+b.amount,0),due=rows.filter(b=>b.status!=='Paid').reduce((a,b)=>a+b.amount,0),paidAmount=rows.filter(b=>b.status==='Paid').reduce((a,b)=>a+b.amount,0),collectionRate=rows.length?Math.round(100*rows.filter(b=>b.status==='Paid').length/rows.length):0
 return <div className="entity-page"><SectionHeading eyebrow="REVENUE & PAYMENTS" title="Billing" subtitle="Generate accurate bills, track payment status, and keep revenue moving." action={<button className="button-primary" onClick={generate}><Plus size={16}/> Generate bills</button>}/><div className="billing-hero"><div className="billing-hero-glow"/><div className="billing-hero-left"><span className="billing-icon"><Wallet size={19}/></span><span className="billing-label">{new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'}).toUpperCase()} · BILLING CYCLE</span><h2>{money(total)}</h2><span className="billing-subtitle">Total billing across all active accounts</span></div><div className="billing-hero-metrics"><div><small>Collected so far</small><b>{money(paidAmount)}</b><span className="collection-progress"><i style={{width:`${collectionRate}%`}}/></span><span className="progress-caption">Collection rate from recorded bills</span></div><div><small>Outstanding balance</small><b>{money(due)}</b><span className="billing-alert"><i/> {rows.filter(b=>b.status==='Pending'||b.status==='Overdue').length} payments need attention</span></div></div><div className="billing-hero-ring"><span>{collectionRate}%<small>COLLECTED</small></span></div></div><div className="entity-summary-strip"><div><span className="summary-icon blue"><FileText size={17}/></span><span><small>Bills generated</small><b>{rows.length}</b></span></div><div><span className="summary-icon green"><Check size={17}/></span><span><small>Paid</small><b>{rows.filter(x=>x.status==='Paid').length}</b></span></div><div><span className="summary-icon amber"><Clock3 size={17}/></span><span><small>Pending</small><b>{rows.filter(x=>x.status==='Pending').length}</b></span></div><div><span className="summary-icon red"><CircleAlert size={17}/></span><span><small>Overdue</small><b>{rows.filter(x=>x.status==='Overdue').length}</b></span></div></div><div className="panel table-panel"><PageToolbar><SearchControl value={q} onChange={setQ} placeholder="Search bills or customer"/><SelectControl value={filter} onChange={setFilter} options={['All statuses','Paid','Pending','Overdue']}/><button className="button-outline" onClick={exportData}><Download size={15}/> Export</button></PageToolbar><DataTable headers={['INVOICE','CONSUMER','BILLING PERIOD','USAGE','AMOUNT','DUE DATE','STATUS']} >{visible.map(b=><tr key={b.id}><td className="mono-cell">{b.id}</td><td><span className="table-consumer-name">{b.consumer}<small>{b.account}</small></span></td><td>{b.period}</td><td>{b.usage.toLocaleString()} kWh</td><td className="usage-cell">{money(b.amount)}</td><td>{b.due}</td><td><StatusPill status={b.status}/>{b.status!=='Paid'&&<button className="button-outline" onClick={()=>markPaid(b)}>Record payment</button>}</td></tr>)}</DataTable><div className="table-footer"><span>Showing <b>{visible.length}</b> of <b>{rows.length}</b> invoices</span><div className="pagination"><button disabled><ChevronLeft size={15}/></button><button className="page-active">1</button><button>2</button><button>3</button><button><ChevronRight size={15}/></button></div></div></div></div>
}

function TechniciansPage({rows,records,consumers,meters,add,schedule,edit}:{rows:Technician[];records:ServiceRecord[];consumers:Consumer[];meters:Meter[];add:()=>void;schedule:()=>void;edit:(id:string)=>void}){
 const [q,setQ]=useState(''),[filter,setFilter]=useState('All statuses')
 const visible=rows.filter(t=>`${t.name} ${t.zone}`.toLowerCase().includes(q.toLowerCase())&&(filter==='All statuses'||t.status===filter))
 return <div className="entity-page"><SectionHeading eyebrow="FIELD OPERATIONS" title="Technicians" subtitle="Coordinate your field team, assign zones, and track service work." action={<div className="title-actions"><button className="button-outline" onClick={schedule} disabled={!rows.length||!consumers.length||!meters.length}><Plus size={16}/> Schedule service</button><button className="button-primary" onClick={add}><Plus size={16}/> Add technician</button></div>}/><div className="field-hero"><div><span className="field-hero-icon"><Wrench size={19}/></span><span className="field-hero-label">FIELD TEAM STATUS</span><h2>Your people. <em>In motion.</em></h2><p>Live visibility into the crews keeping your network running.</p></div><div className="field-metric"><b>{rows.length}</b><span>ACTIVE TECHNICIANS</span><i/> Across {new Set(rows.map(x=>x.zone).filter(Boolean)).size} service zones</div><div className="field-route"><span/><span/><span/><span/><span/></div></div><div className="entity-summary-strip"><div><span className="summary-icon green"><Check size={17}/></span><span><small>Available</small><b>{rows.filter(x=>x.status==='Available').length}</b></span></div><div><span className="summary-icon blue"><Wrench size={17}/></span><span><small>On site</small><b>{rows.filter(x=>x.status==='On site').length}</b></span></div><div><span className="summary-icon gray"><Clock3 size={17}/></span><span><small>Off duty</small><b>{rows.filter(x=>x.status==='Off duty').length}</b></span></div><div><span className="summary-icon violet"><ClipboardList size={17}/></span><span><small>Jobs</small><b>{rows.reduce((n,x)=>n+x.jobs,0)}</b></span></div></div><PageToolbar><SearchControl value={q} onChange={setQ} placeholder="Find a technician"/><SelectControl value={filter} onChange={setFilter} options={['All statuses','Available','On site','Off duty']}/><span className="toolbar-spacer"/><button className="button-outline" onClick={()=>rows[0]&&edit(rows[0].id)} disabled={!rows.length}> <MapPin size={15}/> Manage zones</button></PageToolbar><div className="technician-grid">{visible.map(t=><div className="technician-card panel" key={t.id}><div className="technician-card-head"><div className={`avatar avatar-${t.id.charCodeAt(2)%5}`}>{t.initials}</div><button className="plain-icon" aria-label="Technician options" onClick={()=>edit(t.id)}><MoreHorizontal size={18}/></button></div><h3>{t.name}</h3><p><MapPin size={13}/>{t.zone} service zone</p><div className="technician-card-meta"><span><ClipboardList size={14}/><b>{t.jobs}</b> jobs today</span><StatusPill status={t.status}/></div><button className="technician-view" onClick={()=>edit(t.id)}>View profile <ArrowUpRight size={14}/></button><div className="technician-accent"/></div>)}<button className="technician-add-card" onClick={add}><Plus size={20}/><b>Add a technician</b><span>Bring another member to your team</span></button></div><div className="panel service-panel"><div className="panel-head"><div><h3>Recent service activity</h3><p>Latest field updates across your zones</p></div></div>{records.length?records.map((r,i)=><div className="service-row" key={r.id}><div className={`avatar avatar-${i%5}`}>{r.technician.split(" ").map(x=>x[0]).join("").slice(0,2)}</div><span className="service-detail"><b>{r.summary}</b><small>{r.technician} · {r.consumer} · {r.meter}</small></span><span className="service-time">{r.scheduledAt}</span><StatusPill status={r.status}/></div>):<p className="empty-state">No service records have been created yet.</p>}</div></div>
}

function ReportsPage({consumers,bills,meters,analytics,exportData}:{consumers:Consumer[];bills:Bill[];meters:Meter[];analytics:Analytics;exportData:()=>void}){
 const [period,setPeriod]=useState('This year'),[kind,setKind]=useState('Energy usage'),[q,setQ]=useState('')
 const consumptionData=analytics.monthly_energy.map(x=>({month:x.month,usage:x.usage_kwh/1000}))
 const rows=consumers.filter(c=>`${c.name} ${c.zone} ${c.plan}`.toLowerCase().includes(q.toLowerCase()))
 return <div className="entity-page"><SectionHeading eyebrow="INSIGHTS & ANALYTICS" title="Reports" subtitle="Turn your operational data into a clearer view of what comes next." action={<button className="button-primary" onClick={exportData}><Download size={15}/> Export report</button>}/><div className="report-filters"><div className="report-filter-label"><SlidersHorizontal size={16}/><b>Report filters</b></div><label><small>DATE RANGE</small><SelectControl value={period} onChange={setPeriod} options={['This year','Last 12 months','This quarter','Last 30 days']}/></label><label><small>REPORT TYPE</small><SelectControl value={kind} onChange={setKind} options={['Energy usage','Collection summary','Consumer growth']}/></label><label><small>COMPARE WITH</small><SelectControl value="Previous period" onChange={()=>{}} options={['Previous period','Last year','No comparison']}/></label><button className="button-outline" onClick={()=>setQ('')}>Reset filters</button></div><div className="report-kpis">{[{name:'Energy consumed',value:`${(bills.reduce((n,b)=>n+b.usage,0)/1000).toFixed(2)} MWh`,delta:'',icon:Zap,color:'blue'},{name:'Revenue collected',value:money(bills.filter(b=>b.status==='Paid').reduce((a,b)=>a+b.amount,0)),delta:'',icon:CircleDollarSign,color:'green'},{name:'Collection rate',value:`${bills.length?Math.round(100*bills.filter(b=>b.status==='Paid').length/bills.length):0}%`,delta:'',icon:Wallet,color:'cyan'},{name:'Active consumers',value:consumers.length.toLocaleString(),delta:'',icon:Users,color:'violet'}].map(x=><div className="report-kpi panel" key={x.name}><span className={`report-kpi-icon ${x.color}`}><x.icon size={17}/></span><small>{x.name}</small><b>{x.value}</b><span className="stat-delta">↗ {x.delta} <i>vs previous period</i></span></div>)}</div><div className="report-chart-grid"><div className="panel report-chart-panel"><div className="panel-head"><div><h3>{kind} overview</h3><p>Monthly trend · {period}</p></div><button className="plain-icon"><MoreHorizontal size={17}/></button></div><div className="report-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={consumptionData} margin={{top:10,right:8,bottom:0,left:-15}}><defs><linearGradient id="reportFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#35b4d6" stopOpacity={.18}/><stop offset="100%" stopColor="#35b4d6" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#eef0f5" strokeDasharray="3 4" vertical={false}/><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill:'#9298a8',fontSize:11}} dy={8}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#9298a8',fontSize:11}}/><Tooltip/><Area dataKey="usage" type="monotone" stroke="#35b4d6" fill="url(#reportFill)" strokeWidth={2.5}/></AreaChart></ResponsiveContainer></div></div><div className="panel report-breakdown"><div className="panel-head"><div><h3>Network breakdown</h3><p>Current system snapshot</p></div></div><div className="breakdown-list"><div><span className="breakdown-dot blue"/><span>Consumers</span><b>{consumers.length}</b></div><div><span className="breakdown-dot cyan"/><span>Online meters</span><b>{meters.filter(m=>m.status==='Online').length}</b></div><div><span className="breakdown-dot green"/><span>Paid bills</span><b>{bills.filter(b=>b.status==='Paid').length}</b></div></div><div className="breakdown-footer"><span><i className="live-dot"/> LIVE DATA FEED</span><span>UPDATED JUST NOW</span></div></div></div><div className="panel table-panel report-table"><PageToolbar><h3>Consumer usage detail</h3><SearchControl value={q} onChange={setQ} placeholder="Search in this report"/><button className="button-outline" onClick={exportData}><Download size={14}/> CSV</button></PageToolbar><DataTable headers={['CONSUMER','ZONE','TARIFF','USAGE','ACCOUNT STATUS']}>{rows.slice(0,6).map(c=><tr key={c.id}><td>{c.name}</td><td>{c.zone}</td><td>{c.plan}</td><td>{c.usage} kWh</td><td><StatusPill status={c.status}/></td></tr>)}</DataTable></div></div>
}

function SettingsPage({demoMode,tariffs,zones,me,refresh,notify}:{demoMode:boolean;tariffs:Tariff[];zones:Zone[];me:Profile|null;refresh:()=>Promise<void>;notify:(m:string,k?:'success'|'error')=>void}){
 const [tab,setTab]=useState('Organization')
 const tabs=['Organization','Tariffs','Zones','Users','Profile','Notifications','Integrations','Security']
 const icons=[Building2,Zap,MapPin,UserRound,UserRound,Bell,Layers3,Shield]
 return <div className="entity-page"><SectionHeading eyebrow="PREFERENCES" title="Settings" subtitle="Manage your organization, account, and connected services."/><div className="settings-layout"><nav className="settings-nav">{tabs.map((x,i)=>{const I=icons[i];return <button key={x} className={tab===x?'settings-active':''} onClick={()=>setTab(x)}><I size={17}/>{x}<ChevronRight size={15}/></button>})}</nav><div className="panel settings-panel"><div className="settings-panel-head"><div><h2>{tab} settings</h2><p>Update how your GridFlow workspace is configured.</p></div><Pill tone={demoMode?'amber':'green'} dot>{demoMode?'DEMO MODE':'CONNECTED'}</Pill></div>
  {tab==='Tariffs'?<TariffSettings rows={tariffs} refresh={refresh} notify={notify}/>:
   tab==='Zones'?<ZoneSettings rows={zones} refresh={refresh} notify={notify}/>:
   tab==='Users'?<UserSettings meId={me?.id||''} canManage={isSuperAdmin(me?.role)} notify={notify}/>:
   tab==='Organization'?<><label className="settings-field"><span>Organization name</span><input value="GridFlow" readOnly/></label><label className="settings-field"><span>Primary service region</span><input value="Manage regions under Zones" readOnly/></label><label className="settings-field"><span>Support email</span><input value="" placeholder="Not configured" readOnly/></label><div className="settings-divider"/><div className="integration-row"><span className="integration-logo"><Zap size={17}/></span><span><b>Supabase Auth</b><small>{demoMode?'Demo records are saved in this browser.':'Authentication and records use your Supabase project.'}</small></span><Pill tone={demoMode?'amber':'green'} dot>{demoMode?'NOT CONFIGURED':'CONNECTED'}</Pill></div><div className="settings-help">For sign-in, add your Supabase project URL and anon key in <code>.env.local</code>. Apply the included SQL schema in Supabase before using the live workspace.</div></>:
   <><div className="settings-placeholder"><span className="settings-placeholder-icon">{tab==='Profile'?<UserRound/>:tab==='Notifications'?<Bell/>:tab==='Integrations'?<Layers3/>:<Shield/>}</span><b>{tab} preferences</b><p>{tab} preferences are not connected to the database yet.</p><label className="toggle-setting"><span>Email updates for important events</span><input type="checkbox" defaultChecked/><i/></label><label className="toggle-setting"><span>Weekly operations summary</span><input type="checkbox" defaultChecked/><i/></label></div></>}</div></div></div>
}

function TariffSettings({rows,refresh,notify}:{rows:Tariff[];refresh:()=>Promise<void>;notify:(m:string,k?:'success'|'error')=>void}){
 const [id,setId]=useState(''),[name,setName]=useState(''),[category,setCategory]=useState('residential'),[rate,setRate]=useState(''),[fixed,setFixed]=useState('0'),[error,setError]=useState('')
 const reset=()=>{setId('');setName('');setCategory('residential');setRate('');setFixed('0');setError('')}
 const submit=async(e:React.FormEvent)=>{e.preventDefault();try{await api.saveTariff({name:name.trim(),category,rate_per_kwh:Number(rate),fixed_charge:Number(fixed),is_active:true},id||undefined);await refresh();notify(id?'Tariff updated.':'Tariff created.');reset()}catch(err){setError(err instanceof Error?err.message:'Tariff could not be saved.')}}
 const edit=(row:Tariff)=>{setId(row.id);setName(row.name);setCategory(row.category);setRate(String(row.rate_per_kwh));setFixed(String(row.fixed_charge))}
 const remove=async(row:Tariff)=>{try{await api.deleteTariff(row.id);await refresh();notify('Tariff deleted.');if(id===row.id)reset()}catch(err){notify(err instanceof Error?err.message:'Tariff could not be deleted.','error')}}
 return <div className="settings-placeholder"><b>Electricity tariffs</b><p>Create one active tariff for each consumer category before assigning consumers. Bill calculations use the tariff rate and fixed charge in INR.</p><form className="entity-form" onSubmit={submit}><label>Tariff name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Residential standard"/></label><div className="form-two"><label>Category<SelectControl value={category} onChange={setCategory} options={['residential','business','commercial']}/></label><label>Rate per kWh (₹)<input required min="0" step="0.0001" type="number" value={rate} onChange={e=>setRate(e.target.value)}/></label></div><label>Monthly fixed charge (₹)<input required min="0" step="0.01" type="number" value={fixed} onChange={e=>setFixed(e.target.value)}/></label>{error&&<div className="form-error"><CircleAlert size={14}/>{error}</div>}<div className="modal-actions">{id&&<button type="button" className="button-outline" onClick={reset}>Cancel edit</button>}<button className="button-primary">{id?'Save tariff':'Add tariff'}</button></div></form><div className="breakdown-list">{rows.map(row=><div key={row.id}><span className="breakdown-dot blue"/><span>{row.name} · {titleCase(row.category)}</span><b>₹{Number(row.rate_per_kwh).toFixed(4)}/kWh</b><button className="plain-icon" onClick={()=>edit(row)}>Edit</button><button className="plain-icon" onClick={()=>void remove(row)}>Delete</button></div>)}</div>{rows.length===0&&<p>No tariffs yet. Add a tariff for residential, business, or commercial consumers.</p>}</div>
}
function titleCase(value:string){return value.charAt(0).toUpperCase()+value.slice(1)}

function EntityModal({modal,close,zones,consumers,meters,bills,technicians,refresh,notify}:{modal:Modal;close:()=>void;zones:Zone[];consumers:Consumer[];meters:Meter[];bills:Bill[];technicians:Technician[];refresh:()=>Promise<void>;notify:(m:string,k?:'success'|'error')=>void}){
 const current=modal.id?consumers.find(x=>x.id===modal.id):undefined,currentMeter=modal.id?meters.find(x=>x.id===modal.id):undefined,currentTechnician=modal.id?technicians.find(x=>x.id===modal.id):undefined,isEdit=!!modal.id
 const [name,setName]=useState(current?.name||currentTechnician?.name||''),[account,setAccount]=useState(current?.account||`GF-${Math.floor(2000 + Math.random() * 8000)}`),[address,setAddress]=useState(current?.address||''),[zone,setZone]=useState(current?.zone||currentTechnician?.zone||(zones[0]?.name||'North End')),[plan,setPlan]=useState(current?.plan||'Residential'),[email,setEmail]=useState(current?.email||''),[phone,setPhone]=useState(current?.phone||''),[status,setStatus]=useState<string>(current?.status||'Active'),[meterSerial,setMeterSerial]=useState(currentMeter?.serial||`MT-${Math.floor(10000 + Math.random() * 90000)}`),[consumerId,setConsumerId]=useState(currentMeter?.consumerId||consumers[0]?.id||''),[readingMeter,setReadingMeter]=useState(meters[0]?.id||''),[reading,setReading]=useState(''),[readingDate,setReadingDate]=useState(new Date().toISOString().slice(0,16)),[serviceTech,setServiceTech]=useState(technicians[0]?.id||''),[serviceConsumer,setServiceConsumer]=useState(consumers[0]?.id||''),[serviceMeter,setServiceMeter]=useState(meters[0]?.id||''),[serviceSummary,setServiceSummary]=useState(''),[servicePriority,setServicePriority]=useState('normal'),[serviceDate,setServiceDate]=useState(new Date().toISOString().slice(0,16)),[error,setError]=useState(''),[saving,setSaving]=useState(false),[blockers,setBlockers]=useState<string[]>([])
 const zoneOptions=zones.length?zones.map(z=>z.name):['North End','Riverside','Midtown','Eastside']

 useEffect(()=>{
   if(modal.type==='delete'&&current?.id){
     api.consumerBlockers(current.id).then(setBlockers).catch(()=>setBlockers([]))
   }
 },[modal.type,current?.id])

 const cycleLabel=new Intl.DateTimeFormat('en-IN',{month:'long',year:'numeric'}).format(new Date()),dueLabel=new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'long',year:'numeric'}).format(new Date(new Date().getFullYear(),new Date().getMonth()+1,14))
 const title=modal.type==='consumer'?(isEdit?'Edit consumer':'Add consumer'):modal.type==='meter'?(isEdit?'Meter details':'Register meter'):modal.type==='reading'?'Record meter reading':modal.type==='service'?'Schedule service':modal.type==='technician'?(isEdit?'Technician profile':'Add technician'):modal.type==='bill'?'Generate bills':modal.type==='delete'?'Delete consumer':'Consumer details'

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    setError('');
    setSaving(true);
    try{
      if(modal.type==='consumer'){
        if(!name.trim()) throw new Error('Full name is required.');
        const cleanAccount = account.trim().toUpperCase() || `GF-${Math.floor(2000 + Math.random() * 8000)}`;
        const cleanAddress = address.trim() || `${zone || 'North End'}, Sector 4`;
        await api.consumer({name:name.trim(),account:cleanAccount,address:cleanAddress,zone,plan,status:status as Consumer['status'],email:email.trim()||undefined,phone:phone.trim()||undefined},current?.id);
        notify(isEdit?'Consumer updated successfully.':'Consumer created successfully.')
      }else if(modal.type==='meter'){
        const cleanSerial = meterSerial.trim() || `MT-${Math.floor(10000 + Math.random() * 90000)}`;
        const effectiveConsumerId = consumerId || currentMeter?.consumerId || consumers[0]?.id;
        if(!effectiveConsumerId) throw new Error('Please create an active consumer before registering a meter.');
        await api.meter(cleanSerial,effectiveConsumerId,currentMeter?.id);
        notify(isEdit?'Meter updated.':'Meter registered.')
      }else if(modal.type==='reading'){
        const effectiveMeterId = readingMeter || meters[0]?.id;
        if(!effectiveMeterId||reading===''||Number(reading)<0) throw new Error('Choose a meter and enter a valid non-negative reading.');
        await api.recordMeterReading(effectiveMeterId,Number(reading),new Date(readingDate).toISOString());
        notify('Meter reading recorded.')
      }else if(modal.type==='service'){
        const effectiveTech = serviceTech || technicians[0]?.id;
        const effectiveConsumer = serviceConsumer || consumers[0]?.id;
        const effectiveMeter = serviceMeter || meters[0]?.id;
        if(!effectiveTech||!effectiveConsumer||!effectiveMeter||!serviceSummary.trim()) throw new Error('Choose a technician, consumer, meter, and describe the work.');
        await api.serviceRecord({technicianId:effectiveTech,consumerId:effectiveConsumer,meterId:effectiveMeter,summary:serviceSummary.trim(),priority:servicePriority,scheduledFor:new Date(serviceDate).toISOString()});
        notify('Service visit scheduled.')
      }else if(modal.type==='technician'){
        if(!name.trim()) throw new Error('Technician name is required.');
        await api.technician(name.trim(),zone,email.trim(),phone.trim(),currentTechnician?.id);
        notify(isEdit?'Technician updated.':'Technician added to the field team.')
      }else if(modal.type==='bill'){
        const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),1),end=new Date(now.getFullYear(),now.getMonth()+1,0),due=new Date(now.getFullYear(),now.getMonth()+1,14),iso=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const count=await api.generateBills(iso(start),iso(end),iso(due));
        if(!count) throw new Error('No active consumers with meter readings were found for this period.');
        notify(`${count} bills generated from recorded meter readings.`)
      }
      await refresh();
      close()
    }catch(err){
      setError(err instanceof Error?err.message:'The change could not be saved.')
    }finally{
      setSaving(false)
    }
  }
 const del=async()=>{try{if(modal.id){if(modal.type==='delete'){if(blockers.length>0)throw new Error(`Cannot delete consumer with historical records (${blockers.join(', ')}). Deactivate the consumer instead.`);await api.deleteConsumer(modal.id)}if(modal.type==='meter')await api.deleteMeter(modal.id);if(modal.type==='technician')await api.deleteTechnician(modal.id)}await refresh();notify('Record deleted.');close()}catch(err){setError(err instanceof Error?err.message:'The record could not be deleted.')}}
 const deactivate=async()=>{if(!current?.id)return;setSaving(true);try{await api.setConsumerStatus(current.id,'inactive');await refresh();notify(`${current.name} marked as Inactive.`);close()}catch(err){setError(err instanceof Error?err.message:'Could not deactivate consumer.')}finally{setSaving(false)}}

 return <motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><motion.div className="entity-modal" initial={{opacity:0,y:18,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:12,scale:.98}} role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><span className="modal-eyebrow">GRIDFLOW OPERATIONS</span><h2 id="modal-title">{title}</h2></div><button className="icon-button" onClick={close} aria-label="Close dialog"><X size={18}/></button></div>
 {modal.type==='delete'?<div className="delete-content"><span className="delete-alert">{blockers.length?<CircleAlert size={21}/>:<Trash2 size={21}/>}</span>{blockers.length?<><p><b>{current?.name}</b> cannot be deleted because historical records exist ({blockers.join(', ')}). In accordance with utility integrity standards, deactivate this account instead to preserve audit history.</p>{error&&<div className="form-error"><CircleAlert size={14}/>{error}</div>}<div className="modal-actions"><button className="button-outline" onClick={close}>Cancel</button><button className="button-primary" onClick={deactivate} disabled={saving}>Deactivate consumer</button></div></>:<><p>Delete <b>{current?.name}</b> and permanently remove this database record? This action cannot be undone.</p>{error&&<div className="form-error"><CircleAlert size={14}/>{error}</div>}<div className="modal-actions"><button className="button-outline" onClick={close}>Cancel</button><button className="button-danger" onClick={del} disabled={saving}><Trash2 size={15}/> Delete consumer</button></div></>}</div>:modal.type==='details'?<div className="consumer-details"><div className="details-avatar">{current?.name.split(' ').map(x=>x[0]).join('')}</div><h3>{current?.name}</h3><Pill tone={current?.status==='Active'?'green':'gray'} dot>{current?.status}</Pill><div className="details-grid"><span>Account ID<b>{current?.account}</b></span><span>Service plan<b>{current?.plan}</b></span><span>Service zone<b>{current?.zone}</b></span><span>Monthly usage<b>{current?.usage} kWh</b></span><span>Address<b>{current?.address}</b></span><span>Meter ID<b>{meters.find(m=>m.consumer===current?.name)?.serial||'Pending assignment'}</b></span></div><div className="modal-actions"><button className="button-outline" onClick={close}>Close</button><button className="button-primary" onClick={()=>{close();notify('Consumer details are up to date.')}}>Done <Check size={15}/></button></div></div>:<form className="entity-form" onSubmit={submit}>
 {modal.type==='consumer'&&<><label>Full name<input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Jordan Lee" autoFocus/></label><div className="form-two"><label>Account ID<input value={account} onChange={e=>setAccount(e.target.value)} placeholder="GF-2049"/></label><label>Plan<SelectControl value={plan} onChange={setPlan} options={['Residential','Business','Commercial']}/></label></div><label>Service address<input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Street address, city"/></label><div className="form-two"><label>Service zone<SelectControl value={zone} onChange={setZone} options={zoneOptions}/></label><label>Status<SelectControl value={status} onChange={setStatus} options={['Active','Inactive']}/></label></div><div className="form-two"><label>Email (optional)<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></label><label>Phone (optional)<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+91 98765 43210"/></label></div></>}
 {modal.type==='meter'&&<><label>Meter serial number<input value={meterSerial} onChange={e=>setMeterSerial(e.target.value)} placeholder="MT-88422" autoFocus/></label><label>Assign to consumer<SelectControl value={consumerId} onChange={setConsumerId} options={consumers.map(c=>({value:c.id,label:`${c.name} (${c.account})`}))}/></label><label>Service zone<SelectControl value={zone} onChange={setZone} options={zoneOptions}/></label><div className="modal-note"><Wifi size={15}/> The meter will be saved to the GridFlow database.</div></>}
 {modal.type==='reading'&&<><label>Meter<SelectControl value={readingMeter} onChange={setReadingMeter} options={meters.map(m=>({value:m.id,label:`${m.serial} · ${m.consumer}`}))}/></label><label>Reading (kWh)<input required min="0" step="0.001" type="number" value={reading} onChange={e=>setReading(e.target.value)} placeholder="Cumulative meter reading" autoFocus/></label><label>Recorded at<input required type="datetime-local" value={readingDate} onChange={e=>setReadingDate(e.target.value)}/></label><div className="modal-note"><Gauge size={15}/> Enter the cumulative meter value shown by the meter.</div></>}{modal.type==='service'&&<><label>Technician<SelectControl value={serviceTech} onChange={setServiceTech} options={technicians.map(x=>({value:x.id,label:x.name}))}/></label><label>Consumer<SelectControl value={serviceConsumer} onChange={setServiceConsumer} options={consumers.map(x=>({value:x.id,label:x.name}))}/></label><label>Meter<SelectControl value={serviceMeter} onChange={setServiceMeter} options={meters.map(x=>({value:x.id,label:x.serial}))}/></label><label>Work summary<input required value={serviceSummary} onChange={e=>setServiceSummary(e.target.value)} placeholder="Describe the service visit" autoFocus/></label><div className="form-two"><label>Priority<SelectControl value={servicePriority} onChange={setServicePriority} options={['low','normal','high','critical']}/></label><label>Scheduled for<input type="datetime-local" required value={serviceDate} onChange={e=>setServiceDate(e.target.value)}/></label></div></>}{modal.type==='technician'&&<><label>Full name<input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Taylor Morgan" autoFocus/></label><label>Service zone<SelectControl value={zone} onChange={setZone} options={zoneOptions}/></label><label>Work email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com"/></label><label>Phone<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+91 98765 43210"/></label></>}
 {modal.type==='bill'&&<><div className="bill-generate-summary"><span className="summary-icon blue"><FileText size={18}/></span><b>Generate {cycleLabel} bills</b><span>{consumers.length} consumers</span></div><div className="bill-generate-options"><label><span>Billing period</span><b>{cycleLabel}</b></label><label><span>Due date</span><b>{dueLabel}</b></label><label><span>Calculation</span><b>Usage × current tariff</b></label></div><p className="modal-note">Bills use stored readings and the active tariff assigned to each consumer. Consumers without readings are skipped.</p></>}
 {error&&<div className="form-error"><CircleAlert size={14}/>{error}</div>}<div className="modal-actions"><button type="button" className="button-outline" onClick={close}>Cancel</button><button className="button-primary" disabled={saving}>{modal.type==='bill'?<><Zap size={15}/> Generate bills</>:modal.type==='reading'?'Record reading':modal.type==='service'?'Schedule visit':isEdit?'Save changes':modal.type==='consumer'?'Create consumer':modal.type==='meter'?'Register meter':'Add technician'}{modal.type!=='bill'&&<ArrowRight size={15}/>}</button></div></form>}</motion.div></motion.div>
}
function exportRows(rows:unknown[],filename:string){const list=rows as Record<string,unknown>[],keys=Object.keys(list[0]||{}),quote=(v:unknown)=>`"${String(v??'').replaceAll('"','""')}"`,csv=[keys.join(','),...list.map(r=>keys.map(k=>quote(r[k])).join(','))].join('\r\n'),blob=new Blob([csv],{type:'text/csv'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url)}

function ConsumerPortal({
  consumer,
  meters,
  bills,
  serviceRecords,
  tariffs,
  refresh,
  notify,
  onSignOut
}: {
  consumer: Consumer;
  meters: Meter[];
  bills: Bill[];
  serviceRecords: ServiceRecord[];
  tariffs: Tariff[];
  refresh: () => Promise<void>;
  notify: (msg: string, kind?: 'success' | 'error') => void;
  onSignOut: () => void;
}) {
  type ConsumerTab = 'Overview' | 'My Bills' | 'My Meter' | 'Support'
  const [tab, setTab] = useState<ConsumerTab>('Overview')
  const [billFilter, setBillFilter] = useState('All statuses')
  const [paying, setPaying] = useState(false)

  const myBills = bills.filter(b => b.consumer === consumer.name || b.account === consumer.account)
  const myMeter = meters.find(m => m.consumer === consumer.name || m.consumerId === consumer.id)
  const myRecords = serviceRecords.filter(s => s.consumer === consumer.name)
  const unpaidBills = myBills.filter(b => b.status !== 'Paid')
  const totalDue = unpaidBills.reduce((a, b) => a + b.amount, 0)
  const myTariff = tariffs.find(t => t.name.toLowerCase() === consumer.plan.toLowerCase() || t.category.toLowerCase() === consumer.plan.toLowerCase())

  const payBill = async (bill: Bill) => {
    if (!bill.dbId) return
    setPaying(true)
    try {
      await api.markBillPaid(bill.dbId)
      await refresh()
      notify(`Payment of ${money(bill.amount)} for ${bill.id} recorded successfully.`)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Payment could not be processed.', 'error')
    } finally {
      setPaying(false)
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Brand />
        </div>
        <div className="workspace-switcher">
          <span className="workspace-mark">C</span>
          <div className="workspace-copy">
            <b>{consumer.name}</b>
            <small>Account {consumer.account}</small>
          </div>
        </div>

        <div className="side-label">CONSUMER PORTAL</div>
        <nav className="side-nav" aria-label="Consumer navigation">
          <button className={`side-link ${tab === 'Overview' ? 'selected' : ''}`} onClick={() => setTab('Overview')}>
            <LayoutDashboard size={18} />
            <span>Overview</span>
          </button>
          <button className={`side-link ${tab === 'My Bills' ? 'selected' : ''}`} onClick={() => setTab('My Bills')}>
            <FileText size={18} />
            <span>My Bills</span>
            {unpaidBills.length > 0 && <span className="nav-count">{unpaidBills.length}</span>}
          </button>
          <button className={`side-link ${tab === 'My Meter' ? 'selected' : ''}`} onClick={() => setTab('My Meter')}>
            <Gauge size={18} />
            <span>My Smart Meter</span>
          </button>
          <button className={`side-link ${tab === 'Support' ? 'selected' : ''}`} onClick={() => setTab('Support')}>
            <Wrench size={18} />
            <span>Support & Visits</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="sync-card">
            <div className="sync-card-top">
              <span className="sync-orb"><RefreshCw size={14} /></span>
              <b>Smart Meter Synced</b>
              <i className="live-dot" />
            </div>
            <p>Your meter readings and bills are live updated with GridFlow utility network.</p>
            <div className="sync-foot">
              <span>Status</span>
              <b>Active connection</b>
            </div>
          </div>
          <div className="sidebar-user">
            <div className="avatar avatar-user">{consumer.name.slice(0, 2).toUpperCase()}</div>
            <div className="sidebar-user-copy">
              <b>{consumer.name}</b>
              <small>{consumer.account}</small>
            </div>
            <button className="user-more" onClick={onSignOut} aria-label="Sign out" title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <div className="breadcrumbs">
              <span>Consumer Portal</span>
              <ChevronRight size={14} />
              <b>{tab}</b>
            </div>
          </div>
          <div className="topbar-actions">
            <span className="consumer-badge"><Check size={13} /> {consumer.account} · {consumer.plan}</span>
            <button className="button-outline" onClick={onSignOut}><LogOut size={14} /> Sign out</button>
          </div>
        </header>

        <div className="page-content">
          {tab === 'Overview' && (
            <div className="entity-page">
              <div className="consumer-hero">
                <div>
                  <span className="eyebrow" style={{ color: '#9edbff' }}>ACCOUNT SUMMARY</span>
                  <h2>Welcome, {consumer.name}</h2>
                  <p>Service Address: {consumer.address} · Zone: {consumer.zone}</p>
                </div>
                {totalDue > 0 ? (
                  <div className="consumer-quick-pay">
                    <div>
                      <small style={{ color: '#ffb3b8', fontSize: 11 }}>TOTAL DUE NOW</small>
                      <div><b>{money(totalDue)}</b></div>
                    </div>
                    <button className="button-primary" onClick={() => unpaidBills[0] && payBill(unpaidBills[0])} disabled={paying}>
                      <CreditCard size={15} /> Pay now
                    </button>
                  </div>
                ) : (
                  <div className="consumer-quick-pay">
                    <span style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                      <CheckCircle2 size={18} /> No outstanding dues
                    </span>
                  </div>
                )}
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-card-top">
                    <span>Recorded Usage</span>
                    <span className="stat-icon blue"><Zap size={18} /></span>
                  </div>
                  <div className="stat-value">{consumer.usage.toLocaleString()} <small>kWh</small></div>
                  <div className="stat-card-bottom"><span>Cumulative connection usage</span></div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-top">
                    <span>Connected Meter</span>
                    <span className="stat-icon cyan"><Gauge size={18} /></span>
                  </div>
                  <div className="stat-value" style={{ fontSize: 18 }}>{myMeter ? myMeter.serial : 'Installed'}</div>
                  <div className="stat-card-bottom"><span className="stat-delta">{myMeter ? myMeter.status : 'Active'}</span></div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-top">
                    <span>Tariff Plan</span>
                    <span className="stat-icon violet"><Leaf size={18} /></span>
                  </div>
                  <div className="stat-value" style={{ fontSize: 20 }}>{consumer.plan}</div>
                  <div className="stat-card-bottom"><span>{myTariff ? `₹${myTariff.rate_per_kwh}/kWh` : 'Standard utility tariff'}</span></div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-top">
                    <span>Account Status</span>
                    <span className="stat-icon green"><Check size={18} /></span>
                  </div>
                  <div className="stat-value" style={{ fontSize: 20 }}>{consumer.status}</div>
                  <div className="stat-card-bottom"><span>Service zone: {consumer.zone}</span></div>
                </div>
              </div>

              <div className="panel table-panel">
                <PageToolbar>
                  <h3>Recent billing statements</h3>
                  <button className="button-outline" onClick={() => setTab('My Bills')}>View all bills <ArrowRight size={14} /></button>
                </PageToolbar>
                <DataTable headers={['BILL NUMBER', 'PERIOD', 'DUE DATE', 'UNITS', 'AMOUNT', 'STATUS', 'ACTION']}>
                  {myBills.slice(0, 5).map(b => (
                    <tr key={b.id}>
                      <td className="mono-cell">{b.id}</td>
                      <td>{b.period}</td>
                      <td>{b.due}</td>
                      <td>{b.usage.toLocaleString()} kWh</td>
                      <td><b>{money(b.amount)}</b></td>
                      <td><StatusPill status={b.status} /></td>
                      <td>
                        {b.status !== 'Paid' ? (
                          <button className="button-primary compact" style={{ height: 30, fontSize: 11 }} onClick={() => payBill(b)} disabled={paying}>
                            Pay now
                          </button>
                        ) : (
                          <span style={{ color: '#22c55e', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Check size={13} /> Paid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </DataTable>
                {myBills.length === 0 && (
                  <div className="empty-state">
                    <FileText size={24} />
                    <b>No bills generated yet</b>
                    <p>Bills will appear automatically once monthly meter readings are synced.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'My Bills' && (
            <div className="entity-page">
              <SectionHeading
                eyebrow="BILLING STATEMENTS"
                title="My Bills"
                subtitle="Review your electricity statements, payment receipts, and download CSV history."
                action={
                  <button className="button-outline" onClick={() => exportRows(myBills, `bills-${consumer.account}.csv`)}>
                    <Download size={14} /> Export CSV
                  </button>
                }
              />
              <div className="panel table-panel">
                <PageToolbar>
                  <h3>All statements</h3>
                  <SelectControl value={billFilter} onChange={setBillFilter} options={['All statuses', 'Paid', 'Pending', 'Overdue']} />
                </PageToolbar>
                <DataTable headers={['BILL NUMBER', 'PERIOD', 'DUE DATE', 'UNITS', 'AMOUNT', 'STATUS', 'ACTION']}>
                  {myBills
                    .filter(b => billFilter === 'All statuses' || b.status === billFilter)
                    .map(b => (
                      <tr key={b.id}>
                        <td className="mono-cell">{b.id}</td>
                        <td>{b.period}</td>
                        <td>{b.due}</td>
                        <td>{b.usage.toLocaleString()} kWh</td>
                        <td><b>{money(b.amount)}</b></td>
                        <td><StatusPill status={b.status} /></td>
                        <td>
                          {b.status !== 'Paid' ? (
                            <button className="button-primary compact" style={{ height: 30, fontSize: 11 }} onClick={() => payBill(b)} disabled={paying}>
                              Pay now
                            </button>
                          ) : (
                            <span style={{ color: '#22c55e', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Check size={13} /> Paid
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                </DataTable>
                {myBills.length === 0 && (
                  <div className="empty-state">
                    <FileText size={24} />
                    <b>No bills on record</b>
                    <p>You currently do not have any bills assigned to this account.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'My Meter' && (
            <div className="entity-page">
              <SectionHeading
                eyebrow="SMART METERING"
                title="My Smart Meter"
                subtitle="Details of the smart meter connected at your service address."
              />
              {myMeter ? (
                <div style={{ maxWidth: 440 }}>
                  <div className="meter-card panel">
                    <div className="meter-card-head">
                      <span className="meter-id-icon"><Gauge size={18} /></span>
                      <StatusPill status={myMeter.status} />
                    </div>
                    <h3>{myMeter.serial}</h3>
                    <p className="meter-customer">{consumer.name} <span>·</span> {consumer.zone}</p>
                    <div className="meter-reading">
                      <span>Latest reading</span>
                      <b>{myMeter.reading.toLocaleString()} <small>kWh</small></b>
                    </div>
                    <div className="meter-signal">
                      <span>Signal strength</span>
                      <div className="signal-bars">
                        {[1, 2, 3, 4, 5].map(n => (
                          <i key={n} className={myMeter.signal >= n * 20 ? 'signal-on' : ''} />
                        ))}
                      </div>
                      <b>{myMeter.signal || '92'}%</b>
                    </div>
                    <div className="meter-card-foot">
                      <span><i className="live-dot" /> Live sync enabled</span>
                      <Wifi size={15} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="panel" style={{ padding: 32, textAlign: 'center', color: '#667085' }}>
                  <Gauge size={32} style={{ marginBottom: 12, color: '#526df1' }} />
                  <h3 style={{ margin: '0 0 6px', color: '#181f32' }}>Meter installation scheduled</h3>
                  <p style={{ margin: 0, fontSize: 13 }}>Your connection is registered. The utility field team will assign and install your digital smart meter shortly.</p>
                </div>
              )}
            </div>
          )}

          {tab === 'Support' && (
            <div className="entity-page">
              <SectionHeading
                eyebrow="FIELD OPERATIONS"
                title="Service & Support"
                subtitle="View technician visits and maintenance history for your connection."
              />
              <div className="panel table-panel">
                <PageToolbar>
                  <h3>Service history</h3>
                </PageToolbar>
                <DataTable headers={['SUMMARY', 'PRIORITY', 'SCHEDULED FOR', 'TECHNICIAN', 'STATUS']}>
                  {myRecords.map((r, i) => (
                    <tr key={i}>
                      <td>{r.summary}</td>
                      <td><Pill tone="blue">{r.priority || 'Normal'}</Pill></td>
                      <td>{r.scheduledAt || 'Scheduled'}</td>
                      <td>{r.technician || 'Assigned field team'}</td>
                      <td><StatusPill status={r.status || 'Completed'} /></td>
                    </tr>
                  ))}
                </DataTable>
                {myRecords.length === 0 && (
                  <div className="empty-state">
                    <Wrench size={24} />
                    <b>No service tickets on record</b>
                    <p>Your connection is operational with zero active maintenance issues.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

