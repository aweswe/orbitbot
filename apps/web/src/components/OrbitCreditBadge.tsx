import { Zap } from "lucide-react";
import { useEffect, useState } from "react";

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

export function OrbitCreditBadge() {
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
          // 401 (signed out) and 503 (control plane down) both mean "no balance to show".
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
    // Poll every 30 seconds for a live balance update.
    const interval = setInterval(fetchBilling, 30_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const balance = billing?.wallet?.availableBalance ?? billing?.wallet?.balance;
  // Never invent a balance. If the control plane has nothing to say, render nothing.
  if (unavailable || balance === undefined || balance === null) return null;

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-medium dark:bg-indigo-950/60 bg-sky-50 dark:text-indigo-200 text-sky-900 border dark:border-indigo-500/30 border-sky-200 shadow-sm backdrop-blur-sm cursor-pointer hover:border-sky-400/50 transition-all"
      title={`Orbit Control Plane Balance: ${balance} credits`}
    >
      <Zap size={12} className="dark:text-cyan-400 text-sky-600 animate-pulse" />
      <span className="font-semibold dark:text-cyan-300 text-sky-800">
        {loading ? "…" : balance}
      </span>
      <span className="text-caption text-muted-foreground uppercase tracking-wider">Credits</span>
    </div>
  );
}
