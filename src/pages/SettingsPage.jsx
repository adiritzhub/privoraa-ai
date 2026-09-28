import { useState } from 'react'
import { Check, Power, Save, ShieldCheck, Tags } from 'lucide-react'
import { Badge, Notice, PageHeading } from '../components/Ui.jsx'
import { useAppState } from '../hooks/useAppState.js'

function SettingsPage() {
  const { settings, setSettings, toggleCategory } = useAppState()
  const [saved, setSaved] = useState(false)

  function updateLimit(value) {
    const nextLimit = Number(value)
    if (Number.isInteger(nextLimit) && nextLimit >= 1 && nextLimit <= 1000) {
      setSettings((current) => ({ ...current, dailyLimit: nextLimit }))
      setSaved(false)
    }
  }

  return (
    <div className="page-stack">
      <PageHeading eyebrow="FOUNDER AREA / CONFIGURATION" title="Platform settings" description="Configure the intended platform defaults in this local preview." actions={<Badge tone="warning">Prototype state</Badge>} />
      <Notice tone="warning">These settings are not saved to a server and do not change model behavior. Backend authorization and provider-level safeguards remain mandatory.</Notice>

      <section className="panel settings-section">
        <div className="settings-section-heading"><span className="settings-icon"><Power size={18} aria-hidden="true" /></span><div><h2>Generation access</h2><p>Global switch for the planned generation service.</p></div></div>
        <div className="settings-control-row">
          <div><strong>Allow image generation</strong><span>The model is currently disconnected.</span></div>
          <button
            type="button"
            className={`switch ${settings.generationEnabled ? 'switch-on' : ''}`}
            role="switch"
            aria-checked={settings.generationEnabled}
            aria-label="Allow image generation in prototype settings"
            onClick={() => { setSettings((current) => ({ ...current, generationEnabled: !current.generationEnabled })); setSaved(false) }}
          ><span /></button>
        </div>
      </section>

      <section className="panel settings-section">
        <div className="settings-section-heading"><span className="settings-icon settings-icon-cyan"><Tags size={18} aria-hidden="true" /></span><div><h2>Prompt categories</h2><p>Choose the educational categories offered in the planned studio.</p></div></div>
        <div className="category-list">
          {settings.categories.map((category) => (
            <label className="category-row" key={category.name}><span>{category.name}</span><input type="checkbox" checked={category.enabled} onChange={() => { toggleCategory(category.name); setSaved(false) }} /><span className="category-check" aria-hidden="true"><Check size={13} /></span></label>
          ))}
        </div>
      </section>

      <section className="panel settings-section">
        <div className="settings-section-heading"><span className="settings-icon settings-icon-amber"><ShieldCheck size={18} aria-hidden="true" /></span><div><h2>Generation limits</h2><p>Intended per-user daily cap. Must be enforced server-side.</p></div></div>
        <label className="limit-input" htmlFor="daily-limit"><span>Images per user / day</span><input id="daily-limit" type="number" min="1" max="1000" value={settings.dailyLimit} onChange={(event) => updateLimit(event.target.value)} /></label>
      </section>

      <div className="settings-save-row"><span className="settings-save-copy">{saved ? 'Preview settings updated for this session.' : 'Changes only affect this browser session.'}</span><button className="button button-secondary" type="button" onClick={() => setSaved(true)}><Save size={15} aria-hidden="true" /> Save preview settings</button></div>
    </div>
  )
}

export default SettingsPage