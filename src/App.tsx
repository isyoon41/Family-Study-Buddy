import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Index from './pages/Index';
import ChildSelect from './pages/child/ChildSelect';
import ChildPinLogin from './pages/child/ChildPinLogin';
import ChildDashboard from './pages/child/ChildDashboard';
import ChildUpload from './pages/child/ChildUpload';
import ChildBooks from './pages/child/ChildBooks';
import ParentLayout from './pages/parent/ParentLayout';
import ParentDashboard from './pages/parent/ParentDashboard';
import Children from './pages/parent/Children';
import Schedule from './pages/parent/Schedule';
import Reports from './pages/parent/Reports';
import SecurityLog from './pages/parent/SecurityLog';
import Settings from './pages/parent/Settings';

function ChildGuard({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  if (role !== 'child') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ParentGuard({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  if (role !== 'parent') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/child" element={<ChildSelect />} />
      <Route path="/child/pin/:childId" element={<ChildPinLogin />} />
      <Route path="/child/dashboard" element={<ChildGuard><ChildDashboard /></ChildGuard>} />
      <Route path="/child/upload" element={<ChildGuard><ChildUpload /></ChildGuard>} />
      <Route path="/child/books"  element={<ChildGuard><ChildBooks /></ChildGuard>} />

      <Route path="/parent" element={<ParentGuard><ParentLayout /></ParentGuard>}>
        <Route index element={<ParentDashboard />} />
        <Route path="children" element={<Children />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="reports" element={<Reports />} />
        <Route path="security" element={<SecurityLog />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
