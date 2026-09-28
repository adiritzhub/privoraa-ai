import { useState } from 'react'
import { Ban, Check, Clock3, X } from 'lucide-react'
import { Badge, Notice, PageHeading } from '../components/Ui.jsx'
import { useAppState } from '../hooks/useAppState.js'

function ApprovalsPage() {
  const { approvals, reviewApproval } = useAppState()
  const [feedback, setFeedback] = useState('')

  function handleReview(id, decision) {
    reviewApproval(id, decision)
    setFeedback(`Sample request marked ${decision}. No model was contacted.`)
  }

  return (
    <div className="page-stack">
      <PageHeading eyebrow="FOUNDER AREA / REVIEW" title="Pending approvals" description="Review restricted educational prompts in the prototype queue." actions={<Badge tone="warning">Sample cases</Badge>} />
      <Notice tone="warning"><strong>Hard restrictions always apply.</strong> Approval cannot bypass provider safeguards, platform policy, or applicable law. Prohibited requests must remain blocked and cannot be approved.</Notice>
      {feedback && <p className="form-status" role="status">{feedback}</p>}
      <div className="approval-list">
        {approvals.map((item) => (
          <article className="panel approval-card" key={item.id}>
            <div className="approval-card-top">
              <div className="approval-category"><span className="list-icon"><Clock3 size={17} aria-hidden="true" /></span><div><strong>{item.category}</strong><span>{item.name} · {item.submittedAt}</span></div></div>
              <Badge tone={item.status === 'pending' ? 'warning' : item.status === 'approved' ? 'success' : 'neutral'}>{item.status}</Badge>
            </div>
            <p className="approval-prompt">“{item.prompt}”</p>
            {item.status === 'pending' ? (
              <div className="approval-actions">
                <button className="button button-subtle-danger" type="button" onClick={() => handleReview(item.id, 'rejected')}><X size={15} aria-hidden="true" /> Reject</button>
                <button className="button button-subtle-primary" type="button" onClick={() => handleReview(item.id, 'approved')}><Check size={15} aria-hidden="true" /> Approve sample</button>
              </div>
            ) : (
              <p className="review-result"><Ban size={14} aria-hidden="true" /> Prototype review only. Approval does not trigger generation.</p>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}

export default ApprovalsPage