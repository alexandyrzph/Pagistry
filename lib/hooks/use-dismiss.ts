"use client";

import { useEffect, useRef } from "react";

/**
 * While `open`, calls `close` on the next window click. Used by menus that close
 * on any outside click (the menu wrapper stops propagation on its own clicks).
 * Re-subscribes only when `open` changes — `close` is read via a ref so an inline
 * callback doesn't churn the listener.
 */
export function useDismissOnOutsideClick(open: boolean, close: () => void) {
  const cb = useRef(close);
  cb.current = close;
  useEffect(() => {
    if (!open) return;
    const onClick = () => cb.current();
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [open]);
}
