import { useLingui } from "@lingui/react/macro";
import { Spinner } from "@rakazo/ui-web";

/** A whole-page wait. The spinner fades in late, so a quick load paints nothing in between. */
export function PageLoading(props: React.ComponentPropsWithoutRef<"div">) {
  const { t } = useLingui();
  return (
    <div className="grid h-full place-items-center bg-background" {...props}>
      <div className="flex flex-col items-center gap-3 animate-in fade-in-0 fill-mode-both duration-300">
        <div className="relative flex items-center justify-center">
          <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 blur-md animate-pulse" />
          <Spinner className="size-6 text-cyan-400" aria-label={t`Loading Orion…`} />
        </div>
        <span className="text-caption font-medium orbit-gradient-text tracking-wider uppercase">Orion</span>
      </div>
    </div>
  );
}
