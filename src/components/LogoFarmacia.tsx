import React from "react";

export default function LogoFarmacia({ size = 56, glow = true }: { size?: number; glow?: boolean }) {
  return (
    <svg
      viewBox="0 0 500 500"
      width={size}
      height={size}
      style={{ 
        filter: glow ? "drop-shadow(0 4px 14px rgba(239, 68, 68, 0.4))" : "none",
        display: "block" 
      }}
    >
      {/* Cruz Roja */}
      <rect x="180" y="20" width="140" height="460" fill="#ef4444" rx="12" />
      <rect x="20" y="180" width="460" height="140" fill="#ef4444" rx="12" />
      
      {/* Caduceo Central (Blanco con trazo Slate Oscuro) */}
      {/* Alas */}
      {/* Ala Izquierda */}
      <path 
        d="M 230 170 C 120 100, 90 230, 205 240 C 140 215, 120 270, 215 270 C 160 255, 170 300, 225 295" 
        fill="#ffffff" 
        stroke="#0f172a" 
        strokeWidth="6" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      {/* Ala Derecha */}
      <path 
        d="M 270 170 C 380 100, 410 230, 295 240 C 360 215, 380 270, 285 270 C 340 255, 330 300, 275 295" 
        fill="#ffffff" 
        stroke="#0f172a" 
        strokeWidth="6" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />

      {/* Báculo (Vara) */}
      <rect x="242" y="140" width="16" height="280" rx="8" fill="#ffffff" stroke="#0f172a" strokeWidth="6" />
      {/* Pomo (Esfera superior) */}
      <circle cx="250" cy="125" r="22" fill="#ffffff" stroke="#0f172a" strokeWidth="6" />

      {/* Serpiente Izquierda (Cuerpo y Cabeza) */}
      <path 
        d="M 250 395 C 205 370, 205 340, 250 315 C 295 290, 295 260, 250 235 C 205 210, 205 180, 245 165 M 245 165 C 215 160, 215 145, 238 140" 
        fill="none" 
        stroke="#ffffff" 
        strokeWidth="16" 
        strokeLinecap="round" 
      />
      <path 
        d="M 250 395 C 205 370, 205 340, 250 315 C 295 290, 295 260, 250 235 C 205 210, 205 180, 245 165 M 245 165 C 215 160, 215 145, 238 140" 
        fill="none" 
        stroke="#0f172a" 
        strokeWidth="6" 
        strokeLinecap="round" 
      />
      
      {/* Serpiente Derecha (Cuerpo y Cabeza) */}
      <path 
        d="M 250 395 C 295 370, 295 340, 250 315 C 205 290, 205 260, 250 235 C 295 210, 295 180, 255 165 M 255 165 C 285 160, 285 145, 262 140" 
        fill="none" 
        stroke="#ffffff" 
        strokeWidth="16" 
        strokeLinecap="round" 
      />
      <path 
        d="M 250 395 C 295 370, 295 340, 250 315 C 205 290, 205 260, 250 235 C 295 210, 295 180, 255 165 M 255 165 C 285 160, 285 145, 262 140" 
        fill="none" 
        stroke="#0f172a" 
        strokeWidth="6" 
        strokeLinecap="round" 
      />

      {/* Ojos de serpientes */}
      <circle cx="228" cy="150" r="3" fill="#0f172a" />
      <circle cx="272" cy="150" r="3" fill="#0f172a" />
    </svg>
  );
}
