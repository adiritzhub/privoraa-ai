import { Info, Sparkles } from 'lucide-react'

export function PageHeading({ eyebrow, title, description, actions }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-heading-actions">{actions}</div>}
    </div>
  )
}

export function Notice({ children, tone = 'info' }) {
  return (
    <div className={`notice notice-${tone}`} role="note">
      <Info size={17} aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}

export function EmptyState({ title, children }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Sparkles size={19} aria-hidden="true" /></span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  )
}

export function Badge({ children, tone = 'neutral' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function MetricCard({ label, value, detail, icon: Icon }) {
  return (
    <section className="metric-card">
      <div className="metric-icon"><Icon size={18} aria-hidden="true" /></div>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </section>
  )
}