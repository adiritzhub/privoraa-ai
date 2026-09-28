import { LogOut, ShieldCheck, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge, Notice, PageHeading } from '../components/Ui.jsx'
import { useAuth } from '../hooks/useAuth.js'

function ProfilePage() {
  const { user, authMode, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    try {
      await signOut()
      navigate('/', { replace: true })
    } catch {
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="page-stack profile-page">
      <PageHeading eyebrow="ACCOUNT" title="Your profile" description="Review the active account session." />
      <Notice tone={authMode === 'demo' ? 'warning' : 'info'}>{authMode === 'demo' ? 'This is a UI-only demo session. It is not a verified identity and does not secure API or server resources.' : 'This session is managed by Supabase Auth. Protected backend operations must still enforce authorization server-side.'}</Notice>
      <section className="panel profile-panel">
        <div className="profile-avatar"><UserRound size={25} aria-hidden="true" /></div>
        <div className="profile-identity"><h2>{user.displayName}</h2><p>{user.email}</p></div>
        <div className="profile-fields">
          <div><span>Role</span><Badge>{user.role}</Badge></div>
          <div><span>Permission state</span><Badge tone={user.permissionState === 'normal' ? 'success' : 'warning'}>{user.permissionState}</Badge></div>
          <div><span>Session type</span><Badge>{authMode}</Badge></div>
        </div>
        <div className="profile-footnote"><ShieldCheck size={16} aria-hidden="true" /><span>Session tokens remain managed by the Supabase client and are not exposed through this profile.</span></div>
        <button className="button button-secondary profile-logout" type="button" onClick={handleSignOut}><LogOut size={15} aria-hidden="true" /> Log out</button>
      </section>
    </div>
  )
}

export default ProfilePage