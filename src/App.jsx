import { Route, Routes } from 'react-router-dom'
import './App.css'
import AppLayout from './layouts/AppLayout.jsx'
import ApprovalsPage from './pages/ApprovalsPage.jsx'
import AuthPage from './pages/AuthPage.jsx'
import FounderDashboardPage from './pages/FounderDashboardPage.jsx'
import GeneratePage from './pages/GeneratePage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'
import HomePage from './pages/HomePage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import UsersPage from './pages/UsersPage.jsx'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="generate" element={<GeneratePage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="login" element={<AuthPage />} />
        <Route path="register" element={<AuthPage />} />
        <Route path="founder" element={<FounderDashboardPage />} />
        <Route path="founder/approvals" element={<ApprovalsPage />} />
        <Route path="founder/users" element={<UsersPage />} />
        <Route path="founder/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App