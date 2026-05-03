import React, { useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthContext } from './AuthContext';

import Landing from './pages/Landing';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import NewExtraction from './pages/NewExtraction';
import Library from './pages/Library';

export default function App() {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">
        <div className="animate-pulse flex flex-col items-center gap-4">
           <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
           <p className="font-medium text-slate-500 tracking-tight">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster 
        position="top-right"
        toastOptions={{
          className: 'font-sans font-medium',
          style: {
            borderRadius: '16px',
            background: '#fff',
            color: '#0f172a',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
          },
        }}
      />
      <Routes>
        {!user ? (
          <Route path="*" element={<Landing />} />
        ) : (
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new" element={<NewExtraction />} />
            <Route path="/library" element={<Library />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}