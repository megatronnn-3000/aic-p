import { createContext, useContext } from "react";

export const ToastContext = createContext(null);

/** Returns { success(message), error(message), info(message) }. */
export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside <ToastProvider>");
  return value;
}
