import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { ToastContext } from "./toast-context";

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (kind, message) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === "error" ? 8000 : 5000);
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      success: (message) => push("success", message),
      error: (message) => push("error", message),
      info: (message) => push("info", message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.kind];
          return (
            <div key={toast.id} className={`toast toast--${toast.kind}`}>
              <Icon aria-hidden="true" />
              <div className="toast__message">{toast.message}</div>
              <button type="button" className="toast__close" onClick={() => dismiss(toast.id)} aria-label="Dismiss">
                <X />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
