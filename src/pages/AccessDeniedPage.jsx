import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'

function AccessDeniedPage() {
  const { user } = useAuth()
  const location = useLocation()
  const suspended = location.state?.reason === 'suspended' || user?.permissionState === 'suspended'
  const restrictedFounder = location.state?.reason === 'restricted'
  const invalidPermission = location.state?.reason === 'permission'

  return (
    <div className="access-denied-wrap">
      <section className="panel access-denied-panel">
        <span className="access-denied-icon"><ShieldAlert size={23} aria-hidden="true" /></span>
        <p className="eyebrow">ACCESS CONTROL</p>
        <h1>{suspended ? 'This account is suspended' : restrictedFounder ? 'Founder access is restricted' : invalidPermission ? 'Account permission unavailable' : 'Founder access required'}</h1>
        <p>{suspended ? 'Protected workspace features are unavailable for this account. Contact the platform team if you think this is a mistake.' : restrictedFounder ? 'This founder preview account is restricted. Only a normal founder account may access the founder area.' : invalidPermission ? 'This account does not have an active permission state for protected workspace features.' : 'Your current account does not have permission to open this founder area.'}</p>
        <p className="security-disclaimer">This screen is a frontend preview only. A backend must enforce all access decisions.</p>
        <Link className="button button-secondary" to={user ? '/profile' : '/'}><ArrowLeft size={15} aria-hidden="true" /> {user ? 'Review account' : 'Back to home'}</Link>
      </section>
    </div>
  )
}

export default AccessDeniedPage