import { useAppState } from '../hooks/useAppState.js'
import { Badge, Notice, PageHeading } from '../components/Ui.jsx'

function UsersPage() {
  const { users, updateUserPermission, updateUserRole } = useAppState()

  return (
    <div className="page-stack">
      <PageHeading eyebrow="FOUNDER AREA / ACCESS" title="User management" description="Manage prototype roles and capabilities." actions={<Badge tone="warning">Sample accounts</Badge>} />
      <Notice tone="warning">Permission changes are in-memory preview state. Enforce all identity, role, and access rules on the server before production.</Notice>
      <section className="panel table-panel">
        <div className="table-scroll">
          <table className="data-table user-table">
            <thead><tr><th scope="col">User</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Can generate</th><th scope="col">Can request review</th></tr></thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td><div className="table-user"><span className="avatar avatar-small">{user.name.split(' ').map((part) => part[0]).join('')}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></div></td>
                  <td><label className="visually-hidden" htmlFor={`role-${user.id}`}>Role for {user.name}</label><select id={`role-${user.id}`} value={user.role} onChange={(event) => updateUserRole(user.id, event.target.value)}><option value="member">Member</option><option value="educator">Educator</option><option value="founder">Founder</option></select></td>
                  <td><Badge tone={user.status === 'active' ? 'success' : 'neutral'}>{user.status}</Badge></td>
                  <td><label className="check-control"><input type="checkbox" checked={user.permissions.generate} onChange={(event) => updateUserPermission(user.id, 'generate', event.target.checked)} /><span>Allowed</span></label></td>
                  <td><label className="check-control"><input type="checkbox" checked={user.permissions.submitForReview} onChange={(event) => updateUserPermission(user.id, 'submitForReview', event.target.checked)} /><span>Allowed</span></label></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="table-note">Edits reset when this page is reloaded. Example users are not real accounts.</p>
      </section>
    </div>
  )
}

export default UsersPage