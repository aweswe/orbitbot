import { Coins, Zap } from "lucide-react";
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

  useEffect(() => {
    let mounted = true;

    async function fetchBilling() {
      try {
        const res = await fetch("/api/orbit/billing");
        if (res.ok) {
          const json = await res.json();
          if (mounted && json.data) {
            setBilling(json.data);
          }
        }
      } catch (err) {
        console.warn("Could not fetch Orbit billing:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchBilling();
    // Poll every 30 seconds for live balance update
    const interval = setInterval(fetchBilling, 30_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const balance = billing?.wallet?.availableBalance ?? billing?.wallet?.balance ?? 500;

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-indigo-950/60 text-indigo-200 border border-indigo-500/30 shadow-sm shadow-indigo-500/10 backdrop-blur-sm cursor-pointer hover:border-indigo-400/50 transition-all"
      title={`Orbit Control Plane Balance: ${balance} credits`}
    >
      <Zap size={12} className="text-cyan-400 animate-pulse" />
      <span className="font-semibold text-cyan-300">{loading ? "..." : balance}</span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Credits</span>
    </div>
  );
}

