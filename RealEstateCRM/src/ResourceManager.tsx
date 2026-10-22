import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Pencil, Plus } from 'lucide-react'

export type ResourceKind = 'leads' | 'users' | 'partners' | 'projects' | 'visits' | 'bookings' | 'automations'
export type ResourceRecord = Record<string, unknown>

type Field = { name: string; label: string; type?: 'text' | 'email' | 'tel' | 'number' | 'select' | 'textarea' | 'datetime-local' | 'checkbox'; required?: boolean; options?: { value: string; label: string }[]; placeholder?: string }
type Relationships = { leads: ResourceRecord[]; users: ResourceRecord[]; projects: ResourceRecord[]; partners: ResourceRecord[] }

const definitions: Record<ResourceKind, { title: string; fields: Field[] }> = {
  leads: { title: 'Lead', fields: [
    { name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', type: 'email' }, { name: 'phone', label: 'Phone', type: 'tel' },
    { name: 'source', label: 'Source', required: true, placeholder: 'Website, Referral, Instagram…' },
    { name: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'NEW', label: 'New' }, { value: 'CONTACTED', label: 'Contacted' }, { value: 'QUALIFIED', label: 'Qualified' }, { value: 'SITE_VISIT', label: 'Site visit' }, { value: 'NEGOTIATION', label: 'Negotiation' }, { value: 'WON', label: 'Won' }, { value: 'LOST', label: 'Lost' }] },
    { name: 'budget', label: 'Budget (₹)', type: 'number' }, { name: 'projectId', label: 'Project', type: 'select', options: [] },
    { name: 'assignedToId', label: 'Assigned teammate', type: 'select', options: [] }, { name: 'channelPartnerId', label: 'Channel partner', type: 'select', options: [] },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ] },
  users: { title: 'Team member', fields: [
    { name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'role', label: 'Role', type: 'select', required: true, options: [{ value: 'AGENT', label: 'Agent' }, { value: 'MANAGER', label: 'Manager' }, { value: 'ADMIN', label: 'Admin' }] },
    { name: 'avatar', label: 'Avatar initials' },
  ] },
  partners: { title: 'Channel partner', fields: [
    { name: 'name', label: 'Contact name', required: true }, { name: 'company', label: 'Company', required: true },
    { name: 'email', label: 'Email', type: 'email' }, { name: 'phone', label: 'Phone', type: 'tel' },
    { name: 'commissionRate', label: 'Commission rate (%)', type: 'number', required: true },
  ] },
  projects: { title: 'Project', fields: [
    { name: 'name', label: 'Project name', required: true }, { name: 'location', label: 'Location', required: true },
    { name: 'priceFrom', label: 'Starting price (₹)', type: 'number', required: true },
    { name: 'status', label: 'Status', required: true, placeholder: 'Active, Coming soon…' }, { name: 'image', label: 'Image identifier' },
  ] },
  visits: { title: 'Site visit', fields: [
    { name: 'leadId', label: 'Lead', type: 'select', required: true, options: [] },
    { name: 'projectId', label: 'Project', type: 'select', required: true, options: [] },
    { name: 'startsAt', label: 'Date and time', type: 'datetime-local', required: true },
    { name: 'agentId', label: 'Host', type: 'select', options: [] },
    { name: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'SCHEDULED', label: 'Scheduled' }, { value: 'COMPLETED', label: 'Completed' }, { value: 'CANCELLED', label: 'Cancelled' }] },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ] },
  bookings: { title: 'Booking', fields: [
    { name: 'leadId', label: 'Lead', type: 'select', required: true, options: [] },
    { name: 'projectId', label: 'Project', type: 'select', required: true, options: [] },
    { name: 'unitNumber', label: 'Unit number', required: true }, { name: 'amount', label: 'Booking amount (₹)', type: 'number', required: true },
    { name: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'RESERVED', label: 'Reserved' }, { value: 'CONFIRMED', label: 'Confirmed' }, { value: 'CANCELLED', label: 'Cancelled' }] },
    { name: 'bookedAt', label: 'Booked on', type: 'datetime-local', required: true }, { name: 'agentId', label: 'Owner', type: 'select', options: [] },
  ] },
  automations: { title: 'Automation', fields: [
    { name: 'name', label: 'Name', required: true }, { name: 'trigger', label: 'Trigger', required: true },
    { name: 'description', label: 'Description', type: 'textarea', required: true },
    { name: 'active', label: 'Automation active', type: 'checkbox' }, { name: 'runsThisMonth', label: 'Runs this month', type: 'number', required: true },
  ] },
}

const defaults: Partial<Record<ResourceKind, Record<string, string | boolean>>> = {
  leads: { source: 'Website', status: 'NEW' },
  users: { role: 'AGENT' },
  partners: { commissionRate: '2.5' },
  projects: { status: 'Active' },
  visits: { status: 'SCHEDULED' },
  bookings: { status: 'RESERVED', bookedAt: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) },
  automations: { active: true, runsThisMonth: '0' },
}

const columns: Record<ResourceKind, { label: string; render: (item: ResourceRecord) => string }[]> = {
  leads: [
    { label: 'LEAD', render: x => `${text(x.name)}${x.email ? ` · ${text(x.email)}` : ''}` }, { label: 'PHONE', render: x => text(x.phone) },
    { label: 'PROJECT', render: x => relatedName(x.project) }, { label: 'SOURCE', render: x => text(x.source) },
    { label: 'STATUS', render: x => label(x.status) }, { label: 'BUDGET', render: x => x.budget == null ? '—' : money(x.budget) },
    { label: 'ASSIGNED TO', render: x => relatedName(x.assignedTo) }, { label: 'CHANNEL PARTNER', render: x => relatedName(x.channelPartner) },
  ],
  users: [
    { label: 'NAME', render: x => text(x.name) }, { label: 'EMAIL', render: x => text(x.email) }, { label: 'ROLE', render: x => label(x.role) },
    { label: 'AVATAR', render: x => text(x.avatar) }, { label: 'ACTIVE LEADS', render: x => text(count(x._count, 'leads')) },
  ],
  partners: [
    { label: 'CONTACT', render: x => text(x.name) }, { label: 'COMPANY', render: x => text(x.company) },
    { label: 'EMAIL', render: x => text(x.email) }, { label: 'PHONE', render: x => text(x.phone) },
    { label: 'COMMISSION', render: x => `${text(x.commissionRate)}%` }, { label: 'LEADS', render: x => text(count(x._count, 'leads')) },
  ],
  projects: [
    { label: 'PROJECT', render: x => text(x.name) }, { label: 'LOCATION', render: x => text(x.location) },
    { label: 'STARTING PRICE', render: x => money(x.priceFrom) }, { label: 'STATUS', render: x => text(x.status) },
    { label: 'LEADS', render: x => text(count(x._count, 'leads')) }, { label: 'BOOKINGS', render: x => text(count(x._count, 'bookings')) },
  ],
  visits: [
    { label: 'LEAD', render: x => relatedName(x.lead) }, { label: 'PROJECT', render: x => relatedName(x.project) },
    { label: 'DATE & TIME', render: x => date(x.startsAt) }, { label: 'HOST', render: x => relatedName(x.agent) },
    { label: 'STATUS', render: x => label(x.status) }, { label: 'NOTES', render: x => text(x.notes) },
  ],
  bookings: [
    { label: 'LEAD', render: x => relatedName(x.lead) }, { label: 'PROJECT', render: x => relatedName(x.project) },
    { label: 'UNIT', render: x => text(x.unitNumber) }, { label: 'AMOUNT', render: x => money(x.amount) },
    { label: 'STATUS', render: x => label(x.status) }, { label: 'BOOKED ON', render: x => date(x.bookedAt) },
    { label: 'OWNER', render: x => relatedName(x.agent) },
  ],
  automations: [
    { label: 'NAME', render: x => text(x.name) }, { label: 'TRIGGER', render: x => text(x.trigger) },
    { label: 'DESCRIPTION', render: x => text(x.description) }, { label: 'ACTIVE', render: x => x.active === true ? 'Active' : 'Paused' },
    { label: 'RUNS THIS MONTH', render: x => text(x.runsThisMonth) },
  ],
}

function text(value: unknown): string { return value == null || value === '' ? '—' : String(value) }
function relatedName(value: unknown): string { return value && typeof value === 'object' && 'name' in value ? text(value.name) : '—' }
function count(value: unknown, key: string): unknown { return value && typeof value === 'object' && key in value ? (value as Record<string, unknown>)[key] : 0 }
function label(value: unknown): string { return text(value).replaceAll('_', ' ').replace(/\b\w/g, x => x.toUpperCase()) }
function money(value: unknown): string { const amount = Number(value); return Number.isFinite(amount) ? `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—' }
function date(value: unknown): string { if (typeof value !== 'string' && !(value instanceof Date)) return '—'; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString() }
function optionList(rows: ResourceRecord[]): { value: string; label: string }[] {
  return rows.flatMap(row => typeof row.id === 'string' && typeof row.name === 'string' ? [{ value: row.id, label: row.name }] : [])
}

function relatedItem(item: ResourceRecord, field: string): string {
  const relation: Record<string, string> = { projectId: 'project', assignedToId: 'assignedTo', agentId: 'agent', leadId: 'lead', channelPartnerId: 'channelPartner' }
  const related = item[relation[field] ?? '']
  return related && typeof related === 'object' && 'id' in related && typeof related.id === 'string' ? related.id : ''
}

export function ResourceEditor({ kind, item, rows, saving, onClose, onSave }: {
  kind: ResourceKind
  item?: ResourceRecord
  rows: Relationships
  saving: boolean
  onClose: () => void
  onSave: (kind: ResourceKind, id: string | undefined, values: Record<string, unknown>) => Promise<void>
}) {
  const definition = definitions[kind]
  const [values, setValues] = useState<Record<string, string | boolean>>({})

  useEffect(() => {
    const next: Record<string, string | boolean> = {}
    const initial = defaults[kind] ?? {}
    for (const field of definition.fields) {
      if (field.type === 'checkbox') next[field.name] = item ? item[field.name] === true : initial[field.name] === true
      else if (field.type === 'datetime-local') {
        const value = item?.[field.name]
        next[field.name] = typeof value === 'string' ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : String(initial[field.name] ?? '')
      } else if (['projectId', 'assignedToId', 'agentId', 'leadId', 'channelPartnerId'].includes(field.name)) {
        next[field.name] = item ? relatedItem(item, field.name) : ''
      } else next[field.name] = item ? item[field.name] == null ? '' : String(item[field.name]) : String(initial[field.name] ?? '')
    }
    setValues(next)
  }, [definition, item, kind])

  function optionsFor(field: Field): { value: string; label: string }[] {
    if (field.name === 'projectId') return optionList(rows.projects)
    if (field.name === 'assignedToId' || field.name === 'agentId') return optionList(rows.users)
    if (field.name === 'channelPartnerId') return optionList(rows.partners)
    if (field.name === 'leadId') return optionList(rows.leads)
    return field.options ?? []
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload: Record<string, unknown> = {}
    for (const field of definition.fields) {
      const value = values[field.name]
      if (field.type === 'checkbox') payload[field.name] = value === true
      else if (field.type === 'number') payload[field.name] = value === '' ? null : Number(value)
      else if (field.type === 'datetime-local') payload[field.name] = value ? new Date(String(value)).toISOString() : ''
      else payload[field.name] = value === '' && ['projectId', 'assignedToId', 'agentId', 'channelPartnerId'].includes(field.name) ? null : value
    }
    await onSave(kind, typeof item?.id === 'string' ? item.id : undefined, payload)
  }

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <form className="modal resource-modal" onSubmit={submit}>
      <div className="modal-top"><div className="modal-icon"><Pencil size={20}/></div><button type="button" className="icon-button" onClick={onClose} disabled={saving} aria-label="Close"><span aria-hidden="true">×</span></button></div>
      <h2>{item ? `Edit ${definition.title.toLowerCase()}` : `Add ${definition.title.toLowerCase()}`}</h2>
      <p>Changes are saved to PostgreSQL.</p>
      <div className="resource-fields">{definition.fields.map(field => {
        const value = values[field.name] ?? (field.type === 'checkbox' ? false : '')
        const full = field.type === 'textarea' || field.name === 'notes'
        const common = { required: field.required, disabled: saving, placeholder: field.placeholder, value: String(value), onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setValues(current => ({ ...current, [field.name]: event.target.value })) }
        return <label className={`${full ? 'resource-field-full' : ''}${field.type === 'checkbox' ? ' resource-checkbox' : ''}`} key={field.name}>
          {field.type === 'checkbox' ? <><input type="checkbox" checked={value === true} disabled={saving} onChange={event => setValues(current => ({ ...current, [field.name]: event.target.checked }))}/>{field.label}</> : <>{field.label}
            {field.type === 'textarea' ? <textarea {...common} rows={3}/> : field.type === 'select' ? <select {...common}><option value="">— None —</option>{optionsFor(field).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input {...common} type={field.type ?? 'text'} min={field.type === 'number' ? '0' : undefined} step={field.type === 'number' ? 'any' : undefined}/>}
          </>}
        </label>
      })}</div>
      <div className="modal-buttons"><button type="button" className="cancel-button" disabled={saving} onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={saving}><Plus size={15}/>{saving ? 'Saving…' : 'Save changes'}</button></div>
    </form>
  </div>
}

export function ResourcePage({ kind, records, onEdit, heading: headingOverride }: {
  kind: ResourceKind
  records: ResourceRecord[]
  onEdit: (item: ResourceRecord) => void
  heading?: string
}) {
  const heading = headingOverride ?? definitions[kind].title
  const headers = columns[kind]
  return <section className="panel full-list-panel resource-panel">
    <div className="panel-heading"><div><h2>{heading} records</h2><p>Changes here are saved in PostgreSQL.</p></div><span className="resource-count">{records.length} records</span></div>
    <div className="big-table-wrap"><table className="leads-table big-table"><thead><tr>{headers.map(column => <th key={column.label}>{column.label}</th>)}<th>ACTIONS</th></tr></thead>
      <tbody>{records.map(item => <tr key={String(item.id)}>{headers.map(column => <td key={column.label}>{column.render(item)}</td>)}<td><button type="button" className="resource-edit-button" onClick={() => onEdit(item)} aria-label={`Edit ${heading.toLowerCase()} ${text(item.name ?? relatedName(item.lead))}`}><Pencil size={14}/> Edit</button></td></tr>)}</tbody>
    </table>
      {records.length === 0 && <div className="empty-state"><strong>No {heading.toLowerCase()} records yet</strong><span>Add a record to start saving it to PostgreSQL.</span></div>}
    </div>
  </section>
}
