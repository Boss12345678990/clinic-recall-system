import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.jsx';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import AppLayout from './components/AppLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import TodayPage from './pages/TodayPage.jsx';
import PatientsPage from './pages/PatientsPage.jsx';
import PatientFormPage from './pages/PatientFormPage.jsx';
import PatientDetailPage from './pages/PatientDetailPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import UsersPage from './pages/UsersPage.jsx';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<TodayPage />} />
            <Route path="patients" element={<PatientsPage />} />
            <Route path="patients/new" element={<PatientFormPage />} />
            <Route path="patients/:id" element={<PatientDetailPage />} />
            <Route path="patients/:id/edit" element={<PatientFormPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route
              path="settings"
              element={
                <ProtectedRoute role="ADMIN">
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="users"
              element={
                <ProtectedRoute role="ADMIN">
                  <UsersPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
