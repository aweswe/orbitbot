import { Trans } from "@lingui/react/macro";
import { Link } from "react-router-dom";
import { OrbitLogoMark } from "../components/OrbitLogoMark";
import { WindowChrome } from "./WindowChrome";

export function NotFoundPage() {
  return (
    <div className="flex min-h-full flex-col bg-background" data-rakazo-surface="not-found">
      <div className="app-drag flex gap-2 px-5 py-[18px]">
        <WindowChrome />
      </div>
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-5 pb-[90px] text-center">
        <OrbitLogoMark className="size-20 sm:size-24" />
        <div className="flex flex-col items-center gap-3">
          <p className="text-body-lg tracking-[0.2em] text-muted-foreground">404</p>
          {/* off-scale: 404 hero display title */}
          <h1 className="text-[40px] leading-tight tracking-[-0.03em] text-foreground sm:text-[52px]">
            <Trans>Page not found</Trans>
          </h1>
        </div>
        <Link
          to="/"
          className="app-no-drag rounded-full bg-primary px-[30px] py-[13px] text-heading3 text-primary-foreground transition hover:scale-[1.04]"
        >
          <Trans>Go home</Trans>
        </Link>
      </main>
    </div>
  );
}
