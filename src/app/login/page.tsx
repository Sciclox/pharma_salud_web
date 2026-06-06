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
    metric: "360",
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
        setError("Matrícula o contraseña incorrectas, o cuenta de usuario inactiva.");
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
      setError("Falló la conexión con el servidor de seguridad central.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="onboarding-panel hidden-mobile" aria-label="Introducción al sistema">
        <div className="panel-grid" />

        <header className="brand-row">
          <LogoFarmacia size={48} />
          <div>
            <p className="brand-name">
              PHARMA SALUD <span>•</span>
            </p>
            <p className="brand-subtitle">Sistema central de gestión farmacéutica</p>
          </div>
        </header>

        <div className="onboarding-stage" aria-live="polite">
          <div className="slide-kicker">
            <Sparkles size={16} />
            {slide.eyebrow}
          </div>

          <div className="slide-copy" key={slide.title}>
            <h1>{slide.title}</h1>
            <p>{slide.text}</p>
          </div>

          <div className="system-preview">
            <div className="preview-header">
              <span>Vista del sistema</span>
              <div className="preview-status">
                <span />
                Operativo
              </div>
            </div>

            <div className="preview-body">
              <div className="metric-tile">
                <SlideIcon size={26} />
                <strong>{slide.metric}</strong>
                <small>{slide.label}</small>
              </div>

              <div className="detail-list">
                {slide.details.map((detail) => (
                  <div key={detail}>
                    <CheckCircle2 size={17} />
                    <span>{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <footer className="onboarding-footer">
          <div className="page-dots" aria-label="Páginas del onboarding">
            {slides.map((item, index) => (
              <button
                key={item.title}
                type="button"
                className={index === activeSlide ? "active" : ""}
                aria-label={`Ver página ${index + 1}: ${item.eyebrow}`}
                aria-current={index === activeSlide ? "true" : undefined}
                onClick={() => setActiveSlide(index)}
              />
            ))}
          </div>

          <div className="secure-strip">
            <ShieldCheck size={18} />
            Acceso cifrado para personal autorizado
          </div>
        </footer>
      </section>

      <section className="login-panel" aria-label="Acceso al sistema">
        <div className="login-card">
          <div className="mobile-brand">
            <LogoFarmacia size={42} />
            <div>
              <p>PHARMA SALUD</p>
              <span>Trazabilidad farmacéutica</span>
            </div>
          </div>

          <div className="form-heading">
            <span className="access-pill">
              <Lock size={14} />
              Acceso interno
            </span>
            <h2>Control de acceso</h2>
            <p>Ingrese sus credenciales para entrar a la consola centralizada.</p>
          </div>

          {error && (
            <div className="error-box" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="login-form">
            <label className="field-group">
              <span>Identificador de personal</span>
              <div className="input-wrap">
                <User size={17} />
                <input
                  type="text"
                  placeholder="Ej. admin"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  disabled={loading}
                  autoComplete="username"
                />
              </div>
            </label>

            <label className="field-group">
              <span>Clave de seguridad corporativa</span>
              <div className="input-wrap">
                <Lock size={17} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Ingrese su contraseña"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="ghost-icon"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>

            <button type="submit" className="submit-button" disabled={loading}>
              <span>{loading ? "Verificando..." : "Ingresar a consola"}</span>
              <ArrowRight size={18} />
            </button>
          </form>
        </div>
      </section>

      <style>{`
        .login-shell {
          width: 100vw;
          min-height: 100vh;
          display: grid;
          grid-template-columns: minmax(520px, 1.15fr) minmax(390px, 0.85fr);
          gap: 18px;
          padding: 18px;
          overflow-x: hidden;
          color: #0f172a;
          font-family: var(--font-heading), system-ui, -apple-system, sans-serif;
          background:
            linear-gradient(110deg, rgba(244, 246, 249, 0.96), rgba(255, 255, 255, 0.7)),
            url("/pharmacy_login_bg.png") center / cover no-repeat;
        }

        .onboarding-panel,
        .login-panel {
          position: relative;
          min-height: calc(100vh - 36px);
          overflow: hidden;
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 20px;
        }

        .onboarding-panel {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: clamp(32px, 4vw, 58px);
          background:
            linear-gradient(145deg, rgba(255, 255, 255, 0.9), rgba(239, 253, 250, 0.72)),
            radial-gradient(circle at 18% 18%, rgba(225, 29, 72, 0.12), transparent 30%),
            radial-gradient(circle at 86% 74%, rgba(14, 165, 233, 0.14), transparent 28%);
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
        }

        .panel-grid {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.34;
          background-image:
            linear-gradient(rgba(15, 23, 42, 0.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(15, 23, 42, 0.055) 1px, transparent 1px);
          background-size: 44px 44px;
          mask-image: linear-gradient(90deg, #000, transparent 88%);
        }

        .brand-row,
        .onboarding-stage,
        .onboarding-footer {
          position: relative;
          z-index: 2;
        }

        .brand-row {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .brand-name {
          margin: 0;
          color: #0f172a;
          font-size: 1.22rem;
          font-weight: 950;
          line-height: 1;
        }

        .brand-name span {
          color: #e11d48;
        }

        .brand-subtitle {
          margin-top: 7px;
          color: #64748b;
          font-size: 0.72rem;
          font-weight: 850;
          letter-spacing: 0.08em;
          line-height: 1.35;
          text-transform: uppercase;
        }

        .onboarding-stage {
          width: min(100%, 680px);
          display: flex;
          flex-direction: column;
          gap: 28px;
          margin: auto 0;
        }

        .slide-kicker,
        .access-pill,
        .secure-strip,
        .preview-status,
        .detail-list div,
        .preview-header,
        .preview-body,
        .metric-tile,
        .onboarding-footer {
          display: flex;
          align-items: center;
        }

        .slide-kicker {
          width: fit-content;
          gap: 9px;
          padding: 9px 13px;
          color: #be123c;
          background: rgba(225, 29, 72, 0.08);
          border: 1px solid rgba(225, 29, 72, 0.12);
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 900;
        }

        .slide-copy {
          animation: slideIn 0.55s ease both;
        }

        .slide-copy h1 {
          max-width: 620px;
          margin: 0;
          color: #0f172a;
          font-size: clamp(2.6rem, 5vw, 4.85rem);
          font-weight: 950;
          line-height: 0.98;
          letter-spacing: 0;
        }

        .slide-copy p {
          max-width: 560px;
          margin-top: 20px;
          color: #475569;
          font-size: 1.03rem;
          font-weight: 650;
          line-height: 1.65;
        }

        .system-preview {
          width: min(100%, 560px);
          padding: 18px;
          background: rgba(255, 255, 255, 0.78);
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 18px;
          box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
          backdrop-filter: blur(14px);
        }

        .preview-header {
          justify-content: space-between;
          padding-bottom: 16px;
          color: #334155;
          font-size: 0.78rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.07em;
        }

        .preview-status {
          gap: 7px;
          color: #059669;
        }

        .preview-status span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 0 5px rgba(16, 185, 129, 0.12);
        }

        .preview-body {
          gap: 16px;
        }

        .metric-tile {
          width: 154px;
          min-height: 145px;
          flex-direction: column;
          justify-content: center;
          gap: 9px;
          color: #fff;
          border-radius: 14px;
          background: linear-gradient(145deg, #0f172a, #1e293b 58%, #be123c);
          box-shadow: 0 18px 35px rgba(15, 23, 42, 0.22);
        }

        .metric-tile strong {
          font-size: 2.15rem;
          font-weight: 950;
          line-height: 1;
        }

        .metric-tile small {
          color: rgba(255, 255, 255, 0.76);
          font-size: 0.74rem;
          font-weight: 800;
        }

        .detail-list {
          flex: 1;
          display: grid;
          gap: 10px;
        }

        .detail-list div {
          gap: 10px;
          min-height: 42px;
          padding: 10px 12px;
          color: #334155;
          background: #fff;
          border: 1px solid rgba(15, 23, 42, 0.06);
          border-radius: 10px;
          font-size: 0.86rem;
          font-weight: 800;
        }

        .detail-list svg {
          color: #10b981;
          flex-shrink: 0;
        }

        .onboarding-footer {
          justify-content: space-between;
          gap: 20px;
        }

        .page-dots {
          display: flex;
          gap: 10px;
        }

        .page-dots button {
          width: 36px;
          height: 8px;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.14);
          cursor: pointer;
          transition: width 0.25s ease, background 0.25s ease;
        }

        .page-dots button.active {
          width: 66px;
          background: #e11d48;
        }

        .secure-strip {
          gap: 9px;
          color: #334155;
          font-size: 0.78rem;
          font-weight: 900;
          padding: 10px 13px;
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 999px;
        }

        .login-panel {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(22px, 4vw, 48px);
          background: rgba(244, 246, 249, 0.62);
          backdrop-filter: blur(22px);
        }

        .login-card {
          width: min(100%, 430px);
          padding: clamp(28px, 4vw, 42px);
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(15, 23, 42, 0.07);
          border-radius: 18px;
          box-shadow: 0 24px 65px rgba(15, 23, 42, 0.1);
        }

        .mobile-brand {
          display: none;
          align-items: center;
          gap: 12px;
          margin-bottom: 28px;
        }

        .mobile-brand p {
          margin: 0;
          color: #0f172a;
          font-weight: 950;
          line-height: 1;
        }

        .mobile-brand span {
          color: #64748b;
          font-size: 0.68rem;
          font-weight: 850;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .form-heading {
          margin-bottom: 28px;
        }

        .access-pill {
          width: fit-content;
          gap: 7px;
          margin-bottom: 16px;
          padding: 8px 11px;
          color: #be123c;
          background: rgba(225, 29, 72, 0.07);
          border: 1px solid rgba(225, 29, 72, 0.12);
          border-radius: 999px;
          font-size: 0.76rem;
          font-weight: 900;
        }

        .form-heading h2 {
          margin: 0;
          color: #0f172a;
          font-size: 1.9rem;
          font-weight: 950;
          letter-spacing: 0;
        }

        .form-heading p {
          margin-top: 9px;
          color: #64748b;
          font-size: 0.92rem;
          font-weight: 650;
        }

        .error-box {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 22px;
          padding: 13px 15px;
          color: #be123c;
          background: rgba(225, 29, 72, 0.055);
          border: 1px solid rgba(225, 29, 72, 0.16);
          border-radius: 12px;
          font-size: 0.86rem;
          font-weight: 750;
          line-height: 1.45;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .field-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          color: #475569;
          font-size: 0.75rem;
          font-weight: 900;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .input-wrap {
          position: relative;
          display: flex;
          align-items: center;
          color: #94a3b8;
        }

        .input-wrap > svg {
          position: absolute;
          left: 15px;
          pointer-events: none;
        }

        .input-wrap input {
          width: 100%;
          height: 50px;
          padding: 0 46px;
          color: #0f172a;
          background: #f8fafc;
          border: 1px solid rgba(15, 23, 42, 0.09);
          border-radius: 11px;
          outline: none;
          font: inherit;
          font-size: 0.95rem;
          font-weight: 650;
          letter-spacing: 0;
          text-transform: none;
          transition: border 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }

        .input-wrap input:focus {
          background: #fff;
          border-color: #e11d48;
          box-shadow: 0 0 0 4px rgba(225, 29, 72, 0.12);
        }

        .ghost-icon {
          position: absolute;
          right: 9px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          color: #64748b;
          background: transparent;
          border: 0;
          border-radius: 9px;
          cursor: pointer;
        }

        .submit-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          height: 52px;
          margin-top: 8px;
          color: #fff;
          background: linear-gradient(135deg, #e11d48 0%, #b91c1c 100%);
          border: 0;
          border-radius: 11px;
          box-shadow: 0 14px 28px rgba(225, 29, 72, 0.25);
          cursor: pointer;
          font-size: 0.95rem;
          font-weight: 900;
        }

        .submit-button:disabled {
          cursor: wait;
          opacity: 0.76;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 980px) {
          .login-shell {
            grid-template-columns: 1fr;
            padding: 14px;
          }

          .hidden-mobile {
            display: none;
          }

          .mobile-brand {
            display: flex;
          }

          .login-panel {
            min-height: calc(100vh - 28px);
          }
        }

        @media (max-width: 520px) {
          .login-shell {
            padding: 0;
            background: #f4f6f9;
          }

          .login-panel {
            min-height: 100vh;
            padding: 18px;
            border: 0;
            border-radius: 0;
          }

          .login-card {
            padding: 28px 22px;
            border-radius: 16px;
          }
        }
      `}</style>
    </main>
  );
}
