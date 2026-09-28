import { useEffect, useState } from 'react'
import { Badge, EmptyState, Notice, PageHeading } from '../components/Ui.jsx'
import { useAuth } from '../hooks/useAuth.js'

function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    import('../services/founderService.js')
      .then(({ founderService }) => founderService.listUsers())
      .then((profiles) => { if (active) setUsers(profiles) })
      .catch((loadError) => {
        if (active) setError(loadError?.safe ? loadError.message : 'User access could not be loaded.')
      })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [])

  async function updateAccess(profile, field, value) {
    const nextProfile = {
      ...profile,
      role: field === 'role' ? value : profile.role,
      permission_state: field === 'permission_state' ? value : profile.permission_state,
    }
    setBusyId(profile.id)
    setError('')
    try {
      const { founderService } = await import('../services/founderService.js')
      await founderService.updateUserAccess({
        userId: nextProfile.id,
        role: nextProfile.role,
        permissionState: nextProfile.permission_state,
      })
      setUsers((current) => current.map((item) => item.id === profile.id ? nextProfile : item))
    } catch (updateError) {
      setError(updateError?.safe ? updateError.message : 'Access change could not be saved. Refresh and try again.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="page-stack">
      <PageHeading eyebrow="FOUNDER AREA / ACCESS" title="User management" description="Manage trusted roles and permission states through Founder-authorized database operations." actions={<Badge tone="success">Server checked</Badge>} />
      <Notice tone="warning">Changes are reauthorized by the database RPC. Self-promotion and self-unsuspension are denied server-side; the controls below are not the security boundary.</Notice>
      {error && <p className="form-status error-status" role="alert">{error}</p>}
      <section className="panel table-panel">
        {loading ? (
          <div className="panel"><EmptyState title="Loading user profiles">Verifying Founder access and reading trusted profile data…</EmptyState></div>
        ) : users.length === 0 ? (
          <EmptyState title="No profiles found">Profiles are created by the trusted Auth signup trigger.</EmptyState>
        ) : (
          <div className="table-scroll">
            <table className="data-table user-table">
              <thead><tr><th scope="col">Profile ID</th><th scope="col">Role</th><th scope="col">Permission state</th><th scope="col">Updated</th></tr></thead>
              <tbody>
                {users.map((profile) => {
                  const isSelf = profile.id === currentUser?.id
                  const disabled = isSelf || Boolean(busyId)
                  return (
                    <tr key={profile.id}>
                      <td><div className="table-user"><span className="avatar avatar-small">{profile.role === 'founder' ? 'F' : 'U'}</span><span><strong>{profile.id}</strong><small>{isSelf ? 'Current account · cannot edit self' : 'Trusted database profile'}</small></span></div></td>
                      <td><label className="visually-hidden" htmlFor={`role-${profile.id}`}>Role for profile {profile.id}</label><select id={`role-${profile.id}`} value={profile.role} disabled={disabled} onChange={(event) => updateAccess(profile, 'role', event.target.value)}><option value="user">User</option><option value="founder">Founder</option></select></td>
                      <td><label className="visually-hidden" htmlFor={`permission-${profile.id}`}>Permission state for profile {profile.id}</label><select id={`permission-${profile.id}`} value={profile.permission_state} disabled={disabled} onChange={(event) => updateAccess(profile, 'permission_state', event.target.value)}><option value="normal">Normal</option><option value="restricted">Restricted</option><option value="suspended">Suspended</option></select></td>
                      <td>{profile.updated_at ? new Date(profile.updated_at).toLocaleString() : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="table-note">No credentials are displayed. Founder changes use the protected `set_profile_access` RPC.</p>
      </section>
    </div>
  )
}

export default UsersPage
