import { cn } from "@rakazo/ui-web";

export interface OrbitLogoMarkProps {
  className?: string;
  imgClassName?: string;
}

/**
 * Orion — the constellation itself.
 *
 * Seven stars (Betelgeuse, Bellatrix, the belt, Saiph, Rigel) connected by thin
 * light, with the belt carrying the accent colour. Drawn in `currentColor` so
 * it inherits the surface it sits on, and every star twinkles on its own
 * offset so the mark feels alive without drawing attention.
 */
const STARS: ReadonlyArray<{ x: number; y: number; r: number; accent?: boolean }> = [
  { x: 32, y: 6, r: 1.7 }, // Meissa, the head
  { x: 16, y: 18, r: 3.1, accent: true }, // Betelgeuse
  { x: 48, y: 15, r: 2.3 }, // Bellatrix
  { x: 26, y: 32, r: 2 }, // Alnitak
  { x: 32, y: 33, r: 2.1, accent: true }, // Alnilam, the belt's centre
  { x: 38, y: 32, r: 2 }, // Mintaka
  { x: 20, y: 53, r: 2.3 }, // Saiph
  { x: 49, y: 52, r: 2.6 }, // Rigel
];

const LINES =
  "M32 6 L16 18 L26 32 M32 6 L48 15 L38 32 M26 32 L32 33 L38 32 M26 32 L20 53 M38 32 L49 52";

export function OrbitLogoMark({ className, imgClassName }: OrbitLogoMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Orion"
      className={cn("orion-mark relative inline-block shrink-0", className, imgClassName)}
    >
      <path
        d={LINES}
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {STARS.map((star, index) => (
        <g key={`${star.x}-${star.y}`}>
          {star.accent ? (
            <circle cx={star.x} cy={star.y} r={star.r * 2.6} fill="currentColor" fillOpacity="0.08" />
          ) : null}
          <circle
            className="orion-star"
            style={{ animationDelay: `${(index % 4) * 0.9}s` }}
            cx={star.x}
            cy={star.y}
            r={star.r}
            fill="currentColor"
            fillOpacity={star.accent ? 1 : 0.85}
          />
        </g>
      ))}
    </svg>
  );
}

/** Canonical Orion vector mark, for places that only need the glyph. */
export function OrbitVectorMark({
  className,
  strokeWidth = 1.5,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d={LINES}
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {STARS.map((star) => (
        <circle key={`${star.x}-${star.y}`} cx={star.x} cy={star.y} r={star.r} fill="currentColor" />
      ))}
    </svg>
  );
}
