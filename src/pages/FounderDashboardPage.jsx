import { useEffect, useState } from 'react'
import { Activity, ArrowRight, ListChecks, Shield, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, MetricCard, Notice, PageHeading } from '../components/Ui.jsx'

function FounderDashboardPage() {
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      import('../services/approvalService.js').then(({ approvalService }) => approvalService.listPendingApprovals()),
      import('../services/founderService.js').then(({ founderService }) => founderService.listUsers()),
      import('../services/founderService.js').then(({ founderService }) => founderService.getGenerationSettings()),
      import('../services/founderService.js').then(({ founderService }) => founderService.listActivity({ limit: 3 })),
    ])
      .then(([approvals, users, settings, activity]) => {
        if (active) setOverview({ approvals, users, settings, activity })
      })
      .catch((loadError) => {
        if (active) setError(loadError?.safe ? loadError.message : 'Founder overview could not be loaded.')
      })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [])

  const pendingApprovals = overview?.approvals ?? []
  const generationEnabled = overview?.settings?.global_generation_enabled ?? false

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="FOUNDER AREA"
        title="Platform overview"
        description="A live view of review activity and platform controls."
        actions={<Badge tone={overview ? 'success' : 'warning'}>{overview ? 'Backend connected' : 'Loading data'}</Badge>}
      />
      <Notice tone="warning">Founder operations are reauthorized by database RPCs. Route guards are only a user-interface aid; image generation and policy classification are not connected. Provider safeguards and applicable law always apply.</Notice>
      {error && <p className="form-status error-status" role="alert">{error}</p>}

      <div className="metric-grid">
        <MetricCard label="Pending approvals" value={loading ? '…' : pendingApprovals.length} detail="Restricted requests" icon={ListChecks} />
        <MetricCard label="User accounts" value={loading ? '…' : overview?.users.length ?? 0} detail="Trusted profiles" icon={UsersRound} />
        <MetricCard label="Generation status" value={generationEnabled ? 'Enabled' : 'Paused'} detail="Server setting" icon={Activity} />
        <MetricCard label="Policy safeguard" value="Required" detail="Never bypass provider rules" icon={Shield} />
      </div>

      <div className="founder-grid">
        <section className="panel founder-queue-panel">
          <div className="section-inline-heading"><div><span className="eyebrow">REVIEW WORKFLOW</span><h2>Approval queue</h2></div><Link className="text-link" to="/founder/approvals">Open queue <ArrowRight size={15} aria-hidden="true" /></Link></div>
          {loading ? (
            <div className="quiet-empty" role="status">Loading pending approvals…</div>
          ) : pendingApprovals.length ? (
            <div className="compact-list">
              {pendingApprovals.slice(0, 3).map((request) => (
                <div className="compact-list-item" key={request.id}><span className="list-icon"><ListChecks size={17} aria-hidden="true" /></span><div><strong>{request.category}</strong><span>{request.created_at ? new Date(request.created_at).toLocaleString() : 'Awaiting review'}</span></div><Badge tone="warning">Review</Badge></div>
              ))}
            </div>
          ) : <div className="quiet-empty">No pending restricted requests.</div>}
        </section>
        <section className="panel founder-status-panel">
          <div className="section-inline-heading"><div><span className="eyebrow">SYSTEM STATUS</span><h2>Generation controls</h2></div><span className="status-dot" /></div>
          <div className="system-row"><span>Global generation</span><Badge tone={generationEnabled ? 'success' : 'neutral'}>{generationEnabled ? 'Enabled' : 'Paused'}</Badge></div>
          <div className="system-row"><span>Image model</span><Badge tone="neutral">Not connected</Badge></div>
          <div className="system-row"><span>Policy classifier</span><Badge tone="neutral">Not connected</Badge></div>
          <Link className="text-link settings-link" to="/founder/settings">Open settings <ArrowRight size={15} aria-hidden="true" /></Link>
        </section>
      </div>

      <section className="panel log-panel">
        <div className="section-inline-heading"><div><span className="eyebrow">AUDIT TRAIL</span><h2>Recent activity</h2></div><Link className="text-link" to="/founder/activity">View all <ArrowRight size={15} aria-hidden="true" /></Link></div>
        {loading ? <div className="log-placeholder" role="status">Loading audit events…</div> : overview?.activity.length ? (
          <div className="compact-list">
            {overview.activity.map((event) => (
              <div className="compact-list-item" key={event.id}><span className="list-icon"><Activity size={16} aria-hidden="true" /></span><div><strong>{event.action}</strong><span>{event.created_at ? new Date(event.created_at).toLocaleString() : ''}</span></div></div>
            ))}
          </div>
        ) : <div className="log-placeholder">No audit events recorded yet.</div>}
      </section>
    </div>
  )
}

export default FounderDashboardPage
