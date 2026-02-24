import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import MainLayout from './components/MainLayout';
import Home from './pages/Home';
import Market from './pages/Market';
import Guides from './pages/Guides';
import GuideDetails from './pages/GuideDetails';

import Explore from './pages/Explore';
import Chat from './pages/Chat';
import Overlay from './pages/Overlay';
import CommunityDetails from './pages/CommunityDetails';
import PostDetails from './pages/PostDetails';
import AdminDashboard from './pages/AdminDashboard';
import Store from './pages/Store';
import Inventory from './pages/Inventory';
import AdminRoute from './components/AdminRoute';

function App() {
  // Check if this is the overlay window — render Overlay directly without auth/layout wrappers
  const isOverlay = window.location.hash === '#/overlay' || window.location.hash.startsWith('#/overlay');

  if (isOverlay) {
    return <Overlay />;
  }

  return (
    <Router>
      <AuthProvider>
        <div className="app-container h-full w-full font-sans text-gray-100 overflow-hidden">
          <Routes>
            <Route path="/" element={<div className="h-full w-full main-app-bg"><Login /></div>} />
            <Route path="/register" element={<div className="h-full w-full main-app-bg"><Register /></div>} />

            {/* Protected Routes Layout */}
            <Route element={<div className="h-full w-full main-app-bg"><MainLayout /></div>}>
              <Route path="/dashboard" element={<Home />} />
              <Route path="/market" element={<Market />} />
              <Route path="/store" element={<Store />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/guides" element={<Guides />} />
              <Route path="/guides/:id" element={<GuideDetails />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/community/:id" element={<CommunityDetails />} />
              <Route path="/post/:id" element={<PostDetails />} />
              <Route path="/admin" element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              } />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
