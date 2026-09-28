import { useState } from 'react'
import {
  Activity,
  ChevronDown,
  CircleHelp,
  Clock3,
  Home,
  ImagePlus,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Settings2,
  Sparkles,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'

const workspaceLinks = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/generate', label: 'Create image', icon: ImagePlus },
  { to: '/history', label: 'History', icon: Clock3 },
]

const founderLinks = [
  { to: '/founder', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/founder/approvals', label: 'Approvals', icon: ListChecks },
  { to: '/founder/users', label: 'Users', icon: UsersRound },
  { to: '/founder/activity', label: 'Activity', icon: Activity },
  { to: '/founder/settings', label: 'Settings', icon: Settings2 },
]

function NavigationLink({ to, label, icon: Icon, end }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}>
      <Icon size={18} aria-hidden="true" />
      <span>{label}</span>
    </NavLink>
  )
}

function UserMenu() {
  const [open, setOpen] = useState(false)
  const { user, authMode, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    setOpen(false)
    navigate('/')
  }

  const initial = user?.displayName?.slice(0, 1).toUpperCase() ?? 'G'

  return (
    <div className="user-menu-wrap">
      <button
        type="button"
        className="user-menu-trigger"
        aria-expanded={open}
        aria-controls="user-menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="avatar">{initial}</span>
        <span className="user-menu-label"><strong>{user?.displayName ?? 'Guest'}</strong><small>{user ? `${user.role} · ${user.permissionState}` : 'Not signed in'}</small></span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="user-menu-popover" id="user-menu">
          {user ? (
            <>
              <Link to="/profile" onClick={() => setOpen(false)}><UserRound size={15} aria-hidden="true" /> Profile</Link>
              {user.role === 'founder' && <Link to="/founder" onClick={() => setOpen(false)}>Founder area</Link>}
              <button type="button" onClick={handleSignOut}><LogOut size={15} aria-hidden="true" /> Log out</button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setOpen(false)}>Log in</Link>
              <Link to="/register" onClick={() => setOpen(false)}>Create account</Link>
            </>
          )}
          <span className="menu-auth-mode">{authMode} session · UI only</span>
        </div>
      )}
    </div>
  )
}

function AppLayout() {
  const location = useLocation()
  const { authMode } = useAuth()
  const isFounder = location.pathname.startsWith('/founder')

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Main navigation">
        <Link className="brand-lockup" to="/" aria-label="Privoraa AI home">
          <span className="brand-mark"><Sparkles size={19} aria-hidden="true" /></span>
          <span className="brand-name">Privoraa <b>AI</b></span>
        </Link>
        <nav className="sidebar-nav">
          <div className="nav-group">
            <p className="nav-group-label">Workspace</p>
            {workspaceLinks.map((item) => <NavigationLink key={item.to} {...item} />)}
          </div>
          <div className="nav-group">
            <p className="nav-group-label">Founder tools</p>
            {founderLinks.map((item) => <NavigationLink key={item.to} {...item} />)}
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="preview-status"><span /> Frontend preview</div>
          <p>Admin controls are prototype-only and do not enforce access.</p>
          <a href="mailto:hello@privoraa.ai"><CircleHelp size={15} aria-hidden="true" /> Help & feedback</a>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Privoraa AI</span><span className="breadcrumb-divider">/</span>
            <span>{isFounder ? 'Founder area' : 'Workspace'}</span>
          </div>
          <div className="topbar-actions">
            <span className="model-status"><span /> Model not connected</span>
            <span className="auth-mode-indicator">{authMode} auth</span>
            <UserMenu />
          </div>
        </header>
        <main className="page-content"><Outlet /></main>
        <footer className="app-footer">
          <span>Privoraa AI <span className="footer-dot">·</span> Create. Learn. Imagine.</span>
          <span>Educational image studio</span>
        </footer>
      </div>
    </div>
  )
}

export default AppLayout