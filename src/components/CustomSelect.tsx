"use client";

import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  width?: string;
  onCreateNew?: () => void;
  onCreateNewLabel?: string;
  disabled?: boolean;
}

export default function CustomSelect({ options, value, onChange, placeholder, width, onCreateNew, onCreateNewLabel, disabled }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [placement, setPlacement] = useState<"down" | "up">("down");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 330 && rect.top > spaceBelow) {
        setPlacement("up");
      } else {
        setPlacement("down");
      }
    }
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const normalizeText = (text: string) =>
    text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const filteredOptions = options.filter((opt) =>
    normalizeText(opt.label).includes(normalizeText(search))
  );

  const selected = options.find((o) => o.value === value);
  const selectedLabel = selected?.label || placeholder || "Seleccionar";

  return (
    <div ref={ref} style={{ position: "relative", width: width || "100%" }}>
      <button
        type="button"
        onClick={() => { if (!disabled) setOpen((v) => !v); }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          width: "100%",
          padding: "10px 14px",
          borderRadius: "10px",
          border: "1.5px solid hsl(var(--card-border))",
          background: disabled ? "#f8fafc" : "#ffffff",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.75 : 1,
          color: "hsl(var(--foreground))",
          fontSize: "0.85rem",
          fontWeight: 500,
          transition: "border-color .2s",
          outline: "none",
          minHeight: "42px",
        }}
      >
        <span style={{ flex: 1, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {selectedLabel}
        </span>
        <ChevronDown size={15} style={{ color: "hsl(var(--muted-foreground))", flexShrink: 0, transition: "transform .2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>

      {open && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 49,
              background: "transparent",
            }}
            onClick={() => setOpen(false)}
          />
          <div
            className="card animate-fade-in"
            style={{
              position: "absolute",
              top: placement === "down" ? "calc(100% + 6px)" : "auto",
              bottom: placement === "up" ? "calc(100% + 6px)" : "auto",
              left: 0,
              right: 0,
              zIndex: 50,
              background: "#ffffff",
              borderRadius: "12px",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
              padding: "6px",
              maxHeight: "320px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Buscador */}
            <div style={{ padding: "4px", borderBottom: "1.5px solid rgba(15, 23, 42, 0.06)", marginBottom: "6px", flexShrink: 0 }}>
              <input
                type="text"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (filteredOptions.length > 0) {
                      onChange(filteredOptions[0].value);
                      setOpen(false);
                    }
                  }
                }}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid rgba(15, 23, 42, 0.15)",
                  fontSize: "0.82rem",
                  outline: "none",
                  boxSizing: "border-box",
                  background: "#f8fafc",
                }}
                autoFocus
              />
            </div>

            {onCreateNew && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateNew();
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "9px 12px",
                  border: "none",
                  borderRadius: "8px",
                  background: "transparent",
                  color: "#e11d48",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                  borderBottom: "1.5px solid rgba(15, 23, 42, 0.06)",
                  marginBottom: "6px",
                  transition: "background .15s",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(225, 29, 72, 0.04)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <span>{onCreateNewLabel || "+ Crear nuevo..."}</span>
              </button>
            )}

            <div style={{ overflowY: "auto", flex: 1, maxHeight: "200px" }}>
              {filteredOptions.length === 0 ? (
                <div style={{ padding: "12px", textAlign: "center", color: "hsl(var(--muted-foreground))", fontSize: "0.82rem" }}>
                  Sin resultados
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isActive = value === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { onChange(opt.value); setOpen(false); }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        width: "100%",
                        padding: "9px 12px",
                        border: "none",
                        borderRadius: "8px",
                        background: isActive ? "rgba(225, 29, 72, 0.06)" : "transparent",
                        color: "hsl(var(--foreground))",
                        fontSize: "0.85rem",
                        fontWeight: isActive ? 600 : 400,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background .15s",
                      }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{opt.label}</span>
                      {isActive && <Check size={14} style={{ color: "#e11d48", flexShrink: 0 }} />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
