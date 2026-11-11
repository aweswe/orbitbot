import { cn } from "@forion/orbit-ui-web";

export interface OrbitLogoMarkProps {
  /** Outer wrapper — set the size here (for example `h-8 w-8`). */
  className?: string;
  /** Extra classes on each image, such as a hover transition. */
  imgClassName?: string;
}

/**
 * The shared Orbit brand mark. These are the same light and dark PNGs used by the main Orbit
 * application, so the mark stays identical across both products.
 */
export function OrbitLogoMark({ className, imgClassName }: OrbitLogoMarkProps) {
  return (
    <span
      role="img"
      aria-label="Orbit"
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
    >
      <img
        src="/assets/imgs/logo/dark-logo.png"
        alt=""
        width={512}
        height={512}
        className={cn("h-full w-full object-contain dark:hidden", imgClassName)}
        draggable={false}
      />
      <img
        src="/assets/imgs/logo/white-logo.png"
        alt=""
        width={512}
        height={512}
        className={cn("hidden h-full w-full object-contain dark:block", imgClassName)}
        draggable={false}
      />
    </span>
  );
}

/** Inline vector mark for surfaces that need `currentColor` instead of a themed image. */
export function OrbitVectorMark({
  className,
  strokeWidth = 1.5,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="3.5"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
      <ellipse
        cx="12"
        cy="12"
        rx="10"
        ry="3.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeOpacity="0.4"
        transform="rotate(45 12 12)"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="10"
        ry="3.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        transform="rotate(-45 12 12)"
      />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}
