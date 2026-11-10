import { createContext, useContext } from "react";

export type ToastTone = "success" | "error";
export interface ToastApi {
  show: (message: string, tone?: ToastTone) => void;
}
export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const v = useContext(ToastContext);
  if (!v) throw new Error("useToast must be used inside <ToastProvider>");
  return v;
}
