import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { ToastContext, type ToastTone } from "./toast-context";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

/** Feedback after an action. Success is announced politely; errors interrupt (role="alert"). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-2), { id, message, tone }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`} role={t.tone === "error" ? "alert" : "status"}>
            <Icon name={t.tone === "error" ? "alert" : "check"} />
            <span>{t.message}</span>
            <button type="button" className="icon-btn on-night" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
