import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import WBSEditor from './pages/WBSEditor';
import Programme from './pages/Programme';
import Mappings from './pages/Mappings';
import Costs from './pages/Costs';
import Claims from './pages/Claims';
import Cashflow from './pages/Cashflow';
import Resources from './pages/Resources';
import Settings from './pages/Settings';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="projects/:id/wbs" element={<WBSEditor />} />
          <Route path="projects/:id/programme" element={<Programme />} />
          <Route path="projects/:id/mappings" element={<Mappings />} />
          <Route path="projects/:id/costs" element={<Costs />} />
          <Route path="projects/:id/claims" element={<Claims />} />
          <Route path="projects/:id/cashflow" element={<Cashflow />} />
          <Route path="cashflow" element={<Cashflow />} />
          <Route path="resources" element={<Resources />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
