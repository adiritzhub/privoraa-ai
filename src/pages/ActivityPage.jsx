import { useEffect, useState } from 'react'
import { Activity, Clock3 } from 'lucide-react'
import { Badge, EmptyState, Notice, PageHeading } from '../components/Ui.jsx'

function ActivityPage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    import('../services/founderService.js')
      .then(({ founderService }) => founderService.listActivity({ limit: 100 }))
      .then((items) => { if (active) setEvents(items) })
      .catch((loadError) => {
        if (active) setError(loadError?.safe ? loadError.message : 'Founder activity could not be loaded.')
      })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [])

  return (
    <div className="page-stack">
      <PageHeading eyebrow="FOUNDER AREA / AUDIT" title="Activity log" description="Append-only audit events from protected platform operations." actions={<Badge tone="success">Server managed</Badge>} />
      <Notice>Audit metadata is intentionally separate from prompts and credentials. Only an active Founder may read this view.</Notice>
      {error && <p className="form-status error-status" role="alert">{error}</p>}
      <section className="panel activity-panel">
        {loading ? <EmptyState title="Loading activity">Verifying Founder access and loading audit events…</EmptyState> : events.length === 0 ? <EmptyState title="No activity recorded">Protected platform actions will appear here.</EmptyState> : (
          <div className="activity-list">
            {events.map((event) => (
              <article className="activity-event" key={event.id}>
                <span className="activity-event-icon"><Activity size={16} aria-hidden="true" /></span>
                <div className="activity-event-copy"><strong>{event.action}</strong><span>{event.target_type}{event.target_id ? ` · ${event.target_id}` : ''}</span><small>Actor {event.actor_id ?? 'system'}</small></div>
                <span className="activity-event-time"><Clock3 size={13} aria-hidden="true" />{event.created_at ? new Date(event.created_at).toLocaleString() : ''}</span>
              </article>
            ))}
          </div>
        )}
        <p className="table-note">The client cannot insert, modify, or delete audit records.</p>
      </section>
    </div>
  )
}

export default ActivityPage
