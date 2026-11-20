'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

type Toast = { text: string; kind: 'success' | 'error'; id: number };
type ToastFn = (text: string, kind?: Toast['kind']) => void;

const ToastContext = createContext<ToastFn>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = useCallback<ToastFn>((text, kind = 'success') => setToast({ text, kind, id: Date.now() }), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className={`toast ${toast.kind}`} role="status">
          {toast.kind === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {toast.text}
          <button onClick={() => setToast(null)} aria-label="Dismiss"><X size={15} /></button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
