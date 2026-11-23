"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

interface DatePickerProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  width?: string;
}

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const DAYS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export default function DatePicker({ value, onChange, placeholder, width }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const today = new Date();
  const parsed = value ? new Date(value + "T00:00:00") : today;
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());

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
    if (open) {
      const d = value ? new Date(value + "T00:00:00") : today;
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [open]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else { setViewMonth(viewMonth - 1); }
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else { setViewMonth(viewMonth + 1); }
  };

  const handleDayClick = (day: number) => {
    onChange(formatDate(viewYear, viewMonth, day));
    setOpen(false);
  };

  const handleToday = () => {
    const d = today;
    onChange(formatDate(d.getFullYear(), d.getMonth(), d.getDate()));
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative", width: width || "160px" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          width: "100%",
          padding: "0 12px",
          height: "42px",
          borderRadius: "10px",
          border: "1.5px solid hsl(var(--card-border))",
          background: "hsl(var(--card))",
          cursor: "pointer",
          color: value ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
          fontSize: "0.85rem",
          fontWeight: 500,
          transition: "border-color .2s",
          outline: "none",
        }}
      >
        <span style={{ flex: 1, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {value ? formatDisplay(value) : (placeholder || "Seleccionar fecha")}
        </span>
        <Calendar size={15} style={{ color: "hsl(var(--muted-foreground))", flexShrink: 0 }} />
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
              top: "calc(100% + 6px)",
              left: 0,
              zIndex: 50,
              width: "280px",
              background: "#ffffff",
              borderRadius: "12px",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
              padding: "16px",
              userSelect: "none",
            }}
          >
            {/* Header month/year nav */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <button type="button" onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "hsl(var(--muted-foreground))", borderRadius: "6px" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.04)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "hsl(var(--foreground))" }}>
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button type="button" onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "hsl(var(--muted-foreground))", borderRadius: "6px" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.04)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Day headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", marginBottom: "4px" }}>
              {DAYS.map((d) => (
                <div key={d} style={{ textAlign: "center", fontSize: "0.7rem", fontWeight: 600, color: "hsl(var(--muted-foreground))", padding: "4px 0" }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = formatDate(viewYear, viewMonth, day);
                const isSelected = value === dateStr;
                const isToday = dateStr === formatDate(today.getFullYear(), today.getMonth(), today.getDate());
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDayClick(day)}
                    style={{
                      background: isSelected ? "#e11d48" : isToday ? "rgba(225, 29, 72, 0.08)" : "transparent",
                      color: isSelected ? "#fff" : "hsl(var(--foreground))",
                      fontWeight: isSelected ? 700 : isToday ? 600 : 400,
                      border: "none",
                      borderRadius: "8px",
                      padding: "6px 0",
                      cursor: "pointer",
                      fontSize: "0.82rem",
                      textAlign: "center",
                      transition: "background .12s",
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = isToday ? "rgba(225, 29, 72, 0.08)" : "transparent"; }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "8px", marginTop: "12px", paddingTop: "10px", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
              <button type="button" onClick={handleToday} style={{
                flex: 1, padding: "6px 0", border: "none", borderRadius: "8px", background: "rgba(0,0,0,0.04)", cursor: "pointer",
                fontSize: "0.78rem", fontWeight: 600, color: "hsl(var(--foreground))",
              }}>
                Hoy
              </button>
              {value && (
                <button type="button" onClick={handleClear} style={{
                  flex: 1, padding: "6px 0", border: "none", borderRadius: "8px", background: "rgba(225,29,72,0.06)", cursor: "pointer",
                  fontSize: "0.78rem", fontWeight: 600, color: "#e11d48",
                }}>
                  Limpiar
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
