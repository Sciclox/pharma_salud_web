"use client";
import { useEffect, useRef } from "react";

export function useEscapeToClose(open: boolean, onClose: () => void) {
  const ref = useRef(onClose);
  ref.current = onClose;

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") ref.current();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);
}
