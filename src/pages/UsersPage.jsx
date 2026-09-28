import { useAppState } from '../hooks/useAppState.js'
import { Badge, Notice, PageHeading } from '../components/Ui.jsx'

function UsersPage() {
  const { users, updateUserPermissionState, updateUserRole } = useAppState()

  return (
    <div className="page-stack">
      <PageHeading eyebrow="FOUNDER AREA / ACCESS" title="User management" description="Manage prototype roles and capabilities." actions={<Badge tone="warning">Sample accounts</Badge>} />
      <Notice tone="warning">Permission changes are in-memory preview state. Enforce all identity, role, and access rules on the server before production.</Notice>
      <section className="panel table-panel">
        <div className="table-scroll">
          <table className="data-table user-table">
            <thead><tr><th scope="col">User</th><th scope="col">Role</th><th scope="col">Permission state</th></tr></thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td><div className="table-user"><span className="avatar avatar-small">{user.name.split(' ').map((part) => part[0]).join('')}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></div></td>
                  <td><label className="visually-hidden" htmlFor={`role-${user.id}`}>Role for {user.name}</label><select id={`role-${user.id}`} value={user.role} onChange={(event) => updateUserRole(user.id, event.target.value)}><option value="user">User</option><option value="founder">Founder</option></select></td>
                  <td><label className="visually-hidden" htmlFor={`permission-${user.id}`}>Permission state for {user.name}</label><select id={`permission-${user.id}`} value={user.permissionState} onChange={(event) => updateUserPermissionState(user.id, event.target.value)}><option value="normal">Normal</option><option value="restricted">Restricted</option><option value="suspended">Suspended</option></select></td>
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