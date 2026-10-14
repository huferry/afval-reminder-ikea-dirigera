import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SetupPage from './pages/SetupPage.jsx';
import StatusPage from './pages/StatusPage.jsx';

export default function App() {
  const [configured, setConfigured] = useState(null); // null = loading

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data) => {
        const isConfigured = !!(data.postalCode && data.houseNumber && data.hubUrl && data.token);
        setConfigured(isConfigured);
      })
      .catch(() => setConfigured(false));
  }, []);

  if (configured === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Laden...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/setup" element={<SetupPage onConfigured={() => setConfigured(true)} />} />
        <Route
          path="/"
          element={configured ? <StatusPage /> : <Navigate to="/setup" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
