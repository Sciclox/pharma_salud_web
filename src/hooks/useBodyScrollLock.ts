"use client";
import { useEffect } from "react";

/**
 * Bloquea el scroll del body cuando `locked` es true.
 * Al desmontar o cuando `locked` pasa a false, restaura el scroll.
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (locked) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [locked]);
}
