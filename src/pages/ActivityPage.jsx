import { Activity, Clock3 } from 'lucide-react'
import { Badge, PageHeading } from '../components/Ui.jsx'
import { prototypeActivity } from '../data/prototypeData.js'

function ActivityPage() {
  return (
    <div className="page-stack">
      <PageHeading eyebrow="FOUNDER AREA / AUDIT" title="Activity log" description="Preview events for reviewing the future audit trail." actions={<Badge tone="warning">Sample events</Badge>} />
      <section className="panel activity-panel">
        <div className="activity-list">
          {prototypeActivity.map((event) => (
            <article className="activity-event" key={event.id}>
              <span className="activity-event-icon"><Activity size={16} aria-hidden="true" /></span>
              <div className="activity-event-copy"><strong>{event.action}</strong><span>{event.detail}</span><small>{event.actor}</small></div>
              <span className="activity-event-time"><Clock3 size={13} aria-hidden="true" />{event.time}</span>
            </article>
          ))}
        </div>
        <p className="table-note">Events are illustrative and are not connected to real accounts, prompt classifications, or generation jobs.</p>
      </section>
    </div>
  )
}

export default ActivityPage