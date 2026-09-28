import { Clock3, ImagePlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, PageHeading } from '../components/Ui.jsx'

function HistoryPage() {
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="YOUR WORKSPACE"
        title="Generation history"
        description="A private record of the images you create."
        actions={<Link className="button button-primary" to="/generate"><ImagePlus size={16} aria-hidden="true" /> New image</Link>}
      />
      <section className="panel history-panel">
        <div className="section-inline-heading"><div><span className="eyebrow">ALL ACTIVITY</span><h2>Recent images</h2></div><span className="subtle-label"><Clock3 size={14} aria-hidden="true" /> 0 items</span></div>
        <EmptyState title="Your history starts here">There are no generated images yet. Your history will appear here after the image model is connected.</EmptyState>
      </section>
    </div>
  )
}

export default HistoryPage