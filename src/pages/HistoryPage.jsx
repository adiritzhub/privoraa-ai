import { useEffect, useState } from 'react'
import { Clock3, ImagePlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, EmptyState, PageHeading } from '../components/Ui.jsx'

function requestStateLabel(request) {
  if (request.classification === 'prohibited' || request.request_state === 'blocked') return 'Blocked'
  if (request.request_state === 'rejected') return 'Rejected'
  if (request.classification === 'restricted' && ['pending', 'pending_approval'].includes(request.request_state)) return 'Pending approval'
  if (request.classification === 'allowed' && request.request_state === 'eligible') return 'Policy approved'
  if (request.request_state === 'pending' || request.request_state === 'pending_classification') return 'Pending classification'
  if (request.request_state === 'failed') return 'Policy unavailable'
  return request.request_state.replaceAll('_', ' ')
}

function HistoryPage() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    import('../services/generationRequestService.js')
      .then(({ generationRequestService }) => generationRequestService.listMyHistory())
      .then((items) => { if (active) setRequests(items) })
      .catch((loadError) => {
        if (active) setError(loadError?.safe ? loadError.message : 'Your request history could not be loaded.')
      })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [])

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="YOUR WORKSPACE"
        title="Generation history"
        description="A private record of the images you create."
        actions={<Link className="button button-primary" to="/generate"><ImagePlus size={16} aria-hidden="true" /> New image</Link>}
      />
      <section className="panel history-panel">
        <div className="section-inline-heading"><div><span className="eyebrow">YOUR REQUESTS</span><h2>Recent activity</h2></div><span className="subtle-label"><Clock3 size={14} aria-hidden="true" /> {requests.length} items</span></div>
        {error && <p className="form-status error-status" role="alert">{error}</p>}
        {loading ? (
          <EmptyState title="Loading your history">Checking your authenticated request history…</EmptyState>
        ) : requests.length === 0 ? (
          <EmptyState title="Your history starts here">Submitted requests will appear here. No image is generated until the backend model is connected.</EmptyState>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th scope="col">Prompt</th><th scope="col">Category</th><th scope="col">Status</th><th scope="col">Submitted</th></tr></thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.prompt}</td>
                    <td>{request.category}</td>
                    <td><Badge tone={request.request_state === 'blocked' || request.request_state === 'rejected' || request.request_state === 'failed' ? 'danger' : request.classification === 'restricted' || request.request_state === 'pending' || request.request_state === 'pending_classification' ? 'warning' : 'neutral'}>{requestStateLabel(request)}</Badge></td>
                    <td>{new Date(request.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export default HistoryPage