import { useLingui } from "@lingui/react/macro";
import { OrbitLogoMark } from "./OrbitLogoMark";

/** A whole-page wait. The mark fades in late, so a quick load paints nothing in between. */
export function PageLoading(props: React.ComponentPropsWithoutRef<"div">) {
  const { t } = useLingui();
  return (
    <div className="grid h-full place-items-center bg-background" {...props}>
      <div className="flex flex-col items-center gap-3 animate-in fade-in-0 fill-mode-both duration-300">
        <OrbitLogoMark className="size-8 animate-pulse" />
        <span className="text-caption font-medium orbit-gradient-text tracking-wider uppercase">
          {t`Orbit`}
        </span>
      </div>
    </div>
  );
}
