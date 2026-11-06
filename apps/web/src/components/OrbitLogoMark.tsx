import { cn } from "@rakazo/ui-web";

export interface OrbitLogoMarkProps {
  className?: string;
  imgClassName?: string;
}

/** Theme-aware PNG mark from Orbit Microservices (`dark-logo.png` / `white-logo.png`). */
export function OrbitLogoMark({ className, imgClassName }: OrbitLogoMarkProps) {
  return (
    <span
      role="img"
      aria-label="Orbit"
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
    >
      <img
        src="/assets/imgs/logo/white-logo.png"
        alt=""
        width={512}
        height={512}
        className={cn("h-full w-full object-contain filter drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]", imgClassName)}
        draggable={false}
      />
    </span>
  );
}

/** Canonical Orbit vector mark SVG */
export function OrbitVectorMark({ className, strokeWidth = 1.5 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="12" cy="12" r="3.5" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth={strokeWidth} />
      <ellipse cx="12" cy="12" rx="10" ry="3.5" stroke="currentColor" strokeWidth={strokeWidth} strokeOpacity="0.4" transform="rotate(45 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="3.5" stroke="currentColor" strokeWidth={strokeWidth} transform="rotate(-45 12 12)" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

