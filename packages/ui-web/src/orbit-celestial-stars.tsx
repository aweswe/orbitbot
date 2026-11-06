/**
 * Orbit Celestial Star Avatars
 * Authentic astronomical stellar bodies (NOT generic AI sparkle slop).
 *
 * Variants:
 * 0: Sirius — Class A0V Blue-White Luminary (ultra-hot core, diamond diffraction, radiant corona)
 * 1: Betelgeuse — Red Supergiant (crimson convective plasma, solar flares, expanding envelope)
 * 2: Polaris — Classical North Star (pure platinum-cyan nucleus, cosmic navigation resonance)
 * 3: Vega — Rapid Sapphire Rotator (oblate star with circumstellar dust disc)
 * 4: Pulsar — Relativistic Magnetar (hyperdense core with collimated magnetic jet beams)
 * 5: Sol / Helios — Solar Dynamo (golden plasma body with coronal prominence loops)
 */
import type { CSSProperties } from "react";
import { cn } from "./lib/utils.js";

export const ORBIT_STAR_COUNT = 6;

export interface CelestialStar {
  name: string;
  type: string;
  primaryColor: string;
}

export const CELESTIAL_STARS: CelestialStar[] = [
  { name: "Sirius", type: "Blue-White Luminary", primaryColor: "#38bdf8" },
  { name: "Betelgeuse", type: "Red Supergiant", primaryColor: "#f97316" },
  { name: "Polaris", type: "North Celestial Star", primaryColor: "#e0e7ff" },
  { name: "Vega", type: "Sapphire Rotator", primaryColor: "#818cf8" },
  { name: "Pulsar", type: "Magnetic Neutron Star", primaryColor: "#a855f7" },
  { name: "Sol", type: "Golden Solar Dynamo", primaryColor: "#f59e0b" },
];

export function parseStarAvatar(rawColor: string): { index: number; color: string } | null {
  if (!rawColor) return null;
  if (rawColor.startsWith("orbit-star::")) {
    const parts = rawColor.split("::");
    const idx = parseInt(parts[1] ?? "0", 10);
    const color = parts[2] || CELESTIAL_STARS[idx % ORBIT_STAR_COUNT]?.primaryColor || "#38bdf8";
    return { index: Number.isNaN(idx) ? 0 : idx % ORBIT_STAR_COUNT, color };
  }
  // Also treat old orbit-astro as celestial star
  if (rawColor.startsWith("orbit-astro::")) {
    const parts = rawColor.split("::");
    const idx = parseInt(parts[1] ?? "0", 10);
    return { index: Number.isNaN(idx) ? 0 : idx % ORBIT_STAR_COUNT, color: CELESTIAL_STARS[idx % ORBIT_STAR_COUNT]?.primaryColor || "#38bdf8" };
  }
  return null;
}

export function CelestialStarAvatar({
  index = 0,
  size = 36,
  isWorking = false,
  className,
}: {
  index?: number;
  size?: number;
  isWorking?: boolean;
  className?: string;
}) {
  const starIdx = Math.abs(index) % ORBIT_STAR_COUNT;
  const star = CELESTIAL_STARS[starIdx] ?? CELESTIAL_STARS[0]!;

  return (
    <div
      className={cn("relative shrink-0 select-none flex items-center justify-center rounded-full bg-[#050508] border border-white/10 overflow-hidden", className)}
      style={{ width: size, height: size }}
      data-working={isWorking}
      title={`${star.name} (${star.type})`}
    >
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(
          "w-full h-full transition-transform duration-500",
          isWorking ? "animate-pulse scale-105" : "hover:scale-105"
        )}
      >
        <defs>
          {/* Radial gradient for Sirius */}
          <radialGradient id="sirius-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="25%" stopColor="#bae6fd" />
            <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
          </radialGradient>

          {/* Radial gradient for Betelgeuse */}
          <radialGradient id="betelgeuse-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="30%" stopColor="#f97316" />
            <stop offset="70%" stopColor="#dc2626" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0" />
          </radialGradient>

          {/* Radial gradient for Polaris */}
          <radialGradient id="polaris-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#e0e7ff" />
            <stop offset="75%" stopColor="#818cf8" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#4338ca" stopOpacity="0" />
          </radialGradient>

          {/* Radial gradient for Vega */}
          <radialGradient id="vega-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="25%" stopColor="#c7d2fe" />
            <stop offset="60%" stopColor="#6366f1" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#312e81" stopOpacity="0" />
          </radialGradient>

          {/* Radial gradient for Pulsar */}
          <radialGradient id="pulsar-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fdf4ff" />
            <stop offset="20%" stopColor="#e879f9" />
            <stop offset="65%" stopColor="#9333ea" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#581c87" stopOpacity="0" />
          </radialGradient>

          {/* Radial gradient for Sol */}
          <radialGradient id="sol-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fffbeb" />
            <stop offset="30%" stopColor="#fbbf24" />
            <stop offset="70%" stopColor="#d97706" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#78350f" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* STAR 0: SIRIUS (Blue-White Luminary) */}
        {starIdx === 0 && (
          <g>
            <circle cx="32" cy="32" r="30" fill="url(#sirius-glow)" opacity="0.3" />
            <circle cx="32" cy="32" r="18" fill="url(#sirius-glow)" opacity="0.7" />
            {/* Diffraction Crosshairs (Astrophotography feature) */}
            <line x1="32" y1="6" x2="32" y2="58" stroke="#bae6fd" strokeWidth="1" strokeOpacity="0.6" strokeLinecap="round" />
            <line x1="6" y1="32" x2="58" y2="32" stroke="#bae6fd" strokeWidth="1" strokeOpacity="0.6" strokeLinecap="round" />
            <line x1="15" y1="15" x2="49" y2="49" stroke="#38bdf8" strokeWidth="0.6" strokeOpacity="0.3" />
            <line x1="49" y1="15" x2="15" y2="49" stroke="#38bdf8" strokeWidth="0.6" strokeOpacity="0.3" />
            {/* Luminous Nucleus */}
            <circle cx="32" cy="32" r="7" fill="#ffffff" />
            <circle cx="32" cy="32" r="3.5" fill="#f0f9ff" />
          </g>
        )}

        {/* STAR 1: BETELGEUSE (Red Supergiant) */}
        {starIdx === 1 && (
          <g>
            <circle cx="32" cy="32" r="30" fill="url(#betelgeuse-glow)" opacity="0.35" />
            <circle cx="32" cy="32" r="20" fill="url(#betelgeuse-glow)" opacity="0.75" />
            {/* Turbulent convective surface flares */}
            <circle cx="28" cy="28" r="9" fill="#f97316" fillOpacity="0.6" />
            <circle cx="36" cy="33" r="8" fill="#ea580c" fillOpacity="0.5" />
            <circle cx="31" cy="36" r="7" fill="#c2410c" fillOpacity="0.6" />
            {/* Supergiant Dense Core */}
            <circle cx="32" cy="32" r="8" fill="#fef08a" />
            <circle cx="32" cy="32" r="4" fill="#ffffff" />
            {/* Coronal mass arcs */}
            <path d="M18 24 Q32 12 46 24" stroke="#f97316" strokeWidth="1" strokeOpacity="0.5" fill="none" />
            <path d="M16 38 Q32 50 48 38" stroke="#ef4444" strokeWidth="1" strokeOpacity="0.4" fill="none" />
          </g>
        )}

        {/* STAR 2: POLARIS (North Star / Celestial Guide) */}
        {starIdx === 2 && (
          <g>
            <circle cx="32" cy="32" r="28" fill="url(#polaris-glow)" opacity="0.3" />
            {/* Celestial navigation concentric rings */}
            <circle cx="32" cy="32" r="22" stroke="#e0e7ff" strokeWidth="0.8" strokeOpacity="0.25" strokeDasharray="3 3" fill="none" />
            <circle cx="32" cy="32" r="15" stroke="#c7d2fe" strokeWidth="1" strokeOpacity="0.4" fill="none" />
            {/* 8-point subtle astronomical spikes */}
            <line x1="32" y1="4" x2="32" y2="60" stroke="#e0e7ff" strokeWidth="1.2" strokeOpacity="0.8" strokeLinecap="round" />
            <line x1="4" y1="32" x2="60" y2="32" stroke="#e0e7ff" strokeWidth="1.2" strokeOpacity="0.8" strokeLinecap="round" />
            <line x1="14" y1="14" x2="50" y2="50" stroke="#c7d2fe" strokeWidth="0.8" strokeOpacity="0.5" strokeLinecap="round" />
            <line x1="50" y1="14" x2="14" y2="50" stroke="#c7d2fe" strokeWidth="0.8" strokeOpacity="0.5" strokeLinecap="round" />
            {/* Core */}
            <circle cx="32" cy="32" r="6.5" fill="#ffffff" />
          </g>
        )}

        {/* STAR 3: VEGA (Sapphire Rapid Rotator with Planetary Disk) */}
        {starIdx === 3 && (
          <g>
            <circle cx="32" cy="32" r="28" fill="url(#vega-glow)" opacity="0.3" />
            {/* Oblate Circumstellar Accretion Disk */}
            <ellipse cx="32" cy="32" rx="28" ry="9" stroke="#818cf8" strokeWidth="1.5" strokeOpacity="0.5" fill="none" transform="rotate(-20 32 32)" />
            <ellipse cx="32" cy="32" rx="22" ry="7" stroke="#c7d2fe" strokeWidth="0.8" strokeOpacity="0.4" fill="none" transform="rotate(-20 32 32)" />
            {/* Oblate Rapid-Spinning Core */}
            <ellipse cx="32" cy="32" rx="11" ry="8.5" fill="#6366f1" transform="rotate(-20 32 32)" />
            <ellipse cx="32" cy="32" rx="7" ry="5.5" fill="#e0e7ff" transform="rotate(-20 32 32)" />
            <circle cx="32" cy="32" r="3" fill="#ffffff" />
          </g>
        )}

        {/* STAR 4: PULSAR (Magnetar / High-Energy Neutron Star) */}
        {starIdx === 4 && (
          <g>
            <circle cx="32" cy="32" r="28" fill="url(#pulsar-glow)" opacity="0.3" />
            {/* Relativistic Collimated Polar Jet Beams */}
            <path d="M32 32 L20 4 L44 4 Z" fill="#c084fc" fillOpacity="0.25" />
            <path d="M32 32 L20 60 L44 60 Z" fill="#c084fc" fillOpacity="0.25" />
            <line x1="32" y1="2" x2="32" y2="62" stroke="#f0abfc" strokeWidth="1.5" strokeOpacity="0.85" strokeLinecap="round" />
            {/* Magnetic Field Line Arcs */}
            <path d="M16 22 Q4 32 16 42" stroke="#a855f7" strokeWidth="1" strokeOpacity="0.6" fill="none" />
            <path d="M48 22 Q60 32 48 42" stroke="#a855f7" strokeWidth="1" strokeOpacity="0.6" fill="none" />
            {/* Dense Relativistic Core */}
            <circle cx="32" cy="32" r="7" fill="#9333ea" />
            <circle cx="32" cy="32" r="4" fill="#fdf4ff" />
          </g>
        )}

        {/* STAR 5: SOL (Golden Solar Dynamo) */}
        {starIdx === 5 && (
          <g>
            <circle cx="32" cy="32" r="30" fill="url(#sol-glow)" opacity="0.35" />
            <circle cx="32" cy="32" r="20" fill="url(#sol-glow)" opacity="0.8" />
            {/* Solar Prominence Flare Loops */}
            <path d="M22 14 Q32 6 42 14" stroke="#f59e0b" strokeWidth="1.2" strokeOpacity="0.7" fill="none" />
            <path d="M48 24 Q58 32 48 40" stroke="#f59e0b" strokeWidth="1.2" strokeOpacity="0.7" fill="none" />
            <path d="M14 26 Q6 34 14 42" stroke="#d97706" strokeWidth="1.2" strokeOpacity="0.6" fill="none" />
            {/* Photosphere & Radiant Core */}
            <circle cx="32" cy="32" r="11" fill="#fbbf24" />
            <circle cx="32" cy="32" r="6" fill="#fffbeb" />
            <circle cx="32" cy="32" r="2.5" fill="#ffffff" />
          </g>
        )}
      </svg>

      {/* Live activity ring */}
      {isWorking ? (
        <svg
          className="absolute inset-0 pointer-events-none animate-spin"
          style={{ animationDuration: "3s" }}
          viewBox="0 0 64 64"
          fill="none"
        >
          <circle
            cx="32"
            cy="32"
            r="30"
            stroke={star.primaryColor}
            strokeWidth="2.5"
            strokeDasharray="40 100"
            strokeLinecap="round"
          />
        </svg>
      ) : null}
    </div>
  );
}

