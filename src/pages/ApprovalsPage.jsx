import { useEffect, useState } from 'react'
import { Ban, Check, Clock3, X } from 'lucide-react'
import { Badge, EmptyState, Notice, PageHeading } from '../components/Ui.jsx'

function ApprovalsPage() {
  const [approvals, setApprovals] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    import('../services/approvalService.js')
      .then(({ approvalService }) => approvalService.listPendingApprovals())
      .then((requests) => { if (active) setApprovals(requests) })
      .catch((loadError) => {
        if (active) setError(loadError?.safe ? loadError.message : 'Approval queue could not be loaded.')
      })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [refreshKey])

  async function handleReview(requestId, decision) {
    setBusyId(requestId)
    setError('')
    setFeedback('')
    try {
      const { approvalService } = await import('../services/approvalService.js')
      await approvalService.review({ requestId, decision })
      setFeedback(`Request ${decision}. No image was generated.`)
      setRefreshKey((key) => key + 1)
    } catch (reviewError) {
      setError(reviewError?.safe ? reviewError.message : 'The decision could not be saved. Please refresh the queue and try again.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="page-stack">
      <PageHeading eyebrow="FOUNDER AREA / REVIEW" title="Pending approvals" description="Review restricted requests from the protected database queue." actions={<Badge tone="success">Server checked</Badge>} />
      <Notice tone="warning"><strong>Hard restrictions always apply.</strong> Approval cannot bypass provider safeguards, platform policy, or applicable law. Prohibited requests are blocked and cannot enter this queue.</Notice>
      {error && <p className="form-status error-status" role="alert">{error}</p>}
      {feedback && <p className="form-status" role="status">{feedback}</p>}
      {loading ? (
        <section className="panel"><EmptyState title="Loading approval queue">Verifying Founder access and reading pending restricted requests…</EmptyState></section>
      ) : approvals.length === 0 ? (
        <section className="panel"><EmptyState title="No requests awaiting review">Restricted requests will appear after trusted policy classification.</EmptyState></section>
      ) : (
        <div className="approval-list">
          {approvals.map((request) => (
            <article className="panel approval-card" key={request.id}>
              <div className="approval-card-top">
                <div className="approval-category"><span className="list-icon"><Clock3 size={17} aria-hidden="true" /></span><div><strong>{request.category}</strong><span>Request {request.id}</span></div></div>
                <Badge tone="warning">restricted · pending</Badge>
              </div>
              <p className="approval-prompt">“{request.prompt}”</p>
              <div className="approval-actions">
                <button className="button button-subtle-danger" type="button" disabled={Boolean(busyId)} onClick={() => handleReview(request.id, 'rejected')}><X size={15} aria-hidden="true" /> {busyId === request.id ? 'Saving…' : 'Reject'}</button>
                <button className="button button-subtle-primary" type="button" disabled={Boolean(busyId)} onClick={() => handleReview(request.id, 'approved')}><Check size={15} aria-hidden="true" /> {busyId === request.id ? 'Saving…' : 'Approve'}</button>
              </div>
              <p className="review-result"><Ban size={14} aria-hidden="true" /> Approval records the decision only. It does not generate an image or override provider restrictions.</p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

export default ApprovalsPage
