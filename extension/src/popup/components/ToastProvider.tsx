// Gothic toast notifications built on Base UI's headless Toast primitive.
// by nichxbt

import * as React from 'react';
import { Toast } from '@base-ui/react/toast';
import type { ToastKind } from '../types';

const ICONS: Record<ToastKind, string> = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: '📘',
};

interface ToastCtx {
  show: (message: string, type?: ToastKind) => void;
}

const ToastContext = React.createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return (
    <>
      {toasts.map((toast) => (
        <Toast.Root key={toast.id} toast={toast} className="xa-toast" data-kind={(toast.data as { kind?: ToastKind })?.kind || 'info'}>
          <span className="xa-toast-icon" aria-hidden="true">
            {ICONS[(toast.data as { kind?: ToastKind })?.kind || 'info']}
          </span>
          <Toast.Title className="xa-toast-msg" />
        </Toast.Root>
      ))}
    </>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const manager = Toast.useToastManager();
  const ctxValue = React.useMemo<ToastCtx>(
    () => ({
      show: (message, type = 'info') => {
        manager.add({ title: message, data: { kind: type }, timeout: 3200 });
      },
    }),
    [manager],
  );

  return (
    <ToastContext.Provider value={ctxValue}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="xa-toast-viewport">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </ToastContext.Provider>
  );
}

export function ToastRoot({ children }: { children: React.ReactNode }) {
  return (
    <Toast.Provider>
      <ToastProvider>{children}</ToastProvider>
    </Toast.Provider>
  );
}
