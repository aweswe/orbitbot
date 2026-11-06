/**
 * Orbit Planet Bot Avatar
 * A pearl-white living planet with two curious animated eyes,
 * a luminous cosmic orbital ring, and an orbiting moon.
 *
 * Sourced from Orbit's official bot icon specification.
 */
import { cn } from "./lib/utils.js";

export interface OrbitPlanetAvatarProps {
  size?: number;
  ringColor?: string;
  isWorking?: boolean;
  className?: string;
  title?: string;
}

export function parsePlanetAvatar(rawColor: string): { ringColor: string } | null {
  if (!rawColor) return null;
  if (rawColor.startsWith("orbit-planet::")) {
    const parts = rawColor.split("::");
    const ringColor = parts[1] || "#ff8a3d";
    return { ringColor };
  }
  if (rawColor === "orbit-planet") {
    return { ringColor: "#ff8a3d" };
  }
  return null;
}

export function OrbitPlanetAvatar({
  size = 36,
  ringColor = "#ff8a3d",
  isWorking = false,
  className,
  title = "Orbit Bot",
}: OrbitPlanetAvatarProps) {
  // Scaling unit: 1u at 220px design size = size / 220
  const u = size / 220;

  return (
    <div
      className={cn(
        "relative shrink-0 select-none flex items-center justify-center rounded-2xl overflow-visible transition-all duration-300",
        className
      )}
      style={{
        width: size,
        height: size,
        filter: isWorking
          ? `drop-shadow(0 0 12px ${ringColor}80) drop-shadow(0 0 4px #ffffff)`
          : `drop-shadow(0 2px 8px rgba(0, 0, 0, 0.45))`,
      }}
      title={title}
      data-working={isWorking}
    >
      <svg
        viewBox="0 0 220 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(
          "w-full h-full overflow-visible transition-transform duration-300",
          isWorking ? "animate-pulse scale-[1.04]" : "hover:scale-105"
        )}
      >
        <defs>
          {/* Planet Spherical Pearl 3D Gradient */}
          <radialGradient id={`planet-sphere-${size}`} cx="30%" cy="26%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="30%" stopColor="#f1eff6" />
            <stop offset="72%" stopColor="#b9b5c8" />
            <stop offset="100%" stopColor="#8f8aa3" />
          </radialGradient>

          {/* Moon Gradient */}
          <radialGradient id={`moon-grad-${size}`} cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#ffd2b0" />
            <stop offset="100%" stopColor={ringColor} />
          </radialGradient>

          {/* Clip paths for front / back orbital ring */}
          <clipPath id={`ring-back-clip-${size}`}>
            <rect x="-20" y="0" width="260" height="110" />
          </clipPath>
          <clipPath id={`ring-front-clip-${size}`}>
            <rect x="-20" y="110" width="260" height="110" />
          </clipPath>

          {/* Glow filter for the front ring */}
          <filter id={`ring-glow-${size}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor={ringColor} floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Global -16 deg tilt for the orbital system */}
        <g transform="rotate(-16 110 110)">
          {/* 1. BACK ORBITAL RING (Layer behind planet) */}
          <g clipPath={`url(#ring-back-clip-${size})`} opacity="0.65">
            <ellipse
              cx="110"
              cy="110"
              rx="116"
              ry="32"
              stroke={ringColor}
              strokeWidth="5"
              fill="none"
            />
          </g>

          {/* 2. PLANET BODY */}
          <g transform="rotate(16 110 110)">
            {/* Planet Sphere */}
            <circle
              cx="110"
              cy="110"
              r="80"
              fill={`url(#planet-sphere-${size})`}
              className={isWorking ? "animate-bounce" : ""}
            />

            {/* Inner spherical shadow */}
            <circle
              cx="110"
              cy="110"
              r="80"
              fill="url(#inner-shadow)"
              style={{
                boxShadow: "inset -10px -14px 26px rgba(40,30,70,0.35)",
              }}
            />

            {/* Living Expressive Eyes */}
            <g className="eyes-group">
              {/* Left Eye: tilted slightly outwards */}
              <rect
                x="88"
                y="94"
                width="17"
                height="44"
                rx="8.5"
                fill="#16131f"
                transform="rotate(9 96.5 116)"
              />
              {/* Left Eye catch-light */}
              <circle cx="95" cy="104" r="3" fill="#ffffff" opacity="0.8" />

              {/* Right Eye */}
              <rect
                x="130"
                y="98"
                width="15"
                height="36"
                rx="7.5"
                fill="#16131f"
                transform="rotate(-4 137.5 116)"
              />
              {/* Right Eye catch-light */}
              <circle cx="136" cy="107" r="2.5" fill="#ffffff" opacity="0.8" />
            </g>
          </g>

          {/* 3. FRONT ORBITAL RING (Layer crossing in front of planet) */}
          <g clipPath={`url(#ring-front-clip-${size})`} filter={`url(#ring-glow-${size})`}>
            <ellipse
              cx="110"
              cy="110"
              rx="116"
              ry="32"
              stroke={ringColor}
              strokeWidth="5"
              fill="none"
            />
          </g>

          {/* 4. ORBITING MOON */}
          <circle
            cx="210"
            cy="118"
            r="8"
            fill={`url(#moon-grad-${size})`}
            filter={`drop-shadow(0 0 4px ${ringColor})`}
          />
        </g>
      </svg>
    </div>
  );
}

