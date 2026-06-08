import { useState, useEffect, useCallback } from "react";

export function useLocalState(key: string, defaultValue: boolean) {
  const [state, setState] = useState<boolean>(defaultValue);

  // Load initial value
  useEffect(() => {
    if (typeof window !== "undefined") {
      const val = localStorage.getItem(key);
      if (val !== null) {
        setState(val === "true");
      }
    }
  }, [key]);

  const setLocalState = useCallback((val: boolean) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, val.toString());
      setState(val);
      window.dispatchEvent(new Event(`local-state-change-${key}`));
    }
  }, [key]);

  // Listen for changes from other components
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const handleUpdate = () => {
      const val = localStorage.getItem(key);
      if (val !== null) {
        setState(val === "true");
      }
    };
    
    window.addEventListener(`local-state-change-${key}`, handleUpdate);
    return () => {
      window.removeEventListener(`local-state-change-${key}`, handleUpdate);
    };
  }, [key]);

  return [state, setLocalState] as const;
}
