import { useState } from 'react'
import { ImagePlus, LockKeyhole, Ratio, Sparkles } from 'lucide-react'
import { EmptyState, Notice, PageHeading } from '../components/Ui.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { useAppState } from '../hooks/useAppState.js'
import { generationService } from '../services/generationService.js'
import { policyService } from '../services/policyService.js'

const promptLimit = 600
const aspectRatios = ['Square', 'Portrait', 'Landscape']

function GeneratePage() {
  const { user } = useAuth()
  const { settings } = useAppState()
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState('Square')
  const [status, setStatus] = useState('')

  async function handleGenerate(event) {
    event.preventDefault()
    const classification = await policyService.classifyPrompt(prompt)
    if (classification.status !== 'available') {
      setStatus(generationService.getStatus({
        permissionState: user.permissionState,
        generationEnabled: settings.generationEnabled,
      }).message)
      return
    }

    setStatus(generationService.getStatus({
      permissionState: user.permissionState,
      generationEnabled: settings.generationEnabled,
    }).message)
  }

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="IMAGE STUDIO"
        title="Create an image"
        description="Describe what you want to explore. Your prompt stays in this browser preview."
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

          <Notice>
            No prompt is currently classified or submitted. Prohibited requests must remain blocked; founder approval cannot override provider safeguards or applicable law.
          </Notice>
          <button className="button button-primary generate-button" type="submit" disabled={!prompt.trim()}>
            <Sparkles size={17} aria-hidden="true" /> Generate image
          </button>
          <p className="privacy-note"><LockKeyhole size={13} aria-hidden="true" /> No prompt is sent or stored in this preview.</p>
          {status && <p className="form-status" role="status">{status}</p>}
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
              <span>A model connection is needed to create an image.</span>
            </div>
          </div>
          <div className="preview-footer"><span><span className="status-dot" /> Model connection pending</span><span>Preview only</span></div>
        </section>
      </div>

      <section className="panel policy-flow-panel">
        <div className="section-inline-heading"><div><span className="eyebrow">PLANNED SAFETY FLOW</span><h2>Policy review</h2></div><span className="subtle-label">Backend not connected</span></div>
        <div className="policy-flow-grid">
          <article className="policy-flow-item"><span className="policy-state policy-normal">Normal</span><p>Prompt → classification → automatic generation.</p></article>
          <article className="policy-flow-item"><span className="policy-state policy-restricted">Restricted</span><p>Prompt → classification → Founder approval queue → approve or reject.</p></article>
          <article className="policy-flow-item"><span className="policy-state policy-prohibited">Prohibited</span><p>Blocked. Cannot be approved or override provider safeguards or law.</p></article>
        </div>
        <p className="policy-flow-disclaimer">This describes the intended backend workflow only. No prompt is classified or routed in this frontend.</p>
      </section>

      <section className="panel recent-panel">
        <div className="section-inline-heading"><div><span className="eyebrow">YOUR WORK</span><h2>Recent generations</h2></div><span className="subtle-label">This session</span></div>
        <EmptyState title="Nothing created yet">When image generation is connected, your completed work will appear here.</EmptyState>
      </section>
    </div>
  )
}

export default GeneratePage