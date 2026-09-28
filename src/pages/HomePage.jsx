import { ArrowRight, BookOpenCheck, Clock3, ImagePlus, ShieldCheck, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeading } from '../components/Ui.jsx'

function HomePage() {
  return (
    <div className="page-stack">
      <section className="welcome-panel">
        <div className="welcome-copy">
          <p className="eyebrow"><span className="eyebrow-mark" /> YOUR EDUCATIONAL IMAGE STUDIO</p>
          <h1>Create.<br />Learn. Imagine.</h1>
          <p className="welcome-description">
            Turn a curious question into a visual idea. A thoughtful creative space for learning, exploring, and seeing things differently.
          </p>
          <Link className="button button-primary" to="/generate">
            <ImagePlus size={17} aria-hidden="true" /> Start creating <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <p className="welcome-footnote"><Sparkles size={14} aria-hidden="true" /> Image generation is being prepared</p>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="art-frame art-frame-back" />
          <div className="art-frame art-frame-front">
            <div className="art-grid" />
            <div className="art-contour contour-one" />
            <div className="art-contour contour-two" />
            <div className="art-terrain art-terrain-back" />
            <div className="art-terrain art-terrain-front" />
            <span className="art-label">IDEA STUDY <i>01</i></span>
          </div>
          <span className="art-caption">A canvas for curious minds</span>
        </div>
      </section>

      <PageHeading
        eyebrow="YOUR SPACE"
        title="A place to begin"
        description="Pick up where your imagination takes you."
      />
      <div className="feature-grid">
        <Link className="feature-card" to="/generate">
          <span className="feature-icon feature-icon-purple"><ImagePlus size={20} aria-hidden="true" /></span>
          <span className="feature-card-title">Create an image <ArrowRight size={16} aria-hidden="true" /></span>
          <span className="feature-card-copy">Shape a prompt and set up your canvas.</span>
        </Link>
        <Link className="feature-card" to="/history">
          <span className="feature-icon feature-icon-cyan"><Clock3 size={20} aria-hidden="true" /></span>
          <span className="feature-card-title">Your history <ArrowRight size={16} aria-hidden="true" /></span>
          <span className="feature-card-copy">Completed work will be collected here.</span>
        </Link>
        <Link className="feature-card" to="/founder">
          <span className="feature-icon feature-icon-amber"><ShieldCheck size={20} aria-hidden="true" /></span>
          <span className="feature-card-title">Founder tools <ArrowRight size={16} aria-hidden="true" /></span>
          <span className="feature-card-copy">Review the platform controls preview.</span>
        </Link>
      </div>

      <section className="learning-band">
        <span className="learning-icon"><BookOpenCheck size={19} aria-hidden="true" /></span>
        <div><strong>Made for learning</strong><p>Explore ideas responsibly. Provider safeguards and applicable law always take priority over approval workflows.</p></div>
      </section>
    </div>
  )
}

export default HomePage