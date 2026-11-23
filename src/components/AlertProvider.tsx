"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

export class AlertManager {
  private static listener: ((message: string, title?: string, type?: 'success' | 'error' | 'warning' | 'info') => void) | null = null;

  public static setListener(cb: ((message: string, title?: string, type?: 'success' | 'error' | 'warning' | 'info') => void) | null) {
    this.listener = cb;
  }

  public static show(message: string, title = "Alerta", type: 'success' | 'error' | 'warning' | 'info' = 'warning') {
    if (this.listener) {
      this.listener(message, title, type);
    } else {
      console.warn("AlertManager: No listener registered. Message was: " + message);
    }
  }
}

type ConfirmResolver = (value: boolean) => void;

export class ConfirmManager {
  private static resolver: ConfirmResolver | null = null;
  private static listener: ((message: string, title?: string) => void) | null = null;

  public static setListener(cb: ((message: string, title?: string) => void) | null) {
    this.listener = cb;
  }

  public static show(message: string, title = "Confirmar"): Promise<boolean> {
    return new Promise((resolve) => {
      this.resolver = resolve;
      if (this.listener) {
        this.listener(message, title);
      }
    });
  }

  public static resolve(value: boolean) {
    if (this.resolver) {
      this.resolver(value);
      this.resolver = null;
    }
  }
}

export default function AlertProvider() {
  const [alertState, setAlertState] = useState<{ show: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  const [confirmState, setConfirmState] = useState<{ show: boolean; title: string; message: string } | null>(null);

  useEffect(() => {
    AlertManager.setListener((message, title = "Alerta", type = "warning") => {
      setAlertState({ show: true, title, message, type });
    });

    ConfirmManager.setListener((message, title = "Confirmar") => {
      setConfirmState({ show: true, title, message });
    });

    if (typeof window !== "undefined") {
      window.alert = (message: string) => {
        let type: 'success' | 'error' | 'warning' | 'info' = "warning";
        let title = "Advertencia";
        const lowerMessage = message.toLowerCase();
        if (lowerMessage.includes("exito") || lowerMessage.includes("correcta") || lowerMessage.includes("correcto") || lowerMessage.includes("exitoso") || lowerMessage.includes("guardado") || lowerMessage.includes("eliminada") || lowerMessage.includes("eliminado")) {
          type = "success";
          title = "Éxito";
        } else if (lowerMessage.includes("error") || lowerMessage.includes("falló") || lowerMessage.includes("incorrecto") || lowerMessage.includes("insuficiente")) {
          type = "error";
          title = "Error";
        }
        AlertManager.show(message, title, type);
      };

      (window as any).showAlert = (message: string, title?: string, type?: 'success' | 'error' | 'warning' | 'info') => {
        AlertManager.show(message, title, type);
      };

      (window as any).showConfirm = (message: string, title?: string) => {
        return ConfirmManager.show(message, title);
      };
    }

    return () => {
      AlertManager.setListener(null);
      ConfirmManager.setListener(null);
    };
  }, []);

  const handleAlertClose = useCallback(() => setAlertState(null), []);

  useEffect(() => {
    if (!alertState?.show) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleAlertClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [alertState?.show, handleAlertClose]);

  const handleConfirm = useCallback(() => {
    ConfirmManager.resolve(true);
    setConfirmState(null);
  }, []);

  const handleCancel = useCallback(() => {
    ConfirmManager.resolve(false);
    setConfirmState(null);
  }, []);

  useEffect(() => {
    if (!confirmState?.show) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancel();
      if (e.key === "Enter") handleConfirm();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [confirmState?.show, handleConfirm, handleCancel]);

  return (
    <>
      {alertState?.show && (
        <div className="pos-modal-bg overlay-bg-blur">
          <div className="pos-modal-alert" onClick={(e) => e.stopPropagation()}>
            <button className="admin-modal-close-btn" onClick={handleAlertClose} style={{ position: "absolute", top: "16px", right: "16px" }}>
              <X size={18} />
            </button>
            <div className={`pos-alert-icon ${alertState.type}`}>
              {alertState.type === 'error' && <AlertCircle size={36} strokeWidth={2} />}
              {alertState.type === 'success' && <CheckCircle2 size={36} strokeWidth={2} />}
              {alertState.type === 'warning' && <AlertTriangle size={36} strokeWidth={2} />}
              {alertState.type === 'info' && <Info size={36} strokeWidth={2} />}
            </div>
            <h3>{alertState.title}</h3>
            <p>{alertState.message}</p>
            <div className="pos-modal-actions" style={{ justifyContent: "center", marginTop: "16px" }}>
              <button
                className="pos-modal-confirm"
                style={{
                  width: "100%",
                  maxWidth: "160px",
                  background: alertState.type === 'success' ? '#10b981' : '#e11d48'
                }}
                onClick={handleAlertClose}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmState?.show && (
        <div className="pos-modal-bg overlay-bg-blur">
          <div style={{
            background: "#ffffff",
            borderRadius: "20px",
            border: "1px solid rgba(15,23,42,0.08)",
            width: "100%",
            maxWidth: "420px",
            padding: "28px 32px",
            boxShadow: "0 25px 50px -12px rgba(15,23,42,0.12), 0 0 0 1px rgba(15,23,42,0.04)",
            position: "relative",
            animation: "pos-apple-scale 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}>
            <button onClick={handleCancel} style={{
              position: "absolute", top: "24px", right: "24px",
              background: "none", border: "none", color: "#94a3b8",
              cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", padding: "6px", borderRadius: "6px",
              zIndex: 10,
            }}>
              <X size={18} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "#fef2f2", color: "#e11d48",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <AlertTriangle size={22} strokeWidth={2} />
              </div>
              <div>
                <h3 style={{
                  fontSize: "1.1rem", fontWeight: 800, color: "#0f172a",
                  letterSpacing: "-0.02em", margin: 0,
                }}>{confirmState.title}</h3>
              </div>
            </div>
            <p style={{ color: "#475569", fontSize: "0.9rem", lineHeight: 1.6, margin: "8px 0 20px" }}>
              {confirmState.message}
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button className="btn btn-outline" onClick={handleCancel} style={{ minWidth: 100 }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleConfirm} style={{
                minWidth: 100, background: "#e11d48", borderColor: "#e11d48",
              }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
