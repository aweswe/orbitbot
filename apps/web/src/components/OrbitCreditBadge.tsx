import { Button } from "@forion/orbit-ui-web";
import { Wallet } from "lucide-react";
import { useEffect, useState } from "react";

export function formatWalletCreditsDisplay(available: number): string {
  if (available === 0) return "0";
  if (available >= 10) return Math.round(available).toLocaleString();
  return available.toFixed(1);
}

interface OrbitBillingData {
  wallet?: {
    balance?: number;
    lockedBalance?: number;
    availableBalance?: number;
  };
  subscription?: {
    planId?: string;
    status?: string;
  };
  executionTier?: string;
}

export interface OrbitCreditBadgeProps {
  onClick?: () => void;
  collapsed?: boolean;
  className?: string;
}

/**
 * Orbit Credit Shower / Trigger
 * Exact UI/UX match with Orbit Chat CreditsTrigger:
 * - Wallet icon with primary accent
 * - Tabular-nums formatted credit balance
 * - Hover state and click-to-open billing dialog
 * - Auto-refreshing 30s polling against central ledger
 */
export function OrbitCreditBadge({
  onClick,
  collapsed = false,
  className = "",
}: OrbitCreditBadgeProps) {
  const [billing, setBilling] = useState<OrbitBillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function fetchBilling() {
      try {
        const res = await fetch("/api/orbit/billing");
        if (!mounted) return;
        if (!res.ok) {
          setUnavailable(true);
          return;
        }
        const json = await res.json();
        if (json.data) {
          setBilling(json.data);
          setUnavailable(false);
        } else {
          setUnavailable(true);
        }
      } catch (err) {
        console.warn("Could not fetch Orbit billing:", err);
        if (mounted) setUnavailable(true);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void fetchBilling();
    const interval = setInterval(fetchBilling, 30_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const available = billing?.wallet?.availableBalance ?? billing?.wallet?.balance;
  const locked = billing?.wallet?.lockedBalance ?? 0;

  if (unavailable || available === undefined || available === null) return null;

  const lockedTitle = locked > 0 ? ` — ${locked.toFixed(1)} credits in use` : "";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      title={`Credits & billing${lockedTitle} — click to manage`}
      onClick={onClick}
      className={`h-7 min-w-0 max-w-full gap-1.5 overflow-hidden px-2 text-xs text-foreground hover:bg-accent/50 ${
        collapsed ? "justify-center px-1" : ""
      } ${className}`}
    >
      <Wallet
        className={`text-primary shrink-0 ${collapsed ? "h-[18px] w-[18px]" : "h-3.5 w-3.5"}`}
        aria-hidden
      />
      <span
        className={`min-w-0 max-w-[min(100%,8rem)] truncate tabular-nums font-medium ${
          collapsed ? "text-center text-[10px] font-semibold" : "text-left"
        }`}
      >
        {loading
          ? "…"
          : collapsed && available >= 1000
            ? `${Math.floor(available / 1000)}k`
            : formatWalletCreditsDisplay(available)}
      </span>
    </Button>
  );
}
