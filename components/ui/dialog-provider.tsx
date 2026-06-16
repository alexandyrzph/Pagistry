"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "./Modal";

type ConfirmOptions = {
  title?: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type AlertOptions = {
  title?: string;
  message?: ReactNode;
  okLabel?: string;
};

type DialogState =
  | ({ kind: "confirm"; resolve: (ok: boolean) => void } & ConfirmOptions)
  | ({ kind: "alert"; resolve: () => void } & AlertOptions);

type DialogApi = {
  confirm: (options?: ConfirmOptions) => Promise<boolean>;
  alert: (options?: AlertOptions) => Promise<void>;
};

const DialogContext = createContext<DialogApi | null>(null);

function useDialogApi(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("Dialog hooks must be used within <DialogProvider>");
  return ctx;
}

/** Returns an async confirm() that resolves to true/false. Replaces window.confirm. */
export function useConfirm() {
  return useDialogApi().confirm;
}

/** Returns an async alert() that resolves when dismissed. Replaces window.alert. */
export function useAlert() {
  return useDialogApi().alert;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);
  const [open, setOpen] = useState(false);

  const confirm = useCallback(
    (options: ConfirmOptions = {}) =>
      new Promise<boolean>((resolve) => {
        setState({ kind: "confirm", resolve, ...options });
        setOpen(true);
      }),
    [],
  );

  const alert = useCallback(
    (options: AlertOptions = {}) =>
      new Promise<void>((resolve) => {
        setState({ kind: "alert", resolve, ...options });
        setOpen(true);
      }),
    [],
  );

  // Resolve the pending promise and animate the dialog out. `state` is kept
  // mounted so its content stays visible through the exit transition.
  const respond = useCallback(
    (result: boolean) => {
      setOpen(false);
      setState((s) => {
        if (s) {
          if (s.kind === "confirm") s.resolve(result);
          else s.resolve();
        }
        return s;
      });
    },
    [],
  );

  const isConfirm = state?.kind === "confirm";
  const destructive = state?.kind === "confirm" && state.destructive;

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      <Modal open={open} onClose={() => respond(false)} className="max-w-sm p-5" align="center">
        {state && (
          <div>
            <div className="flex items-start gap-3.5">
              {destructive && (
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500">
                  <AlertTriangle size={18} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                {state.title && (
                  <h2 className="text-base font-semibold tracking-tight text-zinc-900">{state.title}</h2>
                )}
                {state.message && (
                  <div className="mt-1 text-sm leading-relaxed text-zinc-500">{state.message}</div>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              {isConfirm && (
                <button
                  onClick={() => respond(false)}
                  className="rounded-lg px-3.5 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
                >
                  {(state as ConfirmOptions).cancelLabel || "Cancel"}
                </button>
              )}
              <button
                autoFocus
                onClick={() => respond(true)}
                className={cn(
                  "rounded-lg px-3.5 py-2 text-sm font-semibold text-white shadow-xs transition-colors",
                  destructive
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-indigo-600 hover:bg-indigo-700",
                )}
              >
                {isConfirm
                  ? (state as ConfirmOptions).confirmLabel || "Confirm"
                  : (state as AlertOptions).okLabel || "OK"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </DialogContext.Provider>
  );
}
