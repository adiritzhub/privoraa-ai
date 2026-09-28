import { useEffect, useState } from 'react'
import { ImagePlus, LockKeyhole, Ratio, Sparkles } from 'lucide-react'
import { EmptyState, Notice, PageHeading } from '../components/Ui.jsx'

const promptLimit = 6000
const aspectRatios = ['Square', 'Portrait', 'Landscape']

function GeneratePage() {
  const [categories, setCategories] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesError, setCategoriesError] = useState('')
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState('Square')
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [lastRequest, setLastRequest] = useState(null)

  useEffect(() => {
    let active = true
    import('../services/generationRequestService.js')
      .then(({ generationRequestService }) => generationRequestService.listAvailableCategories())
      .then((availableCategories) => {
        if (!active) return
        setCategories(availableCategories)
        setCategoryId((current) => current || availableCategories[0]?.id || '')
      })
      .catch((error) => {
        if (active) setCategoriesError(error?.safe ? error.message : 'Categories could not be loaded.')
      })
      .finally(() => {
        if (active) setCategoriesLoading(false)
      })

    return () => { active = false }
  }, [])

  async function handleGenerate(event) {
    event.preventDefault()
    setBusy(true)
    setStatus(null)
    setLastRequest(null)
    try {
      const { generationRequestService } = await import('../services/generationRequestService.js')
      const result = await generationRequestService.submit({ prompt, categoryId })
      setLastRequest(result)
      setStatus({ tone: 'info', message: result.message })
    } catch (error) {
      setStatus({
        tone: error?.code === 'quota_exceeded' ? 'warning' : 'danger',
        message: error?.safe ? error.message : 'Your request could not be submitted. Please try again.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="IMAGE STUDIO"
        title="Create an image"
        description="Describe what you want to explore. Each request is checked by the policy service before any future image-generation step."
      />
      <div className="studio-grid">
        <form className="panel prompt-panel" onSubmit={handleGenerate}>
          <div className="panel-heading">
            <div><span className="eyebrow">01 / YOUR IDEA</span><h2>Write a prompt</h2></div>
            <span className="panel-step">01</span>
          </div>
          <label className="field-label" htmlFor="image-prompt">Image description</label>
          <textarea
            id="image-prompt"
            className="prompt-input"
            value={prompt}
            maxLength={promptLimit}
            onChange={(event) => { setPrompt(event.target.value); setStatus('') }}
            placeholder="A layered botanical illustration showing how a seed grows into a sunflower, with a clean educational layout..."
            rows={8}
          />
          <div className="field-meta"><span>Be specific about subject, setting, and style.</span><span>{prompt.length} / {promptLimit}</span></div>

          <label className="field-label category-select-label" htmlFor="image-category">Educational category</label>
          <select
            id="image-category"
            className="auth-select category-select"
            value={categoryId}
            disabled={categoriesLoading || categories.length === 0}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">{categoriesLoading ? 'Loading categories…' : 'No categories available'}</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>

          <fieldset className="ratio-fieldset">
            <legend><Ratio size={15} aria-hidden="true" /> Canvas shape</legend>
            <div className="segmented-control">
              {aspectRatios.map((ratio) => (
                <button
                  key={ratio}
                  className={aspectRatio === ratio ? 'selected' : ''}
                  type="button"
                  aria-pressed={aspectRatio === ratio}
                  onClick={() => setAspectRatio(ratio)}
                >{ratio}</button>
              ))}
            </div>
          </fieldset>

          <Notice tone="warning">
            Policy classification runs before generation. The development classifier is deterministic and is not a substitute for production moderation; no image is generated in this release.
          </Notice>
          {categoriesError && <p className="form-status error-status" role="alert">{categoriesError}</p>}
          <button className="button button-primary generate-button" type="submit" disabled={!prompt.trim() || !categoryId || categoriesLoading || busy}>
            <Sparkles size={17} aria-hidden="true" /> {busy ? 'Submitting request…' : 'Submit image request'}
          </button>
          <p className="privacy-note"><LockKeyhole size={13} aria-hidden="true" /> Your prompt is sent to the Privoraa request service and stored for policy processing.</p>
          {status && <p className={`form-status ${status.tone === 'danger' ? 'error-status' : ''}`} role="status">{status.message}</p>}
        </form>

        <section className="panel preview-panel" aria-label="Image preview">
          <div className="panel-heading">
            <div><span className="eyebrow">02 / CANVAS</span><h2>Preview</h2></div>
            <span className="preview-format">{aspectRatio}</span>
          </div>
          <div className={`preview-canvas preview-${aspectRatio.toLowerCase()}`}>
            <div className="preview-corners" aria-hidden="true"><i /><i /><i /><i /></div>
            <div className="canvas-placeholder">
              <span className="canvas-icon"><ImagePlus size={22} aria-hidden="true" /></span>
              <strong>Your canvas is waiting</strong>
              <span>Requests are recorded, but image generation is not connected yet.</span>
            </div>
          </div>
          <div className="preview-footer"><span><span className="status-dot" /> Image model unavailable</span><span>No generated output</span></div>
        </section>
      </div>

      <section className="panel policy-flow-panel">
        <div className="section-inline-heading"><div><span className="eyebrow">REQUEST SAFETY</span><h2>Policy review</h2></div><span className="subtle-label">Classifier not connected</span></div>
        <div className="policy-flow-grid">
          <article className="policy-flow-item"><span className="policy-state policy-normal">Allowed</span><p>Policy approved → eligible for the future generation stage.</p></article>
          <article className="policy-flow-item"><span className="policy-state policy-restricted">Restricted</span><p>Additional review required → Founder approval queue → approve or reject.</p></article>
          <article className="policy-flow-item"><span className="policy-state policy-prohibited">Prohibited</span><p>Blocked. Cannot be approved or override provider safeguards or law.</p></article>
        </div>
        <p className="policy-flow-disclaimer">The backend stores the policy result and controls each state transition. No prompt is sent to an image model by this frontend.</p>
      </section>

      <section className="panel recent-panel">
        <div className="section-inline-heading"><div><span className="eyebrow">YOUR WORK</span><h2>Most recent request</h2></div><span className="subtle-label">No generated image</span></div>
        {lastRequest ? (
          <div className="request-receipt"><span className={`badge ${lastRequest.classification === 'prohibited' || lastRequest.state === 'failed' ? 'badge-danger' : lastRequest.classification === 'restricted' ? 'badge-warning' : 'badge-success'}`}>{lastRequest.classification === 'prohibited' ? 'Blocked by policy' : lastRequest.classification === 'restricted' ? 'Additional review required' : lastRequest.state === 'failed' ? 'Policy unavailable' : 'Policy approved'}</span><p>{lastRequest.message}</p><small>Request ID: {lastRequest.requestId}</small></div>
        ) : (
          <EmptyState title="No request submitted yet">Submitted requests will appear here with their processing status. Images are not generated in this release.</EmptyState>
        )}
      </section>
    </div>
  )
}

export default GeneratePage