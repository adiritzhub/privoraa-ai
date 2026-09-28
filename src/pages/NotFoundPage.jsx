import { Link } from 'react-router-dom'
import { PageHeading } from '../components/Ui.jsx'

function NotFoundPage() {
  return (
    <div className="page-stack">
      <PageHeading eyebrow="404 / NOT FOUND" title="This page isn’t here" description="The address may have changed or the page may not exist." />
      <Link className="button button-primary not-found-link" to="/">Return to Privoraa AI</Link>
    </div>
  )
}

export default NotFoundPage