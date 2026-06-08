"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  User,
} from "lucide-react";
import LogoFarmacia from "@/components/LogoFarmacia";

const slides = [
  {
    eyebrow: "Punto de venta conectado",
    title: "Ventas rápidas con control por sucursal",
    text: "Registra cobros, consulta productos y conserva la trazabilidad de cada movimiento sin perder velocidad en caja.",
    metric: "POS",
    label: "Caja lista",
    icon: ShoppingCart,
    details: ["Carrito operativo", "Usuarios por rol", "Devoluciones controladas"],
  },
  {
    eyebrow: "Inventario inteligente",
    title: "Stock, lotes y vencimientos en un solo flujo",
    text: "Detecta productos críticos, audita caducidades y mantiene sincronizadas las existencias de cada farmacia.",
    metric: "FIFO",
    label: "Rotación segura",
    icon: Boxes,
    details: ["Kardex por producto", "Alertas de vencimiento", "Control de sobrantes"],
  },
  {
    eyebrow: "Gestión para decisiones",
    title: "Analítica clara para administrar mejor",
    text: "Convierte ventas, sucursales y comportamiento del inventario en indicadores útiles para decidir con calma.",
    metric: "360°",
    label: "Vista central",
    icon: BarChart3,
    details: ["Panel administrativo", "Reportes visuales", "Seguimiento diario"],
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, []);

  const slide = slides[activeSlide];
  const SlideIcon = slide.icon;

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Ingrese su usuario y contraseña corporativa.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await signIn("credentials", {
        username: username.toLowerCase().trim(),
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("Credenciales incorrectas o cuenta inactiva.");
        return;
      }
      const resSession = await fetch("/api/auth/session");
      if (resSession.ok) {
        const session = await resSession.json();
        router.push(session?.user?.role === "Administrador" ? "/admin" : "/vendedor");
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      setError("Falló la conexión con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="ls-root">
      {/* ── Panel izquierdo ── */}
      <section className="ls-left" aria-label="Presentación del sistema">
        {/* Imagen de fondo + overlay */}
        <div className="ls-left-bg" />
        <div className="ls-left-overlay" />

        {/* Contenido sobre la imagen */}
        <div className="ls-left-inner">
          {/* Logo */}
          <header className="ls-brand">
            <div className="ls-logo-wrap">
              <LogoFarmacia size={34} />
            </div>
            <div>
              <p className="ls-brand-name">PHARMA SALUD</p>
              <p className="ls-brand-tag">Sistema de gestión farmacéutica</p>
            </div>
          </header>

          {/* Slide principal */}
          <div className="ls-stage" aria-live="polite">
            <div className="ls-eyebrow">
              <Sparkles size={13} />
              {slide.eyebrow}
            </div>

            <div className="ls-headline" key={slide.title}>
              <h1>{slide.title}</h1>
              <p>{slide.text}</p>
            </div>

            {/* Card de preview */}
            <div className="ls-preview-card">
              <div className="ls-preview-header">
                <span>Vista del sistema</span>
                <span className="ls-status-dot">
                  <span />
                  Operativo
                </span>
              </div>
              <div className="ls-preview-body">
                <div className="ls-metric-tile">
                  <SlideIcon size={22} strokeWidth={1.5} />
                  <strong>{slide.metric}</strong>
                  <small>{slide.label}</small>
                </div>
                <div className="ls-detail-list">
                  {slide.details.map((d) => (
                    <div key={d} className="ls-detail-row">
                      <CheckCircle2 size={15} strokeWidth={2} />
                      <span>{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="ls-left-footer">
            <div className="ls-dots" aria-label="Navegación de slides">
              {slides.map((item, index) => (
                <button
                  key={item.title}
                  type="button"
                  className={`ls-dot${index === activeSlide ? " ls-dot-active" : ""}`}
                  onClick={() => setActiveSlide(index)}
                  aria-label={`Slide ${index + 1}`}
                />
              ))}
            </div>
            <div className="ls-secure">
              <ShieldCheck size={14} strokeWidth={2} />
              Acceso cifrado · Personal autorizado
            </div>
          </footer>
        </div>
      </section>

      {/* ── Panel derecho ── */}
      <section className="ls-right" aria-label="Acceso al sistema">
        <div className="ls-form-wrap">
          {/* Marca mobile */}
          <div className="ls-mobile-brand">
            <LogoFarmacia size={38} />
            <div>
              <p>PHARMA SALUD</p>
              <span>Trazabilidad farmacéutica</span>
            </div>
          </div>

          {/* Cabecera del formulario */}
          <div className="ls-form-head">
            <span className="ls-badge">
              <Lock size={12} strokeWidth={2.5} />
              Acceso interno
            </span>
            <h2>Bienvenido de vuelta</h2>
            <p>Ingrese sus credenciales para acceder a la consola centralizada.</p>
          </div>

          {/* Error */}
          {error && (
            <div className="ls-error" role="alert">
              <AlertCircle size={15} strokeWidth={2} />
              <span>{error}</span>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleLogin} className="ls-form">
            <label className="ls-field">
              <span>Identificador de personal</span>
              <div className="ls-input-wrap">
                <User size={16} strokeWidth={1.75} className="ls-input-icon" />
                <input
                  type="text"
                  placeholder="Ej. admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </label>

            <label className="ls-field">
              <span>Clave de seguridad</span>
              <div className="ls-input-wrap">
                <Lock size={16} strokeWidth={1.75} className="ls-input-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Ingrese su contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="ls-eye-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                </button>
              </div>
            </label>

            <button type="submit" className="ls-submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="ls-spinner" />
                  Verificando...
                </>
              ) : (
                <>
                  Ingresar a consola
                  <ArrowRight size={17} strokeWidth={2} />
                </>
              )}
            </button>
          </form>

          <p className="ls-footer-note">
            Sistema exclusivo para personal de Pharma Salud.<br />
            Si no tienes acceso, contacta al administrador.
          </p>
        </div>
      </section>

      <style>{`
        /* ── Tokens ── */
        .ls-root {
          --red:       #e11d48;
          --red-dark:  #be123c;
          --red-glow:  rgba(225,29,72,.18);
          --navy:      #050d1f;
          --navy-2:    #0b1629;
          --blue-acc:  #0ea5e9;
          --text-inv:  #f8fafc;
          --text-muted-inv: rgba(248,250,252,.55);
          --border-inv: rgba(255,255,255,.08);
          --bg-form:   #f4f6f9;
          --text-dark: #0f172a;
          --text-muted: #64748b;
          --border:    rgba(15,23,42,.1);
          --radius:    16px;
          --radius-sm: 10px;

          width: 100vw;
          min-height: 100dvh;
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          background: var(--navy);
          font-family: var(--font-outfit), system-ui, -apple-system, sans-serif;
          overflow: hidden;
        }

        /* ── Panel izquierdo ── */
        .ls-left {
          position: relative;
          min-height: 100dvh;
          overflow: hidden;
        }

        .ls-left-bg {
          position: absolute;
          inset: 0;
          background: url('/login_panel_bg.png') center/cover no-repeat;
          z-index: 0;
        }

        .ls-left-overlay {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(160deg,
              rgba(5,13,31,.82) 0%,
              rgba(5,13,31,.55) 50%,
              rgba(5,13,31,.78) 100%
            );
          z-index: 1;
        }

        .ls-left-inner {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
          min-height: 100dvh;
          padding: clamp(28px, 4vw, 52px);
        }

        /* Marca */
        .ls-brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .ls-logo-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: rgba(255,255,255,.06);
          border: 1px solid var(--border-inv);
          backdrop-filter: blur(12px);
        }

        .ls-brand-name {
          margin: 0;
          color: var(--text-inv);
          font-size: 1.05rem;
          font-weight: 800;
          letter-spacing: 0.04em;
          line-height: 1;
        }

        .ls-brand-tag {
          margin-top: 5px;
          color: var(--text-muted-inv);
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        /* Stage / Slides */
        .ls-stage {
          display: flex;
          flex-direction: column;
          gap: 24px;
          margin: auto 0;
          max-width: 560px;
        }

        .ls-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          width: fit-content;
          padding: 7px 13px;
          border-radius: 999px;
          background: rgba(225,29,72,.15);
          border: 1px solid rgba(225,29,72,.25);
          color: #fb7185;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .ls-headline {
          animation: ls-fade-up 0.5s cubic-bezier(.16,1,.3,1) both;
        }

        .ls-headline h1 {
          margin: 0;
          color: var(--text-inv);
          font-size: clamp(2.2rem, 4vw, 3.8rem);
          font-weight: 900;
          line-height: 1.02;
          letter-spacing: -0.03em;
          text-shadow: 0 2px 30px rgba(0,0,0,.4);
        }

        .ls-headline p {
          margin-top: 16px;
          color: var(--text-muted-inv);
          font-size: 1rem;
          font-weight: 500;
          line-height: 1.65;
          max-width: 480px;
        }

        /* Preview card */
        .ls-preview-card {
          padding: 18px 20px;
          border-radius: var(--radius);
          background: rgba(255,255,255,.06);
          border: 1px solid var(--border-inv);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 24px 60px rgba(0,0,0,.3);
        }

        .ls-preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 14px;
          border-bottom: 1px solid var(--border-inv);
          color: var(--text-muted-inv);
          font-size: 0.73rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.07em;
        }

        .ls-status-dot {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #34d399;
          font-size: 0.73rem;
          font-weight: 700;
        }

        .ls-status-dot span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 0 4px rgba(16,185,129,.18);
        }

        .ls-preview-body {
          display: flex;
          gap: 16px;
          margin-top: 14px;
        }

        .ls-metric-tile {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 130px;
          min-height: 130px;
          flex-shrink: 0;
          border-radius: 12px;
          background: linear-gradient(145deg, var(--red) 0%, #7f1d1d 100%);
          color: #fff;
          box-shadow: 0 12px 30px rgba(225,29,72,.35);
        }

        .ls-metric-tile strong {
          font-size: 1.9rem;
          font-weight: 900;
          line-height: 1;
          letter-spacing: -0.02em;
        }

        .ls-metric-tile small {
          font-size: 0.68rem;
          font-weight: 700;
          color: rgba(255,255,255,.7);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .ls-detail-list {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
          justify-content: center;
        }

        .ls-detail-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 9px;
          background: rgba(255,255,255,.05);
          border: 1px solid var(--border-inv);
          color: var(--text-inv);
          font-size: 0.85rem;
          font-weight: 600;
        }

        .ls-detail-row svg {
          color: #34d399;
          flex-shrink: 0;
        }

        /* Footer izquierdo */
        .ls-left-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .ls-dots {
          display: flex;
          gap: 8px;
        }

        .ls-dot {
          width: 28px;
          height: 4px;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: rgba(255,255,255,.22);
          cursor: pointer;
          transition: width .25s ease, background .25s ease;
        }

        .ls-dot-active {
          width: 52px;
          background: var(--red);
        }

        .ls-secure {
          display: flex;
          align-items: center;
          gap: 7px;
          color: var(--text-muted-inv);
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.04em;
        }

        .ls-secure svg { color: #34d399; }

        /* ── Panel derecho ── */
        .ls-right {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100dvh;
          padding: clamp(24px, 4vw, 52px);
          background: var(--bg-form);
        }

        .ls-form-wrap {
          width: min(100%, 420px);
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        /* Marca mobile */
        .ls-mobile-brand {
          display: none;
          align-items: center;
          gap: 12px;
          margin-bottom: 32px;
        }

        .ls-mobile-brand p {
          margin: 0;
          color: var(--text-dark);
          font-weight: 900;
          font-size: 1.05rem;
          letter-spacing: 0.04em;
          line-height: 1;
        }

        .ls-mobile-brand span {
          color: var(--text-muted);
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        /* Cabecera form */
        .ls-form-head {
          margin-bottom: 32px;
        }

        .ls-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 18px;
          padding: 6px 12px;
          border-radius: 999px;
          background: rgba(225,29,72,.07);
          border: 1px solid rgba(225,29,72,.15);
          color: var(--red-dark);
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .ls-form-head h2 {
          margin: 0 0 8px;
          color: var(--text-dark);
          font-size: 1.85rem;
          font-weight: 900;
          letter-spacing: -0.03em;
          line-height: 1.1;
        }

        .ls-form-head p {
          margin: 0;
          color: var(--text-muted);
          font-size: 0.92rem;
          font-weight: 500;
          line-height: 1.55;
        }

        /* Error */
        .ls-error {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 20px;
          padding: 12px 15px;
          border-radius: var(--radius-sm);
          background: rgba(225,29,72,.06);
          border: 1px solid rgba(225,29,72,.18);
          color: var(--red-dark);
          font-size: 0.85rem;
          font-weight: 600;
          line-height: 1.45;
        }

        .ls-error svg { flex-shrink: 0; margin-top: 1px; }

        /* Formulario */
        .ls-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .ls-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
          color: var(--text-dark);
          font-size: 0.74rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .ls-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .ls-input-icon {
          position: absolute;
          left: 15px;
          color: #94a3b8;
          pointer-events: none;
          z-index: 1;
        }

        .ls-input-wrap input {
          width: 100%;
          height: 52px;
          padding: 0 48px;
          background: #fff;
          border: 1.5px solid var(--border);
          border-radius: var(--radius-sm);
          outline: none;
          font-family: var(--font-outfit), system-ui, sans-serif;
          font-size: 0.95rem;
          font-weight: 500;
          color: var(--text-dark);
          letter-spacing: 0;
          text-transform: none;
          transition: border-color .2s, box-shadow .2s, background .2s;
        }

        .ls-input-wrap input::placeholder { color: #94a3b8; }

        .ls-input-wrap input:focus {
          background: #fff;
          border-color: var(--red);
          box-shadow: none;
        }

        .ls-input-wrap input:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .ls-eye-btn {
          position: absolute;
          right: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          color: #94a3b8;
          background: transparent;
          border: 0;
          border-radius: 7px;
          cursor: pointer;
          transition: color .15s, background .15s;
        }

        .ls-eye-btn:hover {
          color: var(--text-dark);
          background: rgba(15,23,42,.05);
        }

        /* Botón submit */
        .ls-submit {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          height: 54px;
          margin-top: 6px;
          color: #fff;
          background: linear-gradient(135deg, var(--red) 0%, #9f1239 100%);
          border: 0;
          border-radius: var(--radius-sm);
          box-shadow: 0 8px 24px rgba(225,29,72,.3), 0 1px 0 rgba(255,255,255,.12) inset;
          cursor: pointer;
          font-family: var(--font-outfit), system-ui, sans-serif;
          font-size: 0.95rem;
          font-weight: 800;
          letter-spacing: 0.01em;
          transition: filter .2s, transform .15s, box-shadow .2s;
        }

        .ls-submit:hover:not(:disabled) {
          filter: brightness(1.08);
          transform: translateY(-2px);
          box-shadow: 0 14px 32px rgba(225,29,72,.38), 0 1px 0 rgba(255,255,255,.12) inset;
        }

        .ls-submit:active:not(:disabled) {
          transform: translateY(0);
        }

        .ls-submit:disabled {
          opacity: .75;
          cursor: wait;
        }

        /* Spinner */
        .ls-spinner {
          width: 17px;
          height: 17px;
          border: 2.5px solid rgba(255,255,255,.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: ls-spin .7s linear infinite;
        }

        /* Footer note */
        .ls-footer-note {
          margin-top: 28px;
          color: #94a3b8;
          font-size: 0.78rem;
          font-weight: 500;
          line-height: 1.6;
          text-align: center;
          border-top: 1px solid var(--border);
          padding-top: 22px;
        }

        /* Keyframes */
        @keyframes ls-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes ls-spin {
          to { transform: rotate(360deg); }
        }

        /* ── Mobile ── */
        @media (max-width: 960px) {
          .ls-root {
            grid-template-columns: 1fr;
          }
          .ls-left {
            display: none;
          }
          .ls-mobile-brand {
            display: flex;
          }
          .ls-right {
            min-height: 100dvh;
            padding: 32px 24px;
          }
        }

        @media (max-width: 480px) {
          .ls-right {
            padding: 24px 16px;
            background: #fff;
          }
          .ls-form-wrap {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
