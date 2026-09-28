import { Activity, ArrowRight, CheckCircle2, ListChecks, Shield, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, MetricCard, Notice, PageHeading } from '../components/Ui.jsx'
import { useAppState } from '../hooks/useAppState.js'

function FounderDashboardPage() {
  const { approvals, users, settings } = useAppState()
  const pendingCount = approvals.filter((item) => item.status === 'pending').length

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="FOUNDER AREA"
        title="Platform overview"
        description="A control-room preview for review workflows and platform settings."
        actions={<Badge tone="warning">Prototype data</Badge>}
      />
      <Notice tone="warning">These controls are local UI state only. They are not authenticated, persisted, or enforced by a server. Provider safety controls and applicable law cannot be overridden.</Notice>

      <div className="metric-grid">
        <MetricCard label="Pending approvals" value={pendingCount} detail="Preview queue" icon={ListChecks} />
        <MetricCard label="User accounts" value={users.length} detail="Sample accounts" icon={UsersRound} />
        <MetricCard label="Generation status" value={settings.generationEnabled ? 'Enabled' : 'Paused'} detail="Prototype toggle" icon={Activity} />
        <MetricCard label="Policy safeguard" value="Required" detail="Not configurable here" icon={Shield} />
      </div>

      <div className="founder-grid">
        <section className="panel founder-queue-panel">
          <div className="section-inline-heading"><div><span className="eyebrow">REVIEW WORKFLOW</span><h2>Approval queue</h2></div><Link className="text-link" to="/founder/approvals">Open queue <ArrowRight size={15} aria-hidden="true" /></Link></div>
          {approvals.filter((item) => item.status === 'pending').length ? (
            <div className="compact-list">
              {approvals.filter((item) => item.status === 'pending').slice(0, 3).map((item) => (
                <div className="compact-list-item" key={item.id}><span className="list-icon"><ListChecks size={17} aria-hidden="true" /></span><div><strong>{item.category}</strong><span>{item.name} · {item.submittedAt}</span></div><Badge tone="warning">Review</Badge></div>
              ))}
            </div>
          ) : <div className="quiet-empty"><CheckCircle2 size={18} aria-hidden="true" /> No pending sample reviews.</div>}
        </section>
        <section className="panel founder-status-panel">
          <div className="section-inline-heading"><div><span className="eyebrow">SYSTEM STATUS</span><h2>Generation controls</h2></div><span className="status-dot" /></div>
          <div className="system-row"><span>Global generation</span><Badge tone={settings.generationEnabled ? 'success' : 'neutral'}>{settings.generationEnabled ? 'Enabled' : 'Paused'}</Badge></div>
          <div className="system-row"><span>Image model</span><Badge tone="neutral">Not connected</Badge></div>
          <div className="system-row"><span>Policy classifier</span><Badge tone="neutral">Not connected</Badge></div>
          <Link className="text-link settings-link" to="/founder/settings">Configure preview <ArrowRight size={15} aria-hidden="true" /></Link>
        </section>
      </div>

      <section className="panel log-panel">
        <div className="section-inline-heading"><div><span className="eyebrow">AUDIT TRAIL</span><h2>Generation logs</h2></div><Badge>Unavailable</Badge></div>
        <div className="log-placeholder"><Activity size={18} aria-hidden="true" /><span>Logs will be available when a backend and generation service are connected.</span></div>
      </section>
    </div>
  )
}

export default FounderDashboardPage