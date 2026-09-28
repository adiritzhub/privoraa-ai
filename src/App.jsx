import { Route, Routes } from 'react-router-dom'
import './App.css'
import { RequireAuthenticated, RequireFounder, RequireWorkspaceAccess } from './components/RouteGuards.jsx'
import AppLayout from './layouts/AppLayout.jsx'
import AccessDeniedPage from './pages/AccessDeniedPage.jsx'
import ActivityPage from './pages/ActivityPage.jsx'
import ApprovalsPage from './pages/ApprovalsPage.jsx'
import AuthPage from './pages/AuthPage.jsx'
import FounderDashboardPage from './pages/FounderDashboardPage.jsx'
import GeneratePage from './pages/GeneratePage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'
import HomePage from './pages/HomePage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import UsersPage from './pages/UsersPage.jsx'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<AuthPage />} />
        <Route path="register" element={<AuthPage />} />
        <Route path="access-denied" element={<AccessDeniedPage />} />
        <Route element={<RequireWorkspaceAccess />}>
          <Route path="generate" element={<GeneratePage />} />
          <Route path="history" element={<HistoryPage />} />
        </Route>
        <Route element={<RequireAuthenticated />}>
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route element={<RequireFounder />}>
          <Route path="founder" element={<FounderDashboardPage />} />
          <Route path="founder/approvals" element={<ApprovalsPage />} />
          <Route path="founder/users" element={<UsersPage />} />
          <Route path="founder/settings" element={<SettingsPage />} />
          <Route path="founder/activity" element={<ActivityPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App