import { useEffect, useMemo, useState } from 'react'
import { Bell, Search, Plus, ArrowUpRight, ArrowDownRight, LayoutDashboard, Users, UserRound, Handshake, MapPin, CalendarDays, ChartNoAxesCombined, Zap, Settings, ChevronDown, MoreHorizontal, ArrowRight, Clock3, Phone, Mail, SlidersHorizontal, Ellipsis, Building2, Check, TrendingUp, Menu, X, Filter, Download, LogOut } from 'lucide-react'
import { ResourceEditor, ResourcePage, type ResourceKind, type ResourceRecord } from './ResourceManager'
import AuthPage, { type AuthUser } from './AuthPage'

type Lead = { id: string; databaseId?: string; name: string; email?: string; phone?: string; project?: string; projectId?: string; source: string; status: string; budget?: number; agent: string; created: string; avatar: string; color: string }
type ApiLead = { id: string; name: string; email?: string | null; phone?: string | null; project?: { name: string } | null; source: string; status: string; budget?: number | null; assignedTo?: { name: string } | null; createdAt: string }
type ResourceRows = Record<ResourceKind, ResourceRecord[]>

const resourceEndpoints: Record<ResourceKind, string> = { leads: 'leads', users: 'users', partners: 'partners', projects: 'projects', visits: 'visits', bookings: 'bookings', automations: 'automations' }
const pageResources: Record<string, ResourceKind> = { Leads: 'leads', 'Sales team': 'users', 'Channel partners': 'partners', Projects: 'projects', Inventory: 'projects', 'Site visits': 'visits', Bookings: 'bookings', Automations: 'automations' }
const emptyResources: ResourceRows = { leads: [], users: [], partners: [], projects: [], visits: [], bookings: [], automations: [] }

const initialLeads: Lead[] = [
  { id: 'EF-2841', name: 'Ananya Sharma', email: 'ananya.s@email.com', phone: '+91 98765 42101', project: 'The Willow Residences', source: 'Instagram', status: 'Qualified', budget: 14500000, agent: 'Rohan Mehta', created: '2 min ago', avatar: 'AS', color: 'rose' },
  { id: 'EF-2840', name: 'Arjun Kapoor', email: 'arjun.k@email.com', phone: '+91 87654 32109', project: 'Parkview Heights', source: 'Referral', status: 'Site visit', budget: 9200000, agent: 'Priya Nair', created: '18 min ago', avatar: 'AK', color: 'blue' },
  { id: 'EF-2839', name: 'Meera Iyer', email: 'meera.iyer@email.com', phone: '+91 76543 21098', project: 'The Willow Residences', source: '99acres', status: 'Contacted', budget: 18500000, agent: 'Kabir Sethi', created: '1 hr ago', avatar: 'MI', color: 'purple' },
  { id: 'EF-2838', name: 'Vikram Patel', email: 'vikram.p@email.com', phone: '+91 65432 10987', project: 'Olive Garden Villas', source: 'Website', status: 'Negotiation', budget: 23200000, agent: 'Rohan Mehta', created: '2 hrs ago', avatar: 'VP', color: 'amber' },
  { id: 'EF-2837', name: 'Riya Desai', email: 'riya.d@email.com', phone: '+91 98760 54321', project: 'Meridian Business Park', source: 'Channel partner', status: 'New', budget: 31000000, agent: 'Priya Nair', created: '3 hrs ago', avatar: 'RD', color: 'pink' },
  { id: 'EF-2836', name: 'Dev Malhotra', email: 'dev.m@email.com', phone: '+91 87650 12345', project: 'Parkview Heights', source: 'Facebook', status: 'Qualified', budget: 11800000, agent: 'Kabir Sethi', created: '5 hrs ago', avatar: 'DM', color: 'teal' },
]

const navSections = [
  { title: 'WORKSPACE', items: [{ name: 'Marketing & Sales', icon: LayoutDashboard }, { name: 'Leads', icon: Users, count: '24' }, { name: 'Sales team', icon: UserRound }, { name: 'Channel partners', icon: Handshake }] },
  { title: 'OPERATIONS', items: [{ name: 'Inventory', icon: Building2 }, { name: 'Site visits', icon: MapPin, count: '8' }, { name: 'Bookings', icon: CalendarDays }, { name: 'Reports', icon: ChartNoAxesCombined }] },
]
const statusClass: Record<string, string> = { 'New': 's-new', 'Contacted': 's-contacted', 'Qualified': 's-qualified', 'Site visit': 's-visit', 'Negotiation': 's-negotiation', 'Won': 's-won' }
const money = (n?: number) => n == null ? '—' : n >= 10000000 ? `₹${(n / 10000000).toFixed(2).replace(/\.00$/, '')} Cr` : `₹${(n / 100000).toFixed(0)} L`
const short = (s: string) => s.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()

function App() {
  const [page, setPage] = useState(getPageFromPath)
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking')
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [leads, setLeads] = useState(initialLeads)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All leads')
  const [editor, setEditor] = useState<{ kind: ResourceKind; item?: ResourceRecord } | null>(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [notice, setNotice] = useState('')
  const [databaseStatus, setDatabaseStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')
  const [saving, setSaving] = useState(false)
  const [resources, setResources] = useState<ResourceRows>(emptyResources)

  function notify(message: string) { setNotice(message); window.setTimeout(() => setNotice(''), 2600) }
  useEffect(() => {
    let active = true
    fetch('/api/auth/session')
      .then(async response => {
        if (!response.ok) throw new Error('Could not check your sign-in session.')
        return await response.json() as { user: AuthUser | null }
      })
      .then(({ user }) => {
        if (!active) return
        setAuthUser(user)
        setAuthStatus(user ? 'authenticated' : 'unauthenticated')
        if (user && window.location.pathname === '/') {
          window.history.replaceState({}, '', '/leads')
          setPage('Leads')
        }
      })
      .catch(error => {
        console.error('Failed to check sign-in session.', error)
        if (active) {
          setAuthStatus('unauthenticated')
          notify('Unable to verify your session. Please sign in to continue.')
        }
      })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (authStatus !== 'authenticated') return
    let active = true
    async function loadWorkspace() {
      try {
        const [health, ...responses] = await Promise.all([fetch('/api/health'), ...Object.values(resourceEndpoints).map(endpoint => fetch(`/api/${endpoint}`))])
        if (!health.ok) throw new Error('PostgreSQL is unavailable. Start the database and check DATABASE_URL.')
        if (responses.some(response => response.status === 401)) {
          if (active) {
            setAuthUser(null)
            setAuthStatus('unauthenticated')
          }
          return
        }
        if (responses.some(response => !response.ok)) throw new Error('Could not load CRM records from PostgreSQL.')
        const keys = Object.keys(resourceEndpoints) as ResourceKind[]
        const rows = await Promise.all(responses.map(response => response.json() as Promise<ResourceRecord[]>))
        const loaded = Object.fromEntries(keys.map((key, index) => [key, rows[index]])) as ResourceRows
        if (active) {
          setDatabaseStatus('connected')
          setResources(loaded)
          setLeads((loaded.leads as ApiLead[]).map(toLead))
        }
      } catch (error) {
        console.error('Failed to load CRM records from PostgreSQL.', error)
        if (active) {
          setDatabaseStatus('disconnected')
          notify(error instanceof Error ? error.message : 'Could not load CRM records from PostgreSQL.')
        }
      }
    }
    void loadWorkspace()
    return () => { active = false }
  }, [authStatus])
  useEffect(() => {
    const syncPage = () => setPage(getPageFromPath())
    window.addEventListener('popstate', syncPage)
    return () => window.removeEventListener('popstate', syncPage)
  }, [])

  const visibleLeads = useMemo(() => leads.filter(l => `${l.name} ${l.email} ${l.project} ${l.agent} ${l.source}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'All leads' || l.status.toLowerCase() === filter.toLowerCase())), [leads, query, filter])
  const saveResource = async (kind: ResourceKind, id: string | undefined, values: Record<string, unknown>) => {
    setSaving(true)
    try {
      const endpoint = resourceEndpoints[kind]
      const response = await fetch(`/api/${endpoint}${id ? `/${encodeURIComponent(id)}` : ''}`, {
        method: id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const result: unknown = await response.json()
      if (response.status === 401) {
        setAuthUser(null)
        setAuthStatus('unauthenticated')
        return
      }
      if (!response.ok) {
        const message = result && typeof result === 'object' && 'error' in result && typeof result.error === 'string' ? result.error : 'Could not save changes to PostgreSQL.'
        throw new Error(message)
      }
      const keys = Object.keys(resourceEndpoints) as ResourceKind[]
      const responses = await Promise.all(keys.map(async key => {
        const refreshed = await fetch(`/api/${resourceEndpoints[key]}`)
        if (refreshed.status === 401) {
          setAuthUser(null)
          setAuthStatus('unauthenticated')
        }
        if (!refreshed.ok) throw new Error(`Changes were saved, but ${resourceEndpoints[key]} could not be refreshed.`)
        return await refreshed.json() as ResourceRecord[]
      }))
      const loaded = Object.fromEntries(keys.map((key, index) => [key, responses[index]])) as ResourceRows
      setResources(loaded)
      setLeads((loaded.leads as ApiLead[]).map(toLead))
      setDatabaseStatus('connected')
      setEditor(null)
      notify(`${kind === 'leads' ? 'Lead' : kind === 'users' ? 'Team member' : kind === 'partners' ? 'Channel partner' : kind === 'projects' ? 'Project' : kind === 'visits' ? 'Site visit' : kind === 'bookings' ? 'Booking' : 'Automation'} ${id ? 'updated' : 'added'} successfully`)
    } catch (error) {
      console.error(`Failed to save ${kind} record to PostgreSQL.`, error)
      notify(error instanceof Error ? error.message : 'Could not save changes to PostgreSQL.')
    } finally {
      setSaving(false)
    }
  }

  const changePage = (target: string) => {
    const paths: Record<string, string> = { 'Marketing & Sales': '/marketing-sales', Leads: '/leads', Inventory: '/Inventory', Projects: '/Inventory', Reports: '/reports', 'Sales team': '/sales-team', 'Channel partners': '/channel-partners', 'Site visits': '/site-visits', Bookings: '/bookings', Automations: '/automations' }
    window.history.pushState({}, '', paths[target] ?? '/')
    setPage(target)
    setMobileNav(false)
  }
  const onAuthenticated = (user: AuthUser) => {
    setAuthUser(user)
    setAuthStatus('authenticated')
    setPage('Leads')
    window.history.replaceState({}, '', '/leads')
  }
  const logout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) throw new Error('The server could not end your session.')
      setAuthUser(null)
      setAuthStatus('unauthenticated')
      setPage('Leads')
      window.history.replaceState({}, '', '/')
    } catch (error) {
      console.error('Failed to sign out.', error)
      notify(error instanceof Error ? error.message : 'Could not sign out.')
    }
  }
  const editLead = (lead: Lead) => {
    const item = resources.leads.find(row => row.id === lead.databaseId)
    if (item) setEditor({ kind: 'leads', item })
  }
  const activeResource = pageResources[page] ?? 'leads'
  const openAdd = () => setEditor({ kind: activeResource })

  if (authStatus === 'checking') return <div className="auth-loading" role="status">Checking your sign-in…</div>
  if (authStatus === 'unauthenticated') return <AuthPage onAuthenticated={onAuthenticated} />

  return <div className="shell">
    <aside className={`sidebar ${mobileNav ? 'show-mobile' : ''}`}>
      <div className="brand"><div className="brand-mark"><Building2 size={17} strokeWidth={2.4} /></div><span>estate<span className="brand-light">flow</span></span><button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={19} /></button></div>
      <button className="org-switch"><span className="org-avatar">N</span><span className="org-name"><strong>Northstar Realty</strong><small>Workspace</small></span><ChevronDown size={15} className="org-chevron" /></button>
      <nav className="nav">{navSections.map(section => <div className="nav-section" key={section.title}><p>{section.title}</p>{section.items.map(item => <button key={item.name} onClick={() => changePage(item.name)} className={`nav-item ${page === item.name ? 'active' : ''}`}><item.icon size={17} strokeWidth={1.8} /><span>{item.name}</span>{item.count && <small>{item.count}</small>}</button>)}</div>)}<div className="nav-section tools-section"><p>TOOLS</p><button onClick={() => changePage('Automations')} className={`nav-item ${page === 'Automations' ? 'active' : ''}`}><Zap size={17} strokeWidth={1.8}/><span>Automations</span><span className="live-dot" /></button><button onClick={() => notify('Settings are up to date')} className="nav-item"><Settings size={17} strokeWidth={1.8}/><span>Settings</span></button></div></nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><Zap size={14}/></div><strong>Your team is on a roll</strong><span>12 deals moved forward this week.</span><button onClick={() => changePage('Reports')}>View activity <ArrowRight size={14}/></button><div className="help-spark"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div><button className="profile" onClick={() => void logout()} aria-label={`Sign out ${authUser?.name ?? 'of your account'}`} title="Sign out"><div className="profile-avatar">{short(authUser?.name ?? 'User')}</div><span><strong>{authUser?.name ?? 'Workspace user'}</strong><small>Sign out</small></span><MoreHorizontal size={19}/></button></div>
    </aside>
    {mobileNav && <button className="mobile-overlay" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
    <main className="main-area"><header className="topbar"><div className="breadcrumb"><button className="menu-trigger" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={20}/></button><span>Workspace</span><span className="crumb-sep">/</span><strong>{page}</strong></div><div className="top-actions"><span className="today-chip"><span className="green-pip"/>{databaseStatus === 'connected' ? 'Database connected' : databaseStatus === 'checking' ? 'Connecting to database' : 'Database unavailable'}</span><button className="icon-button" onClick={() => notify('You’re all caught up')} aria-label="Notifications"><Bell size={18}/><i/></button><div className="top-divider"/><div className="logged-in-user" title={authUser?.email}><strong>{authUser?.name ?? 'Workspace user'}</strong><small>{authUser?.email}</small></div><button className="logout-button" onClick={() => void logout()}><LogOut size={15}/><span>Log out</span></button></div></header>
      <div className="page-wrap"><div className="welcome-row"><div><div className="eyebrow"><span className="sparkle">✳</span> WEDNESDAY, OCTOBER 14, 2026 <span className="eyebrow-divider">·</span> WEEK 42</div><h1>{page === 'Marketing & Sales' ? <>Marketing &amp; sales <span>leads.</span></> : page}</h1><p className="page-subtitle">{page === 'Marketing & Sales' ? 'A clearer view of every lead, opportunity, and deal.' : getSubtitle(page)}</p></div><div className="welcome-actions">{page === 'Marketing & Sales' || page === 'Reports' ? <button className="date-picker" onClick={() => notify('Showing this month’s activity')}><CalendarDays size={15}/> Oct 1 – Oct 31, 2026 <ChevronDown size={14}/></button> : null}<button className="primary-button" onClick={openAdd}><Plus size={16} strokeWidth={2.4}/> Add {pageResources[page] === 'users' ? 'team member' : pageResources[page] === 'partners' ? 'channel partner' : pageResources[page] === 'projects' ? 'project' : pageResources[page] === 'visits' ? 'site visit' : pageResources[page] === 'bookings' ? 'booking' : pageResources[page] === 'automations' ? 'automation' : 'new lead'}</button></div></div>
      {page === 'Marketing & Sales' ? <Dashboard leads={leads} onNavigate={changePage} onAdd={() => setEditor({ kind: 'leads' })} /> : page === 'Leads' ? <LeadsPage leads={visibleLeads} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} onAdd={openAdd} onSelect={changePage} onEdit={editLead}/> : page === 'Reports' ? <ReportsPage/> : <ResourcePage kind={activeResource} heading={page === 'Inventory' ? 'Inventory' : undefined} records={resources[activeResource]} onEdit={item => setEditor({ kind: activeResource, item })}/>}
      <footer className="footer"><span>© 2026 Estateflow</span><span><i/> {databaseStatus === 'connected' ? 'Your data is synced to PostgreSQL' : databaseStatus === 'checking' ? 'Checking database connection' : 'Database connection required'}</span><a href="mailto:support@estateflow.io">Need a hand?</a></footer></div>
    </main>
    {editor && <ResourceEditor key={`${editor.kind}-${typeof editor.item?.id === 'string' ? editor.item.id : 'new'}`} kind={editor.kind} item={editor.item} rows={resources} saving={saving} onClose={() => setEditor(null)} onSave={saveResource}/>}
    {notice && <div className="toast"><span><Check size={15}/></span>{notice}</div>}
  </div>
}

function toLead(row: ApiLead, index: number): Lead {
  const status = row.status === 'SITE_VISIT' ? 'Site visit' : row.status[0] + row.status.slice(1).toLowerCase()
  return { id: `EF-${row.id.slice(-6).toUpperCase()}`, databaseId: row.id, name: row.name, email: row.email ?? undefined, phone: row.phone ?? undefined, project: row.project?.name, source: row.source, status, budget: row.budget ?? undefined, agent: row.assignedTo?.name || 'Unassigned', created: new Date(row.createdAt).toLocaleDateString(), avatar: short(row.name), color: ['rose', 'blue', 'purple', 'amber', 'pink', 'teal'][index % 6] }
}

function getPageFromPath() {
  const path = window.location.pathname.toLowerCase()
  if (path === '/') return 'Leads'
  if (path === '/leads') return 'Leads'
  if (path === '/inventory') return 'Inventory'
  if (path === '/marketing-sales') return 'Marketing & Sales'
  const pages: Record<string, string> = { '/reports': 'Reports', '/sales-team': 'Sales team', '/channel-partners': 'Channel partners', '/site-visits': 'Site visits', '/bookings': 'Bookings', '/automations': 'Automations' }
  return pages[path] ?? 'Marketing & Sales'
}

function getSubtitle(page: string) { const map: Record<string,string> = { 'Leads': 'Everyone you’re building a relationship with, in one place.', 'Inventory': 'Your property portfolio and project inventory.', 'Sales team': 'Good people make great deals happen.', 'Channel partners': 'Your partners in finding the right buyers.', 'Site visits': 'Every first impression, thoughtfully planned.', 'Bookings': 'Big moments, beautifully organized.', 'Reports': 'Make decisions with the full picture.', 'Automations': 'Let the little things take care of themselves.' }; return map[page] || 'Everything you need to move the day forward.' }

function Dashboard({ leads, onNavigate, onAdd }: { leads: Lead[]; onNavigate: (s:string)=>void; onAdd:()=>void }) {
  const metrics = [{ label: 'Active leads', value: '1,284', change: '+12.8%', note: 'vs. last month', icon: Users, trend: 'up', color: 'mint' }, { label: 'Site visits', value: '86', change: '+8.2%', note: 'vs. last month', icon: MapPin, trend: 'up', color: 'blue' }, { label: 'Bookings', value: '32', change: '+18.4%', note: 'vs. last month', icon: CalendarDays, trend: 'up', color: 'purple' }, { label: 'Revenue pipeline', value: '₹24.8 Cr', change: '−2.1%', note: 'vs. last month', icon: TrendingUp, trend: 'down', color: 'amber' }]
  return <>
    <div className="stat-grid">{metrics.map((m, i) => <article className="stat-card" key={m.label}><div className="stat-top"><span className="stat-label">{m.label}</span><span className={`stat-icon ${m.color}`}><m.icon size={16}/></span></div><div className="stat-number">{m.value}{i===0&&<span className="micro-note"> this month</span>}</div><div className="stat-foot"><span className={`change ${m.trend}`}>{m.trend === 'up' ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>} {m.change}</span><span>{m.note}</span><span className="stat-spark">{[4,7,5,10,6,13,9,12,8,15,10,18,13,21,16,22].map((n,j)=><i key={j} style={{height:n+'px'}}/>)}</span></div></article>)}</div>
    <div className="dashboard-grid"><section className="panel pipeline-panel"><div className="panel-heading"><div><h2>Sales pipeline</h2><p>A little progress goes a long way.</p></div><button className="more-button" onClick={() => onNavigate('Reports')} aria-label="More pipeline options"><Ellipsis size={19}/></button></div><div className="pipeline-total"><strong>₹24,80,00,000</strong><span><i/> 18.6% <small>more than last month</small></span></div><div className="chart-total-row"><span>DEAL VALUE</span><span>LAST 6 MONTHS <ChevronDown size={11}/></span></div><div className="chart"><div className="chart-guides"><span>₹30 Cr</span><span>₹20 Cr</span><span>₹10 Cr</span><span>₹0</span></div><div className="chart-lines"><i/><i/><i/><i/></div><svg className="chart-svg" viewBox="0 0 680 150" preserveAspectRatio="none" role="img" aria-label="Sales pipeline rising from May to October"><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a4ed86" stopOpacity=".23"/><stop offset="100%" stopColor="#a4ed86" stopOpacity="0"/></linearGradient></defs><path d="M0,116 C48,109 48,122 102,96 S167,92 204,103 S259,67 306,77 S355,87 408,49 S467,72 510,53 S565,42 612,29 S654,31 680,14 L680,150 L0,150 Z" fill="url(#chartFill)"/><path d="M0,116 C48,109 48,122 102,96 S167,92 204,103 S259,67 306,77 S355,87 408,49 S467,72 510,53 S565,42 612,29 S654,31 680,14" fill="none" stroke="#a4ed86" strokeWidth="2.6" vectorEffect="non-scaling-stroke"/><circle cx="510" cy="53" r="4" fill="#a4ed86" stroke="#171a18" strokeWidth="2"/><circle cx="680" cy="14" r="4" fill="#a4ed86" stroke="#171a18" strokeWidth="2"/></svg><div className="chart-months"><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span></div></div><div className="pipeline-legend"><span><i className="legend-dot lime-dot"/> Qualified <strong>₹8.2 Cr</strong></span><span><i className="legend-dot sky-dot"/> Negotiation <strong>₹11.4 Cr</strong></span><span><i className="legend-dot lilac-dot"/> Site visits <strong>₹5.2 Cr</strong></span></div></section>
      <section className="panel sources-panel"><div className="panel-heading"><div><h2>Where leads come from</h2><p>The right channels, making connections.</p></div><button className="more-button" aria-label="More channel options"><Ellipsis size={19}/></button></div><div className="source-content"><div className="donut-wrap"><div className="donut"><div className="donut-hole"><strong>1,284</strong><span>total leads</span></div></div></div><div className="sources-legend">{[{label:'Website',v:'32%',c:'lime'},{label:'Referrals',v:'26%',c:'blue'},{label:'Social media',v:'22%',c:'purple'},{label:'Channel partner',v:'14%',c:'orange'},{label:'Other',v:'6%',c:'gray'}].map(x=><div className="source-row" key={x.label}><span><i className={`legend-dot ${x.c}-dot`}/>{x.label}</span><strong>{x.v}</strong></div>)}</div></div><div className="source-note"><span className="mini-trend"><TrendingUp size={14}/></span><span><strong>Referrals are up 34%</strong> this month. Your best channel yet!</span><ArrowRight size={14}/></div></section>
    </div>
    <div className="dashboard-grid lower-grid"><section className="panel leads-panel"><div className="panel-heading"><div><div className="heading-inline"><h2>Latest leads</h2><span className="new-badge">6 new</span></div><p>Fresh faces worth getting to know.</p></div><button className="text-link" onClick={() => onNavigate('Leads')}>All leads <ArrowRight size={14}/></button></div><div className="table-scroll"><table className="leads-table"><thead><tr><th>PROSPECT</th><th>INTERESTED IN</th><th>SOURCE</th><th>STATUS</th><th>OWNER</th></tr></thead><tbody>{leads.slice(0,5).map(l=><LeadRow key={l.id} lead={l}/>)}</tbody></table></div><button className="table-view-all" onClick={() => onNavigate('Leads')}>See all leads <ArrowRight size={14}/></button></section><section className="panel visits-panel"><div className="panel-heading"><div><h2>Today’s schedule</h2><p>A day full of promising first impressions.</p></div><button className="text-link" onClick={() => onNavigate('Site visits')}>Full calendar <ArrowRight size={14}/></button></div><div className="schedule-date"><span className="schedule-day">14</span><div><strong>Wednesday, October</strong><span>3 visits scheduled today</span></div><button className="calendar-add" onClick={() => onNavigate('Site visits')}><Plus size={15}/></button></div><div className="schedule-list">{[{time:'10:30',ampm:'AM',name:'Ananya Sharma',project:'The Willow Residences',color:'rose',tag:'First visit'},{time:'12:15',ampm:'PM',name:'Arjun Kapoor',project:'Parkview Heights',color:'blue',tag:'Follow-up'},{time:'03:00',ampm:'PM',name:'Dev Malhotra',project:'Parkview Heights',color:'teal',tag:'First visit'}].map((v,i)=><div className="schedule-item" key={v.name}><div className="visit-time"><strong>{v.time}</strong><span>{v.ampm}</span></div><div className="time-track"><i className={i===0?'now':''}/>{i===0&&<span className="now-label">NOW</span>}</div><div className="visit-person"><span className={`avatar ${v.color}`}>{short(v.name)}</span><div><strong>{v.name}</strong><span>{v.project}</span></div><span className="visit-tag">{v.tag}</span></div></div>)}</div><button className="schedule-cta" onClick={() => onNavigate('Site visits')}><CalendarDays size={14}/> See the week ahead <ArrowRight size={14}/></button></section></div>
    <section className="moment-strip"><div className="moment-icon"><span>✳</span></div><div><span className="moment-kicker">A LITTLE SOMETHING WORTH CELEBRATING</span><p><strong>Olive Garden Villas</strong> just crossed 80% inventory sold. That’s worth a coffee.</p></div><button onClick={onAdd}>Make a note <Plus size={14}/></button><span className="moment-decoration">✳</span></section>
  </>
}

function LeadRow({ lead: l }: { lead: Lead }) { return <tr><td><div className="person-cell"><span className={`avatar ${l.color}`}>{l.avatar}</span><span><strong>{l.name}</strong><small>{l.email}</small></span></div></td><td><span className="project-cell">{l.project || '—'}</span></td><td><span className={`source-chip src-${l.source.toLowerCase().replace(/\s+/g,'-')}`}><i/>{l.source}</span></td><td><span className={`status-badge ${statusClass[l.status] || 's-new'}`}><i/>{l.status}</span></td><td><span className="owner-cell"><span className="owner-avatar">{short(l.agent)}</span>{l.agent.split(' ')[0]}</span></td></tr> }

function LeadsPage({ leads, query, setQuery, filter, setFilter, onAdd, onSelect, onEdit }: { leads: Lead[]; query:string; setQuery:(x:string)=>void; filter:string; setFilter:(x:string)=>void; onAdd:()=>void; onSelect:(x:string)=>void; onEdit:(lead:Lead)=>void }) { return <div className="panel full-list-panel"><div className="list-toolbar"><div className="list-tabs">{['All leads','New','Contacted','Qualified','Site visit','Negotiation'].map(t=><button key={t} className={filter===t?'selected':''} onClick={()=>setFilter(t)}>{t}{t==='All leads'&&<small>{leads.length}</small>}</button>)}</div><div className="list-actions"><label className="search-box"><Search size={16}/><input placeholder="Search leads..." value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌘ K</kbd></label><button className="filter-button" onClick={()=>setFilter(filter==='All leads'?'Qualified':'All leads')}><Filter size={15}/> Filter</button><button className="filter-button" onClick={()=>onSelect('Reports')}><Download size={15}/> Export</button></div></div><div className="big-table-wrap"><table className="leads-table big-table"><thead><tr><th>PROSPECT</th><th>PHONE</th><th>INTERESTED IN</th><th>BUDGET</th><th>SOURCE</th><th>STATUS</th><th>OWNER</th><th>ADDED</th><th>ACTIONS</th></tr></thead><tbody>{leads.map(l=><tr key={l.id}><td><div className="person-cell"><span className={`avatar ${l.color}`}>{l.avatar}</span><span><strong>{l.name}</strong><small>{l.email||l.id}</small></span></div></td><td>{l.phone||'—'}</td><td>{l.project||'—'}</td><td>{money(l.budget)}</td><td><span className={`source-chip src-${l.source.toLowerCase().replace(/\s+/g,'-')}`}><i/>{l.source}</span></td><td><span className={`status-badge ${statusClass[l.status]||'s-new'}`}><i/>{l.status}</span></td><td><span className="owner-cell"><span className="owner-avatar">{short(l.agent)}</span>{l.agent}</span></td><td>{l.created}</td><td><button type="button" className="resource-edit-button" onClick={()=>onEdit(l)}>Edit</button></td></tr>)}</tbody></table>{leads.length===0&&<div className="empty-state"><Users size={25}/><strong>No leads found</strong><span>Try another search, or add someone new.</span></div>}</div><div className="table-pagination"><span>Showing <strong>{leads.length ? 1 : 0}–{leads.length}</strong> of <strong>{leads.length}</strong> leads</span><div><button disabled>‹</button><button className="page-selected">1</button></div></div></div> }

function VisitsPage({ onNavigate }: {onNavigate:(s:string)=>void}) { return <div className="operations-grid"><div className="panel operation-main"><div className="panel-heading"><div><h2>This week</h2><p>14 – 20 October · 8 visits scheduled</p></div><button className="date-picker" onClick={()=>{}}>This week <ChevronDown size={14}/></button></div><div className="visit-day"><h3>Today <span>Wednesday, 14 Oct</span></h3>{[['10:30 AM','Ananya Sharma','The Willow Residences','Rohan Mehta','First visit'],['12:15 PM','Arjun Kapoor','Parkview Heights','Priya Nair','Follow-up'],['3:00 PM','Dev Malhotra','Parkview Heights','Kabir Sethi','First visit']].map((v,i)=><div className="visit-card" key={v[1]}><strong className="visit-card-time">{v[0]}</strong><span className={`avatar ${['rose','blue','teal'][i]}`}>{short(v[1])}</span><div className="visit-card-person"><strong>{v[1]}</strong><span>{v[2]}</span></div><div className="visit-card-agent"><small>HOST</small><strong>{v[3]}</strong></div><span className="visit-tag">{v[4]}</span><button className="more-button"><Ellipsis size={18}/></button></div>)}</div><div className="visit-day"><h3>Tomorrow <span>Thursday, 15 Oct</span></h3>{[['11:00 AM','Meera Iyer','The Willow Residences','Rohan Mehta','First visit'],['2:30 PM','Vikram Patel','Olive Garden Villas','Priya Nair','Follow-up']].map((v,i)=><div className="visit-card" key={v[1]}><strong className="visit-card-time">{v[0]}</strong><span className={`avatar ${['purple','amber'][i]}`}>{short(v[1])}</span><div className="visit-card-person"><strong>{v[1]}</strong><span>{v[2]}</span></div><div className="visit-card-agent"><small>HOST</small><strong>{v[3]}</strong></div><span className="visit-tag">{v[4]}</span><button className="more-button"><Ellipsis size={18}/></button></div>)}</div></div><div className="panel side-summary"><span className="stat-icon blue"><MapPin size={17}/></span><h2>The little moments add up.</h2><p>Every visit is a chance to help someone find where they belong.</p><div className="summary-stat"><span>This month</span><strong>86 visits</strong><small><ArrowUpRight size={13}/> 8.2% vs September</small></div><div className="summary-stat"><span>Conversion to booking</span><strong>37.2%</strong><small>Among completed visits</small></div><button className="text-link" onClick={()=>onNavigate('Reports')}>Explore visit insights <ArrowRight size={14}/></button></div></div> }

function BookingsPage() { return <div className="panel booking-panel"><div className="panel-heading"><div><h2>Beautiful beginnings.</h2><p>Every booking is a fresh start. Here are the latest ones.</p></div><button className="filter-button"><SlidersHorizontal size={15}/> This month</button></div><div className="booking-summary"><div><span>Bookings this month</span><strong>32</strong><small><ArrowUpRight size={14}/> 18.4% from September</small></div><div><span>Total booked value</span><strong>₹18.6 Cr</strong><small>Across 4 residential projects</small></div><div><span>Units remaining</span><strong>48 <em>of 172</em></strong><small>Across your portfolio</small></div></div><div className="big-table-wrap"><table className="leads-table big-table"><thead><tr><th>NEW HOMEOWNER</th><th>PROJECT</th><th>UNIT</th><th>BOOKED VALUE</th><th>BOOKED ON</th><th>STATUS</th></tr></thead><tbody>{[['AS','Ananya Sharma','rose','The Willow Residences','Tower A · 1204','₹1.45 Cr','Today, 11:42 AM','Confirmed'],['VP','Vikram Patel','amber','Olive Garden Villas','Villa · 018','₹2.32 Cr','12 Oct 2025','Reserved'],['DM','Dev Malhotra','teal','Parkview Heights','Tower C · 804','₹1.18 Cr','10 Oct 2025','Confirmed'],['MI','Meera Iyer','purple','The Willow Residences','Tower B · 1602','₹1.85 Cr','8 Oct 2025','Confirmed'],['RD','Riya Desai','pink','Meridian Business Park','Office · 410','₹3.10 Cr','6 Oct 2025','Reserved']].map(b=><tr key={b[1]}><td><div className="person-cell"><span className={`avatar ${b[2]}`}>{b[0]}</span><span><strong>{b[1]}</strong><small>via referral</small></span></div></td><td>{b[3]}</td><td>{b[4]}</td><td className="booking-value">{b[5]}</td><td>{b[6]}</td><td><span className={`status-badge ${b[7]==='Confirmed'?'s-won':'s-visit'}`}><i/>{b[7]}</span></td></tr>)}</tbody></table></div></div> }

function TeamPage() { const agents=[['RM','Rohan Mehta','Senior property advisor','31','₹4.82 Cr','91%','rose'],['PN','Priya Nair','Property advisor','28','₹4.16 Cr','84%','blue'],['KS','Kabir Sethi','Property advisor','24','₹3.71 Cr','79%','purple'],['SN','Simran Nair','Associate advisor','19','₹2.65 Cr','72%','teal'],['AV','Aarav Verma','Associate advisor','16','₹2.24 Cr','68%','amber']];return <div className="team-view"><div className="team-stats">{[['Your people','12','Across 2 offices'],['Team site visits','86','This month'],['Conversion rate','28.6%','↑ 4.2% this month'],['Total commissions','₹28.4 L','This month']].map(s=><div className="panel team-mini" key={s[0]}><span>{s[0]}</span><strong>{s[1]}</strong><small>{s[2]}</small></div>)}</div><div className="panel full-list-panel"><div className="panel-heading"><div><h2>Good things happen together.</h2><p>Your team is building momentum — here’s who’s leading the way.</p></div><button className="primary-button"><Plus size={15}/> Invite teammate</button></div><div className="big-table-wrap"><table className="leads-table big-table"><thead><tr><th>TEAMMATE</th><th>ACTIVE LEADS</th><th>CLOSED VALUE</th><th>TARGET ATTAINMENT</th><th>THIS MONTH</th></tr></thead><tbody>{agents.map(a=><tr key={a[1]}><td><div className="person-cell"><span className={`avatar ${a[6]}`}>{a[0]}</span><span><strong>{a[1]}</strong><small>{a[2]}</small></span></div></td><td>{a[3]}</td><td className="booking-value">{a[4]}</td><td><div className="target-cell"><div className="target-track"><i style={{width:a[5]}}/></div><strong>{a[5]}</strong></div></td><td><span className="change up"><ArrowUpRight size={13}/> On track</span></td></tr>)}</tbody></table></div></div></div> }

function PartnersPage() { const p=[['AG','Aarav Group','Premier channel partner','18','₹1.84 Cr','rose'],['HM','HomeMatch Realty','Platinum channel partner','14','₹1.42 Cr','blue'],['CA','Cityscape Advisors','Gold channel partner','11','₹1.08 Cr','purple'],['LP','Lotus Properties','Silver channel partner','8','₹76 L','teal']];return <div className="team-view"><div className="team-stats">{[['Active partnerships','24','Across 3 cities'],['Partner-sourced leads','186','This quarter'],['Partner conversion','24.6%','↑ 3.8% this quarter'],['Commission payable','₹8.2 L','Across 12 bookings']].map(s=><div className="panel team-mini" key={s[0]}><span>{s[0]}</span><strong>{s[1]}</strong><small>{s[2]}</small></div>)}</div><div className="panel full-list-panel"><div className="panel-heading"><div><h2>Good company.</h2><p>Trusted partners, bringing good people through your door.</p></div><button className="primary-button"><Plus size={15}/> Add a partner</button></div><div className="big-table-wrap"><table className="leads-table big-table"><thead><tr><th>PARTNER</th><th>LEADS INTRODUCED</th><th>BOOKED VALUE</th><th>PARTNER TIER</th><th>COMMISSION</th></tr></thead><tbody>{p.map(x=><tr key={x[1]}><td><div className="person-cell"><span className={`avatar ${x[5]}`}>{x[0]}</span><span><strong>{x[1]}</strong><small>{x[2]}</small></span></div></td><td>{x[3]} this month</td><td className="booking-value">{x[4]}</td><td><span className="partner-tier"><i/> {x[2].split(' ')[0]}</span></td><td><span className="change up">2.5% per booking</span></td></tr>)}</tbody></table></div></div></div> }

function ReportsPage() { return <div className="reports-view"><div className="stat-grid report-stats">{[{label:'Total revenue',value:'₹18.6 Cr',note:'↑ 18.4% this month',color:'mint',icon:TrendingUp},{label:'New leads',value:'284',note:'↑ 12.8% this month',color:'blue',icon:Users},{label:'Visits completed',value:'86',note:'↑ 8.2% this month',color:'purple',icon:MapPin},{label:'Lead conversion',value:'28.6%',note:'↑ 4.2% this month',color:'amber',icon:ChartNoAxesCombined}].map(x=><div className="panel report-card" key={x.label}><span className={`stat-icon ${x.color}`}><x.icon size={16}/></span><span>{x.label}</span><strong>{x.value}</strong><small><ArrowUpRight size={13}/>{x.note}</small></div>)}</div><div className="dashboard-grid"><section className="panel reports-chart"><div className="panel-heading"><div><h2>A month of momentum.</h2><p>Bookings and revenue are both trending up.</p></div><button className="date-picker">Last 6 months <ChevronDown size={14}/></button></div><div className="report-bars">{[['May',38,48],['Jun',52,36],['Jul',45,58],['Aug',60,49],['Sep',56,72],['Oct',78,92]].map(([month,a,b])=><div className="bar-group" key={month}><div className="bar-pair"><i style={{height:`${a}%`}}/><i style={{height:`${b}%`}}/></div><span>{month}</span></div>)}</div><div className="reports-legend"><span><i className="legend-dot lime-dot"/> Revenue</span><span><i className="legend-dot sky-dot"/> Bookings</span></div></section><section className="panel reports-breakdown"><div className="panel-heading"><div><h2>What’s moving</h2><p>Activity this month so far.</p></div></div>{[['Leads contacted','186 / 284','65%'],['Visits completed','86 / 104','83%'],['Bookings confirmed','32 / 48','67%'],['Follow-ups on time','194 / 212','92%']].map(x=><div className="progress-metric" key={x[0]}><div><span>{x[0]}</span><strong>{x[1]}</strong></div><div className="target-track"><i style={{width:x[2]}}/></div></div>)}</section></div><section className="moment-strip"><div className="moment-icon"><TrendingUp size={17}/></div><div><span className="moment-kicker">THIS MONTH'S BRIGHT SPOT</span><p>Word of mouth is working wonders: <strong>referrals are up 34%</strong> across your portfolio.</p></div><span className="moment-decoration">✳</span></section></div> }

function AutomationPage({ onNotify }: {onNotify:(s:string)=>void}) { const [toggles,setToggles]=useState([true,true,false,true]);const flows=[['✳','A warm welcome','New lead comes in','Send a friendly first hello within 2 minutes.','Sent 284 welcomes this month.'],['◷','A gentle nudge','No reply after 2 days','Remind the owner to reach out, with a note.','2,146 thoughtful follow-ups.'],['⌖','Visit-day reminder','A visit is tomorrow','Send the buyer the where, when, and a warm note.','68 visit-day reminders sent.'],['↗','The good news','A booking is confirmed','Let the whole team share in the happy moment.','32 little celebrations this month.']];return <><div className="automation-intro panel"><span className="automation-spark">✳</span><div><h2>Good things, on autopilot.</h2><p>Small, thoughtful touchpoints that help relationships grow. You’re in control of every single one.</p></div><button className="primary-button" onClick={()=>onNotify('Your automation builder is ready') }><Plus size={15}/> New automation</button></div><div className="automation-grid">{flows.map((f,i)=><article className={`panel automation-card ${toggles[i]?'enabled':''}`} key={f[1]}><div className="automation-card-top"><span className="flow-icon">{f[0]}</span><button className={`toggle ${toggles[i]?'on':''}`} aria-label={`Toggle ${f[1]}`} onClick={()=>setToggles(t=>t.map((x,n)=>n===i?!x:x))}><i/></button></div><span className={`flow-active ${toggles[i]?'':'paused'}`}>{toggles[i]?'● ACTIVE':'○ PAUSED'}</span><h3>{f[1]}</h3><span className="flow-trigger">WHEN <strong>{f[2]}</strong></span><p>{f[3]}</p><div className="flow-footer"><Zap size={13}/>{f[4]}<button onClick={()=>onNotify(`Editing “${f[1]}”`)}><ArrowUpRight size={15}/></button></div></article>)}</div><div className="automation-footnote"><Check size={15}/><span>Everything here is designed to feel personal. Your team can pause, edit, or take over any time.</span></div></> }

export default App
