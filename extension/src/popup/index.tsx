// by nichxbt
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ToastRoot } from './components/ToastProvider';
import './styles/theme.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <ToastRoot>
        <App />
      </ToastRoot>
    </React.StrictMode>,
  );
}
