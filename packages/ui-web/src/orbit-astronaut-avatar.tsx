/**
 * Orbit Astronaut Avatar Set
 * Space-themed bot avatars using astronaut / spaceman motifs.
 * Used when bot color starts with "orbit-astro::" prefix.
 *
 * Usage: set bot color to `orbit-astro::0` through `orbit-astro::5` for each variant.
 */
import { cn } from "./lib/utils.js";

export const ORBIT_ASTRONAUT_COUNT = 6;

/** Parse an orbit-astro color string → { index, bgColor } */
export function parseAstroAvatar(rawColor: string): { index: number; bgColor: string } | null {
  if (!rawColor.startsWith("orbit-astro::")) return null;
  const parts = rawColor.split("::");
  const idx = parseInt(parts[1] ?? "0", 10);
  const bgColor = parts[2] ?? "#312e81";
  return { index: Number.isNaN(idx) ? 0 : idx % ORBIT_ASTRONAUT_COUNT, bgColor };
}

/** Inline SVG astronaut variants */
const ASTRONAUT_SVGS = [
  // 0 — Classic visor astronaut
  (color: string) => (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <circle cx="18" cy="18" r="18" fill={color} />
      {/* Helmet */}
      <ellipse cx="18" cy="16" rx="9" ry="10" fill="#e8eaf6" stroke="#fff" strokeWidth="1" />
      {/* Visor */}
      <ellipse cx="18" cy="17" rx="6" ry="5" fill="#1a237e" fillOpacity="0.85" />
      {/* Visor shine */}
      <ellipse cx="15.5" cy="14.5" rx="1.5" ry="1" fill="white" fillOpacity="0.5" transform="rotate(-20 15.5 14.5)" />
      {/* Suit body */}
      <rect x="12" y="25" width="12" height="7" rx="3" fill="#e8eaf6" />
      {/* Suit arms */}
      <rect x="6" y="25" width="6" height="4" rx="2" fill="#e8eaf6" />
      <rect x="24" y="25" width="6" height="4" rx="2" fill="#e8eaf6" />
      {/* Chest badge */}
      <rect x="15" y="27" width="6" height="3" rx="1" fill={color} fillOpacity="0.6" />
      {/* Stars */}
      <circle cx="5" cy="8" r="0.7" fill="white" fillOpacity="0.7" />
      <circle cx="30" cy="5" r="0.5" fill="white" fillOpacity="0.6" />
      <circle cx="8" cy="30" r="0.4" fill="white" fillOpacity="0.5" />
      <circle cx="29" cy="29" r="0.6" fill="white" fillOpacity="0.6" />
    </svg>
  ),
  // 1 — Spacewalking astronaut
  (color: string) => (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <circle cx="18" cy="18" r="18" fill={color} />
      {/* Helmet */}
      <circle cx="18" cy="14" r="8" fill="#e8eaf6" stroke="#c5cae9" strokeWidth="0.8" />
      {/* Visor */}
      <circle cx="18" cy="14" r="5.5" fill="#283593" />
      {/* Stars reflected in visor */}
      <circle cx="15" cy="12" r="0.5" fill="white" fillOpacity="0.7" />
      <circle cx="20" cy="11" r="0.4" fill="white" fillOpacity="0.6" />
      <circle cx="19" cy="15" r="0.3" fill="white" fillOpacity="0.5" />
      {/* Visor shine */}
      <ellipse cx="15" cy="12" rx="1.8" ry="1" fill="white" fillOpacity="0.3" transform="rotate(-30 15 12)" />
      {/* Suit */}
      <rect x="11" y="21" width="14" height="10" rx="4" fill="#e8eaf6" />
      {/* Arm extended */}
      <rect x="3" y="22" width="8" height="3.5" rx="1.75" fill="#e8eaf6" transform="rotate(-15 3 22)" />
      <rect x="25" y="21" width="8" height="3.5" rx="1.75" fill="#e8eaf6" transform="rotate(15 25 21)" />
      {/* Backpack */}
      <rect x="22" y="22" width="4" height="5" rx="1" fill="#9fa8da" />
      {/* Orbit logo on chest */}
      <circle cx="18" cy="26" r="2.5" fill="none" stroke={color} strokeOpacity="0.7" strokeWidth="0.8" />
      <circle cx="18" cy="26" r="1" fill={color} fillOpacity="0.7" />
    </svg>
  ),
  // 2 — Floating astronaut with helmet stars
  (color: string) => (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <circle cx="18" cy="18" r="18" fill={color} />
      {/* Suit body (rounded, puffy) */}
      <ellipse cx="18" cy="24" rx="8" ry="7" fill="#eceff1" />
      {/* Helmet */}
      <circle cx="18" cy="13" r="7.5" fill="#eceff1" stroke="#b0bec5" strokeWidth="0.8" />
      {/* Face / visor */}
      <ellipse cx="18" cy="13.5" rx="4.5" ry="4" fill="#37474f" />
      {/* Eye dots */}
      <circle cx="16" cy="13" r="0.8" fill="white" />
      <circle cx="20" cy="13" r="0.8" fill="white" />
      {/* Smile */}
      <path d="M16 15.5 Q18 17 20 15.5" stroke="white" strokeWidth="0.6" strokeLinecap="round" fill="none" />
      {/* Arms */}
      <ellipse cx="10" cy="23" rx="2.5" ry="4" fill="#eceff1" transform="rotate(-20 10 23)" />
      <ellipse cx="26" cy="23" rx="2.5" ry="4" fill="#eceff1" transform="rotate(20 26 23)" />
      {/* Gloves */}
      <circle cx="8" cy="26" r="2" fill="#78909c" />
      <circle cx="28" cy="26" r="2" fill="#78909c" />
      {/* Chest panel */}
      <rect x="14" y="21" width="8" height="5" rx="1.5" fill={color} fillOpacity="0.3" />
      <circle cx="16" cy="23.5" r="0.7" fill={color} fillOpacity="0.8" />
      <circle cx="20" cy="23.5" r="0.7" fill={color} fillOpacity="0.8" />
    </svg>
  ),
  // 3 — Alien astronaut / cosmonaut
  (color: string) => (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <circle cx="18" cy="18" r="18" fill={color} />
      {/* Helmet big bubble */}
      <circle cx="18" cy="14" r="9" fill="#e3f2fd" stroke="#90caf9" strokeWidth="0.8" />
      {/* Alien face (green tint) */}
      <ellipse cx="18" cy="14" rx="6" ry="6.5" fill="#a5d6a7" />
      {/* Large eyes */}
      <ellipse cx="15.5" cy="13" rx="2.2" ry="2.5" fill="#1a237e" />
      <ellipse cx="20.5" cy="13" rx="2.2" ry="2.5" fill="#1a237e" />
      {/* Eye shine */}
      <circle cx="14.8" cy="12.2" r="0.6" fill="white" />
      <circle cx="19.8" cy="12.2" r="0.6" fill="white" />
      {/* Smile */}
      <path d="M15 17 Q18 19 21 17" stroke="#388e3c" strokeWidth="0.8" strokeLinecap="round" fill="none" />
      {/* Antennae */}
      <line x1="15" y1="8" x2="13" y2="4" stroke="#90caf9" strokeWidth="0.8" strokeLinecap="round" />
      <circle cx="13" cy="3.5" r="1" fill="#42a5f5" />
      <line x1="21" y1="8" x2="23" y2="4" stroke="#90caf9" strokeWidth="0.8" strokeLinecap="round" />
      <circle cx="23" cy="3.5" r="1" fill="#42a5f5" />
      {/* Suit body */}
      <rect x="12" y="22" width="12" height="10" rx="3" fill="#e3f2fd" />
      {/* Chest logo */}
      <circle cx="18" cy="27" r="2" fill={color} fillOpacity="0.5" />
    </svg>
  ),
  // 4 — Rocket / mission specialist
  (color: string) => (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <circle cx="18" cy="18" r="18" fill={color} />
      {/* Rocket body */}
      <path d="M18 4 C14 8 12 14 12 20 L18 23 L24 20 C24 14 22 8 18 4Z" fill="#eceff1" />
      {/* Rocket tip */}
      <path d="M18 4 L15 8 L21 8 Z" fill="#ef5350" />
      {/* Window */}
      <circle cx="18" cy="14" r="3" fill="#42a5f5" stroke="#1565c0" strokeWidth="0.5" />
      {/* Astronaut face in window */}
      <circle cx="18" cy="14" r="2" fill="#ffe0b2" />
      <circle cx="17" cy="14" r="0.5" fill="#5d4037" />
      <circle cx="19" cy="14" r="0.5" fill="#5d4037" />
      <path d="M17 15.5 Q18 16.5 19 15.5" stroke="#795548" strokeWidth="0.5" fill="none" strokeLinecap="round" />
      {/* Fins */}
      <path d="M12 20 L8 26 L12 24 Z" fill="#ef5350" />
      <path d="M24 20 L28 26 L24 24 Z" fill="#ef5350" />
      {/* Exhaust */}
      <ellipse cx="18" cy="24" rx="3" ry="1.5" fill="#ff7043" fillOpacity="0.7" />
      <ellipse cx="18" cy="26" rx="2" ry="1" fill="#ffb74d" fillOpacity="0.5" />
      {/* Stars */}
      <circle cx="6" cy="10" r="0.5" fill="white" fillOpacity="0.8" />
      <circle cx="29" cy="8" r="0.6" fill="white" fillOpacity="0.7" />
      <circle cx="4" cy="24" r="0.4" fill="white" fillOpacity="0.6" />
      <circle cx="31" cy="22" r="0.5" fill="white" fillOpacity="0.7" />
    </svg>
  ),
  // 5 — Space station / satellite robot
  (color: string) => (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <circle cx="18" cy="18" r="18" fill={color} />
      {/* Robot body */}
      <rect x="11" y="14" width="14" height="14" rx="3" fill="#b0bec5" />
      {/* Head */}
      <rect x="12" y="7" width="12" height="10" rx="2.5" fill="#cfd8dc" />
      {/* Eyes (LEDs) */}
      <circle cx="15" cy="11" r="1.5" fill="#42a5f5" />
      <circle cx="21" cy="11" r="1.5" fill="#42a5f5" />
      <circle cx="15" cy="11" r="0.6" fill="white" />
      <circle cx="21" cy="11" r="0.6" fill="white" />
      {/* Mouth */}
      <rect x="14" y="14" width="8" height="1.5" rx="0.75" fill="#78909c" />
      {/* Antenna */}
      <line x1="18" y1="7" x2="18" y2="4" stroke="#90a4ae" strokeWidth="1" strokeLinecap="round" />
      <circle cx="18" cy="3.5" r="1.2" fill={color} />
      {/* Arms / solar panels */}
      <rect x="2" y="17" width="9" height="3" rx="1" fill="#78909c" />
      <rect x="25" y="17" width="9" height="3" rx="1" fill="#78909c" />
      {/* Solar cells */}
      <rect x="2" y="17" width="2.5" height="3" fill="#42a5f5" fillOpacity="0.7" />
      <rect x="5" y="17" width="2.5" height="3" fill="#42a5f5" fillOpacity="0.5" />
      <rect x="25" y="17" width="2.5" height="3" fill="#42a5f5" fillOpacity="0.7" />
      <rect x="28" y="17" width="2.5" height="3" fill="#42a5f5" fillOpacity="0.5" />
      {/* Chest control panel */}
      <rect x="14" y="18" width="8" height="6" rx="1" fill="#90a4ae" />
      <circle cx="16" cy="20" r="0.8" fill={color} fillOpacity="0.9" />
      <circle cx="18" cy="20" r="0.8" fill="#ef5350" fillOpacity="0.8" />
      <circle cx="20" cy="20" r="0.8" fill="#66bb6a" fillOpacity="0.8" />
      <rect x="14.5" y="22" width="7" height="1" rx="0.5" fill={color} fillOpacity="0.4" />
    </svg>
  ),
];

export interface AstroAvatarProps {
  index: number;
  bgColor: string;
  size?: number;
  isWorking?: boolean;
  className?: string;
}

export function AstroAvatar({ index, bgColor, size = 36, isWorking = false, className }: AstroAvatarProps) {
  const SvgFn = ASTRONAUT_SVGS[index % ORBIT_ASTRONAUT_COUNT];
  return (
    <div
      className={cn("rakazo-bot-avatar relative shrink-0 select-none", className)}
      data-working={isWorking}
      style={{ width: size, height: size }}
    >
      <div
        className={cn(
          "overflow-hidden rounded-full transition-transform duration-300",
          isWorking ? "animate-pulse scale-[1.04] motion-reduce:animate-none" : "hover:scale-[1.03]",
        )}
        style={{
          width: size,
          height: size,
          filter: isWorking
            ? `drop-shadow(0 0 8px ${bgColor}) drop-shadow(0 0 2px #ffffff)`
            : "drop-shadow(0 2px 4px rgba(0,0,0,0.45))",
        }}
      >
        {SvgFn ? SvgFn(bgColor) : null}
      </div>
      {isWorking ? (
        <svg
          className="rakazo-bot-avatar-ring rakazo-bot-avatar-ring-working absolute pointer-events-none"
          style={{ inset: -4, width: size + 8, height: size + 8 }}
          viewBox="0 0 48 48"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="24" cy="24" r="22"
            className="stroke-status-working"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeDasharray="45 80"
          />
        </svg>
      ) : null}
    </div>
  );
}

