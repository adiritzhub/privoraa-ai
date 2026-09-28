import { useEffect, useState } from 'react'
import { Check, Power, Save, ShieldCheck, Tags } from 'lucide-react'
import { Badge, Notice, PageHeading } from '../components/Ui.jsx'

function SettingsPage() {
  const [settings, setSettings] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    let active = true
    import('../services/founderService.js')
      .then(async ({ founderService }) => Promise.all([
        founderService.getGenerationSettings(),
        founderService.listCategories(),
      ]))
      .then(([nextSettings, nextCategories]) => {
        if (!active) return
        setSettings({
          generationEnabled: nextSettings.global_generation_enabled,
          dailyLimit: nextSettings.daily_generation_limit,
        })
        setCategories(nextCategories)
      })
      .catch((loadError) => {
        if (active) setError(loadError?.safe ? loadError.message : 'Founder settings could not be loaded.')
      })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [])

  function updateLimit(value) {
    const nextLimit = Number(value)
    if (Number.isInteger(nextLimit) && nextLimit >= 1 && nextLimit <= 10000) {
      setSettings((current) => ({ ...current, dailyLimit: nextLimit }))
      setFeedback('')
    }
  }

  async function saveGenerationSettings() {
    if (!settings) return
    setSaving(true)
    setError('')
    setFeedback('')
    try {
      const { founderService } = await import('../services/founderService.js')
      await founderService.updateGenerationSettings({ enabled: settings.generationEnabled, dailyLimit: settings.dailyLimit })
      setFeedback('Generation settings saved to the protected database.')
    } catch (saveError) {
      setError(saveError?.safe ? saveError.message : 'Generation settings could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function updateCategory(category) {
    const enabled = !category.enabled
    setError('')
    setFeedback('')
    try {
      const { founderService } = await import('../services/founderService.js')
      await founderService.updateCategory({
        categoryId: category.id,
        enabled,
        configuration: category.configuration,
      })
      setCategories((current) => current.map((item) => item.id === category.id ? { ...item, enabled } : item))
      setFeedback(`Category ${enabled ? 'enabled' : 'disabled'} in the database.`)
    } catch (saveError) {
      setError(saveError?.safe ? saveError.message : 'Category update could not be saved.')
    }
  }

  return (
    <div className="page-stack">
      <PageHeading eyebrow="FOUNDER AREA / CONFIGURATION" title="Platform settings" description="Global controls enforced by protected database operations." actions={<Badge tone="success">Server managed</Badge>} />
      <Notice tone="warning">Founder RPCs reauthorize every write. The global switch and category availability are checked again by the request RPC. Provider safeguards and applicable law remain mandatory.</Notice>
      {error && <p className="form-status error-status" role="alert">{error}</p>}
      {feedback && <p className="form-status" role="status">{feedback}</p>}
      {loading ? (
        <section className="panel"><p className="quiet-empty" role="status">Loading protected settings…</p></section>
      ) : settings && (
        <>
          <section className="panel settings-section">
            <div className="settings-section-heading"><span className="settings-icon"><Power size={18} aria-hidden="true" /></span><div><h2>Generation access</h2><p>Global server-side switch for accepting new requests.</p></div></div>
            <div className="settings-control-row">
              <div><strong>Allow image requests</strong><span>Model provider is not connected; enabling does not generate images.</span></div>
              <button
                type="button"
                className={`switch ${settings.generationEnabled ? 'switch-on' : ''}`}
                role="switch"
                aria-checked={settings.generationEnabled}
                aria-label="Allow image requests"
                disabled={saving}
                onClick={() => { setSettings((current) => ({ ...current, generationEnabled: !current.generationEnabled })); setFeedback('') }}
              ><span /></button>
            </div>
          </section>

          <section className="panel settings-section">
            <div className="settings-section-heading"><span className="settings-icon settings-icon-cyan"><Tags size={18} aria-hidden="true" /></span><div><h2>Prompt categories</h2><p>Enabled categories can be selected for request submission.</p></div></div>
            <div className="category-list">
              {categories.map((category) => (
                <label className="category-row" key={category.id}><span>{category.name}</span><input type="checkbox" checked={category.enabled} disabled={saving} onChange={() => updateCategory(category)} /><span className="category-check" aria-hidden="true"><Check size={13} /></span></label>
              ))}
            </div>
          </section>

          <section className="panel settings-section">
            <div className="settings-section-heading"><span className="settings-icon settings-icon-amber"><ShieldCheck size={18} aria-hidden="true" /></span><div><h2>Generation limits</h2><p>Transactional per-user daily request cap.</p></div></div>
            <label className="limit-input" htmlFor="daily-limit"><span>Requests per user / day</span><input id="daily-limit" type="number" min="1" max="10000" value={settings.dailyLimit} disabled={saving} onChange={(event) => updateLimit(event.target.value)} /></label>
          </section>

          <div className="settings-save-row"><span className="settings-save-copy">Changes are persisted only after a successful Founder RPC.</span><button className="button button-secondary" type="button" disabled={saving} onClick={saveGenerationSettings}><Save size={15} aria-hidden="true" /> {saving ? 'Saving…' : 'Save generation settings'}</button></div>
        </>
      )}
    </div>
  )
}

export default SettingsPage
