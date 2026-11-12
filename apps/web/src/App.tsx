import type { LinkFavicons } from "@forion/orbit-chat-ui/web";
import { LinkFaviconsContext, RemoteImagesContext } from "@forion/orbit-chat-ui/web";
import { analyticsScreen } from "@forion/orbit-core";
import { Button } from "@forion/orbit-ui-web";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Navigate, Outlet, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import { formatElapsed, LoadingState } from "./components/ai/primitives";
import { CallLayout } from "./components/call/CallLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { MarkdownLinkPrompt } from "./components/markdown-link-prompt";
import { OrbitLogoMark } from "./components/OrbitLogoMark";
import { PageLoading } from "./components/PageLoading";
import { SubscriptionGate } from "./components/SubscriptionGate";
import { authClient } from "./lib/auth";
import { getTicketBoardEnabled, subscribeTicketBoardEnabled } from "./lib/bootstrap";
import { syncCallIdentity } from "./lib/call-session";
import { desktopBridge } from "./lib/desktop";
import { syncWebLogoAvatarIdentity } from "./lib/logo-avatar-activity";
import { identifyMonitoringUser } from "./lib/monitoring";
import { markAfterPaint, markOnce } from "./lib/performance";
import { lazyComponent } from "./lib/preload-recovery";
import { QueryUserProvider, setQueryUser } from "./lib/query";
import { remoteImagesPreference } from "./lib/remote-images-preference";
import { hasSignedInBefore, rememberSignedIn } from "./lib/returning-user";
import { rpc } from "./lib/rpc";
import {
  holdAnonymousGate,
  holdUnreachableGate,
  sessionGate,
  sessionRetryDelayMs,
  showSessionUnavailable,
} from "./lib/session-gate";
import {
  MCP_OAUTH_CALLBACK_PATH,
  newAccountDestination,
  SLACK_INSTALL_CALLBACK_PATH,
  signInNext,
} from "./lib/sign-in-next";
import { syncLogOutFailure } from "./lib/sign-out";
import { completeSsoCallback, SSO_CALLBACK_PATH } from "./lib/sso-flow";
import { IntegrationCallbackPage } from "./pages/IntegrationCallback";
import { IntegrationSetupPage } from "./pages/IntegrationSetup";
import { McpOAuthCallbackPage } from "./pages/McpOAuthCallback";
import { SharedPagePage } from "./pages/SharedPage";
import { ShellPage } from "./pages/Shell";
import { SlackInstallCallbackPage } from "./pages/SlackInstallCallback";

const AuthPage = lazyComponent(() => import("./pages/Auth").then((module) => module.AuthPage));
const PasswordResetPage = lazyComponent(() =>
  import("./pages/Auth").then((module) => module.PasswordResetPage),
);
const OnboardingPage = lazyComponent(() =>
  import("./pages/Onboarding").then((module) => module.OnboardingPage),
);
const NotFoundPage = lazyComponent(() =>
  import("./pages/NotFound").then((module) => module.NotFoundPage),
);
const ArtifactsPage = lazyComponent(() =>
  import("./pages/Artifacts").then((module) => module.ArtifactsPage),
);
const BoardPage = lazyComponent(() => import("./pages/Board").then((module) => module.BoardPage));
const AdminPluginsPage = lazyComponent(() =>
  import("./pages/AdminPluginsPage").then((module) => module.AdminPluginsPage),
);
const AdminAccessPage = lazyComponent(() =>
  import("./pages/AdminAccessPage").then((module) => module.AdminAccessPage),
);
const NavLinkPage = lazyComponent(() =>
  import("./pages/NavLinkPage").then((module) => module.NavLinkPage),
);
const InvitePage = lazyComponent(() =>
  import("./pages/Invite").then((module) => module.InvitePage),
);

function SsoCallbackPage() {
  useEffect(() => {
    completeSsoCallback();
  }, []);
  return null;
}

// Link icons come from our API, which fetches and caches them; the browser never asks the site.
const linkFavicons: LinkFavicons = {
  load: (origin) => rpc.links.favicon({ origin }),
};

export function App() {
  const loadRemoteImages = remoteImagesPreference.use();
  return (
    <RemoteImagesContext.Provider value={loadRemoteImages}>
      <LinkFaviconsContext.Provider value={linkFavicons}>
        <ErrorBoundary fallback={<AppFailed />}>
          {window.location.pathname === SSO_CALLBACK_PATH ? (
            <SsoCallbackPage />
          ) : window.location.pathname === "/integrations/callback" ? (
            <IntegrationCallbackPage />
          ) : (
            <SessionApp />
          )}
        </ErrorBoundary>
      </LinkFaviconsContext.Provider>
    </RemoteImagesContext.Provider>
  );
}

function SessionApp() {
  const [searchParams] = useSearchParams();
  const next = signInNext(searchParams.get("next"));
  const ticketBoardEnabled = useSyncExternalStore(
    subscribeTicketBoardEnabled,
    getTicketBoardEnabled,
    () => false,
  );
  const session = authClient.useSession();
  const { pathname, search } = useLocation();
  const screen = analyticsScreen(pathname);
  const analyticsUserId = session.data?.user.id;
  const lastScreen = useRef<string | undefined>(undefined);
  useEffect(() => {
    // A pending session is not a sign-out; startup already tagged the signed-in user.
    if (session.isPending) return;
    void identifyMonitoringUser(Boolean(analyticsUserId));
  }, [analyticsUserId, session.isPending]);
  useEffect(() => {
    if (!analyticsUserId) {
      lastScreen.current = undefined;
      return;
    }
    if (!screen) return;
    const key = `${analyticsUserId}:${screen}`;
    if (lastScreen.current === key) return;
    lastScreen.current = key;
    void Promise.resolve()
      .then(() => rpc.analytics.screen({ screen, surface: desktopBridge() ? "desktop" : "web" }))
      .catch(() => undefined);
  }, [analyticsUserId, screen]);
  const gate = sessionGate(session);
  useLayoutEffect(() => {
    if (gate !== "authenticated" && gate !== "anonymous") return;
    syncWebLogoAvatarIdentity(analyticsUserId ?? null);
    syncCallIdentity(analyticsUserId ?? null);
    syncLogOutFailure(gate === "authenticated");
    if (gate === "authenticated") rememberSignedIn();
  }, [gate, analyticsUserId]);
  useEffect(() => {
    if (gate === "authenticated" || gate === "anonymous") setQueryUser(analyticsUserId ?? null);
  }, [gate, analyticsUserId]);
  const [holdingUnreachable, setHoldingUnreachable] = useState(false);
  const nextHolding = holdUnreachableGate(gate, holdingUnreachable);
  if (nextHolding !== holdingUnreachable) setHoldingUnreachable(nextHolding);
  const [holdingAnonymous, setHoldingAnonymous] = useState(false);
  const nextHoldingAnonymous = holdAnonymousGate(gate, holdingAnonymous);
  if (nextHoldingAnonymous !== holdingAnonymous) setHoldingAnonymous(nextHoldingAnonymous);

  useLayoutEffect(() => {
    if (session.isPending) return;
    markOnce("rk:renderer:session-committed");
    markAfterPaint("rk:renderer:session-painted");
  }, [session.isPending]);

  if (showSessionUnavailable(gate, nextHolding)) {
    return <SessionUnavailable refetch={session.refetch} />;
  }
  if (gate === "loading" && !nextHoldingAnonymous) {
    return <PageLoading data-rakazo-app-state="session-pending" />;
  }

  const user = session.data?.user;
  return (
    <QueryUserProvider value={user?.id ?? null}>
      <MarkdownLinkPrompt>
        <div className="h-full" data-rakazo-app-state="ready">
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route
                path="/"
                element={
                  <Navigate
                    to={user ? "/app" : hasSignedInBefore() ? "/sign-in" : "/sign-up"}
                    replace
                  />
                }
              />
              <Route
                path="/sign-in"
                element={
                  user ? <Navigate to={next ?? "/app"} replace /> : <AuthPage key="in" mode="in" />
                }
              />
              <Route
                path="/sign-up"
                element={
                  user ? (
                    <Navigate to={newAccountDestination(next)} replace />
                  ) : (
                    <AuthPage key="up" mode="up" />
                  )
                }
              />
              <Route
                path="/forgot-password"
                element={
                  user ? <Navigate to="/app" replace /> : <AuthPage key="forgot" mode="forgot" />
                }
              />
              <Route path="/reset-password" element={<PasswordResetPage />} />
              <Route path="/p/:slugToken" element={<SharedPagePage />} />
              <Route
                path={MCP_OAUTH_CALLBACK_PATH}
                element={
                  user ? (
                    <McpOAuthCallbackPage />
                  ) : (
                    <Navigate
                      to={`/sign-in?next=${encodeURIComponent(pathname + search)}`}
                      replace
                    />
                  )
                }
              />
              <Route
                path={SLACK_INSTALL_CALLBACK_PATH}
                element={
                  user ? (
                    <SlackInstallCallbackPage />
                  ) : (
                    <Navigate
                      to={`/sign-in?next=${encodeURIComponent(pathname + search)}`}
                      replace
                    />
                  )
                }
              />
              <Route
                path="/integrations/setup"
                element={
                  user ? (
                    <IntegrationSetupPage />
                  ) : (
                    <Navigate to="/sign-in?next=/integrations/setup" replace />
                  )
                }
              />
              <Route
                path="/admin/plugins"
                element={
                  user ? (
                    <AdminPluginsPage />
                  ) : (
                    <Navigate to="/sign-in?next=/admin/plugins" replace />
                  )
                }
              />
              <Route
                path="/invite/:token"
                element={
                  user ? (
                    <InvitePage />
                  ) : (
                    <Navigate to={`/sign-in?next=${encodeURIComponent(pathname)}`} replace />
                  )
                }
              />
              <Route
                path="/admin/access"
                element={
                  user ? <AdminAccessPage /> : <Navigate to="/sign-in?next=/admin/access" replace />
                }
              />
              <Route
                element={
                  user ? (
                    <SubscriptionGate fallback={<PageLoading />}>
                      <Outlet />
                    </SubscriptionGate>
                  ) : (
                    <Navigate to="/sign-in" replace />
                  )
                }
              >
                <Route path="/app" element={<ShellPage />} />
                <Route path="/app/g/:groupId" element={<ShellPage />} />
                <Route path="/app/:botId" element={<ShellPage />} />
                <Route element={<CallLayout />}>
                  <Route path="/onboarding/:step?" element={<OnboardingPage />} />
                  <Route path="/app/artifacts" element={<ArtifactsPage />} />
                  <Route path="/app/artifacts/:artifactId" element={<ArtifactsPage />} />
                  {ticketBoardEnabled ? <Route path="/app/board" element={<BoardPage />} /> : null}
                  <Route path="/app/x/:linkId" element={<NavLinkPage />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </div>
      </MarkdownLinkPrompt>
    </QueryUserProvider>
  );
}

/**
 * A session lookup that never reached the server is not a sign-out, so the app
 * waits and retries here instead of routing to sign-in and stranding a signed-in
 * user. Better Auth only polls once a session exists, so the retry lives here.
 */
function SessionUnavailable({ refetch }: { refetch: () => Promise<void> }) {
  const { t } = useLingui();
  const [attempt, setAttempt] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const retryImmediately = useRef(false);
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  const [mountedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);

  const elapsed = formatElapsed(mountedAt, now);

  useEffect(() => {
    let cancelled = false;
    const delay = retryImmediately.current ? 0 : sessionRetryDelayMs(attempt);
    retryImmediately.current = false;
    const timer = setTimeout(() => {
      void refetchRef.current().finally(() => {
        if (!cancelled) setAttempt((value) => value + 1);
      });
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [attempt, retryKey]);

  return (
    <div className="relative grid h-full place-items-center overflow-hidden bg-background px-6 text-center select-none">
      {/* Cosmic ambient glow backdrop */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-96 w-96 rounded-full bg-primary/10 blur-[120px] animate-pulse" />
        <div className="h-80 w-80 rounded-full bg-warning/10 blur-[140px]" />
      </div>

      {/* Floating glassmorphic orbital status card */}
      <div className="relative flex flex-col items-center max-w-sm sm:max-w-md w-full p-8 sm:p-10 rounded-3xl bg-card/60 border border-border/50 backdrop-blur-2xl shadow-2xl">
        {/* Animated Orbit Planet with pulsing signal radar rings */}
        <div className="relative mb-6 flex items-center justify-center">
          <div className="absolute h-24 w-24 rounded-full border border-primary/25 animate-ping opacity-35" />
          <div className="absolute h-32 w-32 rounded-full border border-warning/20 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite] opacity-25" />
          <OrbitLogoMark className="size-16" />
        </div>

        {/* Live Reconnecting Status Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning/10 border border-warning/25 text-warning text-caption font-mono font-medium tracking-wide">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning/75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-warning" />
          </span>
          <span>{t`Reconnecting`}</span>
          <span className="text-muted-foreground/50">•</span>
          <span className="tabular-nums">{elapsed}</span>
        </div>

        {/* Title & Description */}
        <h2 className="mt-4 text-heading2 font-semibold tracking-tight text-foreground">
          <Trans>Lost connection to Orbit</Trans>
        </h2>
        <p className="mt-2 text-body-sm text-muted-foreground/80 leading-relaxed max-w-[280px]">
          <Trans>
            Can&apos;t reach the server. Attempting to re-establish your workspace link...
          </Trans>
        </p>

        {/* Action Button */}
        <div className="mt-6 flex flex-col items-center w-full sm:w-auto">
          <Button
            variant="default"
            size="lg"
            className="w-full sm:w-auto px-7 py-2.5 rounded-xl font-medium text-body-sm shadow-lg transition-all duration-200 active:scale-95 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
            onClick={() => {
              retryImmediately.current = true;
              setAttempt(0);
              setRetryKey((key) => key + 1);
            }}
          >
            <Trans>Retry now</Trans>
          </Button>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3.5 text-caption text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
          >
            <Trans>Or reload window</Trans>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Last resort for a render failure no inner boundary caught: offer a reload instead of a blank page. */
function AppFailed() {
  return (
    <div
      className="relative grid h-full place-items-center overflow-hidden bg-background px-6 text-center select-none"
      data-rakazo-app-state="failed"
    >
      {/* Subtle red/cosmic alert ambient glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-96 w-96 rounded-full bg-destructive/10 blur-[130px]" />
      </div>

      <div className="relative flex flex-col items-center max-w-sm sm:max-w-md w-full p-8 sm:p-10 rounded-3xl bg-card/60 border border-border/50 backdrop-blur-2xl shadow-2xl">
        <div className="relative mb-6 flex items-center justify-center">
          <OrbitLogoMark className="size-16" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/10 border border-destructive/20 text-destructive text-caption font-medium">
          <Trans>System Interruption</Trans>
        </div>

        <h2 className="mt-4 text-heading2 font-semibold tracking-tight text-foreground">
          <Trans>Something went wrong</Trans>
        </h2>
        <p className="mt-2 text-body-sm text-muted-foreground/80 leading-relaxed max-w-[280px]">
          <Trans>
            Orbit encountered an unexpected state. Refreshing will reload the interface cleanly.
          </Trans>
        </p>

        <div className="mt-6">
          <Button
            variant="default"
            size="lg"
            className="px-7 py-2.5 rounded-xl font-medium text-body-sm shadow-lg transition-all duration-200 active:scale-95 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
            onClick={() => window.location.reload()}
          >
            <Trans>Refresh</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
}
