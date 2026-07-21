// XActions Dashboard — full-tab management page.
// by nichxbt
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { DashboardApp } from './App';
import '../popup/styles/theme.css';
import './styles/dashboard.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <DashboardApp />
    </React.StrictMode>,
  );
}
