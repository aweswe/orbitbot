/**
 * Orbit Cosmic Companion Creatures ("Space Starlings")
 * Sentient cosmic living beings with expressive eyes, personality, and deep-space character.
 *
 * Designed to provide the warm, alive feel of Grok/Orbit companions while being
 * fundamentally cosmic and space-themed.
 */
import type { CSSProperties } from "react";
import { cn } from "./lib/utils.js";

export const ORBIT_CREATURE_COUNT = 6;

export interface CosmicCreatureDef {
  name: string;
  role: string;
  color: string;
  glowColor: string;
}

export const COSMIC_CREATURES: CosmicCreatureDef[] = [
  {
    name: "Cosmo",
    role: "Nebula Astral Being",
    color: "#38bdf8",
    glowColor: "rgba(56, 189, 248, 0.4)",
  },
  {
    name: "Astro",
    role: "Helmet Space Companion",
    color: "#818cf8",
    glowColor: "rgba(129, 140, 248, 0.4)",
  },
  {
    name: "Nova",
    role: "Solar Star-Sprite",
    color: "#f97316",
    glowColor: "rgba(249, 115, 22, 0.4)",
  },
  {
    name: "Luna",
    role: "Crescent Voidling",
    color: "#a855f7",
    glowColor: "rgba(168, 85, 247, 0.4)",
  },
  {
    name: "Orbit",
    role: "Pulsar Cyber-Explorer",
    color: "#22d3ee",
    glowColor: "rgba(34, 211, 238, 0.4)",
  },
  {
    name: "Stardust",
    role: "Emerald Aurora Spirit",
    color: "#10b981",
    glowColor: "rgba(16, 185, 129, 0.4)",
  },
];

export function parseCreatureAvatar(rawColor: string): { index: number; color: string } | null {
  if (!rawColor) return null;
  if (
    rawColor.startsWith("orbit-creature::") ||
    rawColor.startsWith("orbit-star::") ||
    rawColor.startsWith("orbit-astro::")
  ) {
    const parts = rawColor.split("::");
    const idx = parseInt(parts[1] ?? "0", 10);
    const resolvedIdx = Number.isNaN(idx) ? 0 : Math.abs(idx) % ORBIT_CREATURE_COUNT;
    const color = parts[2] || COSMIC_CREATURES[resolvedIdx]?.color || "#38bdf8";
    return { index: resolvedIdx, color };
  }
  return null;
}

export function CosmicCreatureAvatar({
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
  const creatureIdx = Math.abs(index) % ORBIT_CREATURE_COUNT;
  const creature = COSMIC_CREATURES[creatureIdx] ?? COSMIC_CREATURES[0]!;

  return (
    <div
      className={cn(
        "relative shrink-0 select-none flex items-center justify-center rounded-2xl overflow-visible transition-all duration-300",
        className,
      )}
      style={{
        width: size,
        height: size,
        filter: isWorking
          ? `drop-shadow(0 0 10px ${creature.glowColor}) drop-shadow(0 0 2px #ffffff)`
          : `drop-shadow(0 2px 6px rgba(0, 0, 0, 0.5))`,
      }}
      data-working={isWorking}
      title={`${creature.name} (${creature.role})`}
    >
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(
          "w-full h-full overflow-visible transition-transform duration-300",
          isWorking ? "animate-pulse scale-[1.04]" : "hover:scale-105",
        )}
      >
        <defs>
          {/* Subtle gradient for creature depth */}
          <linearGradient id={`creature-grad-${creatureIdx}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="60%" stopColor={creature.color} />
            <stop offset="100%" stopColor="#050508" stopOpacity="0.8" />
          </linearGradient>

          {/* Visor shine */}
          <linearGradient id="astro-visor-shine" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* ========================================================
            0. COSMO — Azure Nebula Astral Being (curious, bouncy, alive)
           ======================================================== */}
        {creatureIdx === 0 && (
          <g>
            {/* Orbital Dust Ring behind */}
            <ellipse
              cx="24"
              cy="27"
              rx="22"
              ry="6"
              stroke="#38bdf8"
              strokeWidth="1.2"
              strokeOpacity="0.3"
              fill="none"
              transform="rotate(-15 24 27)"
            />

            {/* Living organic body with soft cosmic curve */}
            <path
              d="M12 26 C11 15 17 9 24 9 C31 9 37 15 36 26 C35 37 30 40 24 40 C18 40 13 37 12 26 Z"
              fill={creature.color}
            />
            {/* Subtle inner highlight */}
            <path
              d="M15 24 C14 17 18 12 24 12 C30 12 34 17 33 24 C31 19 28 14 24 14 C20 14 17 19 15 24 Z"
              fill="#ffffff"
              fillOpacity="0.35"
            />

            {/* Expressive Living Eyes */}
            <g className="eyes-group">
              {/* Left Eye */}
              <circle cx="20" cy="23" r="3.6" fill="#ffffff" />
              <circle cx="20.8" cy="23" r="2.1" fill="#050508" />
              <circle cx="21.5" cy="22.2" r="0.8" fill="#ffffff" />

              {/* Right Eye */}
              <circle cx="28" cy="23" r="3.6" fill="#ffffff" />
              <circle cx="28.8" cy="23" r="2.1" fill="#050508" />
              <circle cx="29.5" cy="22.2" r="0.8" fill="#ffffff" />
            </g>

            {/* Orbital Ring in front */}
            <path
              d="M5 29 C12 34 32 30 43 25"
              stroke="#bae6fd"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
              strokeOpacity="0.75"
            />

            {/* Cute antenna sensor / star beacon */}
            <circle cx="24" cy="6" r="1.8" fill="#ffffff" />
            <line x1="24" y1="9" x2="24" y2="7.8" stroke="#38bdf8" strokeWidth="1.2" />
          </g>
        )}

        {/* ========================================================
            1. ASTRO — Sentient Helmet Space Companion (peering warmly)
           ======================================================== */}
        {creatureIdx === 1 && (
          <g>
            {/* Rounded helmet body */}
            <rect
              x="10"
              y="10"
              width="28"
              height="28"
              rx="14"
              fill="#0e111a"
              stroke={creature.color}
              strokeWidth="1.8"
            />

            {/* Glass Visor Faceplate */}
            <rect x="13" y="13" width="22" height="22" rx="11" fill="#151928" />
            <path
              d="M15 17 Q24 13 33 17 Q34 23 33 27 Q24 23 15 27 Z"
              fill="url(#astro-visor-shine)"
            />

            {/* Two Friendly Peering Eyes inside helmet visor */}
            <g className="eyes-group">
              {/* Left Eye */}
              <ellipse cx="19.5" cy="23" rx="3.2" ry="4" fill="#ffffff" />
              <circle cx="20.2" cy="23" r="2.1" fill="#1e1b4b" />
              <circle cx="20.8" cy="21.8" r="0.9" fill="#ffffff" />

              {/* Right Eye */}
              <ellipse cx="28.5" cy="23" rx="3.2" ry="4" fill="#ffffff" />
              <circle cx="29.2" cy="23" r="2.1" fill="#1e1b4b" />
              <circle cx="29.8" cy="21.8" r="0.9" fill="#ffffff" />
            </g>

            {/* Side audio communicator pucks */}
            <rect x="7" y="21" width="3.5" height="7" rx="1.7" fill={creature.color} />
            <rect x="37.5" y="21" width="3.5" height="7" rx="1.7" fill={creature.color} />
          </g>
        )}

        {/* ========================================================
            2. NOVA — Living Solar Flare Spirit (warm, radiant, smiling)
           ======================================================== */}
        {creatureIdx === 2 && (
          <g>
            {/* Corona plasma flares */}
            <circle cx="24" cy="24" r="19" fill="#f97316" fillOpacity="0.25" />
            <circle cx="24" cy="24" r="16" fill="#ea580c" fillOpacity="0.4" />

            {/* Bouncy solar organism shape */}
            <path
              d="M13 25 C12 16 17 11 24 11 C31 11 36 16 35 25 C34 35 30 38 24 38 C18 38 14 35 13 25 Z"
              fill="#fb923c"
            />
            {/* Warm core */}
            <ellipse cx="24" cy="24" rx="10" ry="11" fill="#fef08a" />

            {/* Happy, intelligent eyes */}
            <g className="eyes-group">
              {/* Left Eye */}
              <circle cx="19.5" cy="23.5" r="3.3" fill="#ffffff" />
              <circle cx="19.5" cy="23.5" r="2" fill="#7c2d12" />
              <circle cx="20.2" cy="22.5" r="0.9" fill="#ffffff" />

              {/* Right Eye */}
              <circle cx="28.5" cy="23.5" r="3.3" fill="#ffffff" />
              <circle cx="28.5" cy="23.5" r="2" fill="#7c2d12" />
              <circle cx="29.2" cy="22.5" r="0.9" fill="#ffffff" />
            </g>

            {/* Little solar prominence cheek accents */}
            <circle cx="15.5" cy="28.5" r="1.5" fill="#f97316" fillOpacity="0.7" />
            <circle cx="32.5" cy="28.5" r="1.5" fill="#f97316" fillOpacity="0.7" />

            {/* Happy mouth curve */}
            <path
              d="M22 28.5 Q24 30.5 26 28.5"
              stroke="#7c2d12"
              strokeWidth="1.2"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        )}

        {/* ========================================================
            3. LUNA — Crescent Moon Voidling (deep cosmic, gentle, peering)
           ======================================================== */}
        {creatureIdx === 3 && (
          <g>
            {/* Nebula glow */}
            <circle cx="24" cy="24" r="18" fill="#a855f7" fillOpacity="0.2" />

            {/* Crescent Creature Silhouette */}
            <path
              d="M20 9 C30 9 38 16 38 26 C38 35 29 40 20 40 C28 36 31 29 31 24 C31 18 27 12 20 9 Z"
              fill="#c084fc"
            />
            {/* Soft inner critter */}
            <circle cx="23" cy="25" r="13" fill="#9333ea" />

            {/* Wide, curious eyes with glowing cosmic reflection */}
            <g className="eyes-group">
              {/* Left Eye */}
              <ellipse cx="18" cy="24" rx="3.4" ry="4.2" fill="#ffffff" />
              <circle cx="18.5" cy="24.2" r="2.2" fill="#3b0764" />
              <circle cx="19.2" cy="23" r="1" fill="#f5d0fe" />

              {/* Right Eye */}
              <ellipse cx="26.5" cy="24" rx="3.4" ry="4.2" fill="#ffffff" />
              <circle cx="27" cy="24.2" r="2.2" fill="#3b0764" />
              <circle cx="27.7" cy="23" r="1" fill="#f5d0fe" />
            </g>
          </g>
        )}

        {/* ========================================================
            4. ORBIT — Pulsar Cyber-Explorer (expressive cyan optic eyes)
           ======================================================== */}
        {creatureIdx === 4 && (
          <g>
            {/* Sleek rounded mech helmet chassis */}
            <rect
              x="11"
              y="11"
              width="26"
              height="26"
              rx="9"
              fill="#0f172a"
              stroke="#22d3ee"
              strokeWidth="1.5"
            />
            <rect x="14" y="15" width="20" height="18" rx="6" fill="#020617" />

            {/* Expressive glowing cyber eyes */}
            <g className="eyes-group">
              {/* Left Eye — expressive curved visor pill */}
              <rect x="17" y="19.5" width="5.5" height="7" rx="2.7" fill="#22d3ee" />
              <circle cx="19.5" cy="22" r="1.5" fill="#ffffff" />

              {/* Right Eye — expressive curved visor pill */}
              <rect x="25.5" y="19.5" width="5.5" height="7" rx="2.7" fill="#22d3ee" />
              <circle cx="28" cy="22" r="1.5" fill="#ffffff" />
            </g>

            {/* Antenna with pulsing beacon */}
            <line
              x1="24"
              y1="11"
              x2="24"
              y2="6"
              stroke="#22d3ee"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <circle cx="24" cy="5" r="1.8" fill="#67e8f9" />
          </g>
        )}

        {/* ========================================================
            5. STARDUST — Emerald Aurora Spirit (playful, wondering, joyful)
           ======================================================== */}
        {creatureIdx === 5 && (
          <g>
            {/* Aurora glow */}
            <circle cx="24" cy="24" r="18" fill="#10b981" fillOpacity="0.2" />

            {/* Playful organic teardrop/star-creature */}
            <path
              d="M24 8 C32 14 36 21 35 28 C34 36 29 40 24 40 C19 40 14 36 13 28 C12 21 16 14 24 8 Z"
              fill="#34d399"
            />
            {/* Soft chest highlight */}
            <ellipse cx="24" cy="28" rx="8" ry="8.5" fill="#a7f3d0" />

            {/* Big, wondering sparkling eyes */}
            <g className="eyes-group">
              {/* Left Eye */}
              <circle cx="19.5" cy="23.5" r="3.6" fill="#ffffff" />
              <circle cx="20.2" cy="23.5" r="2.2" fill="#064e3b" />
              <circle cx="20.8" cy="22.4" r="0.9" fill="#ffffff" />

              {/* Right Eye */}
              <circle cx="28.5" cy="23.5" r="3.6" fill="#ffffff" />
              <circle cx="29.2" cy="23.5" r="2.2" fill="#064e3b" />
              <circle cx="29.8" cy="22.4" r="0.9" fill="#ffffff" />
            </g>

            {/* Friendly smile */}
            <path
              d="M22 29 Q24 31 26 29"
              stroke="#064e3b"
              strokeWidth="1.2"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        )}
      </svg>

      {/* Orbit activity beacon ring when working */}
      {isWorking ? (
        <svg
          className="absolute inset-[-4px] pointer-events-none animate-spin"
          style={{ animationDuration: "3s" }}
          viewBox="0 0 56 56"
          fill="none"
        >
          <circle
            cx="28"
            cy="28"
            r="26"
            stroke={creature.color}
            strokeWidth="2.2"
            strokeDasharray="30 80"
            strokeLinecap="round"
          />
        </svg>
      ) : null}
    </div>
  );
}
