"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  WALLET_BALANCE_EVENT,
  type WalletBalanceEventDetail,
} from "@/lib/events";

const NAV_ITEMS = [
  { href: "/builder", label: "Builder" },
  { href: "/templates", label: "Templates" },
  { href: "/wallet", label: "Wallet" },
];

const COIN_FORMATTER = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

export function AppTopbar() {
  const pathname = usePathname();
  const { status } = useSession();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") {
      setBalance(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const fetchBalance = async () => {
      try {
        const response = await fetch("/api/wallet", {
          method: "GET",
          credentials: "include",
        });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { balance?: number };
        if (isMounted && typeof data.balance === "number") {
          setBalance(data.balance);
        }
      } catch {
        // ignore fetch errors; UI will fallback to placeholder
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchBalance().catch(() => null);

    const handleUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<WalletBalanceEventDetail>;
      if (typeof customEvent.detail?.balance === "number") {
        setBalance(customEvent.detail.balance);
      }
    };

    window.addEventListener(WALLET_BALANCE_EVENT, handleUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener(WALLET_BALANCE_EVENT, handleUpdate);
    };
  }, [status]);

  const balanceLabel = useMemo(() => {
    if (balance == null) {
      return loading ? "..." : "--";
    }
    return COIN_FORMATTER.format(balance);
  }, [balance, loading]);

  return (
    <header className="border-b border-border/70 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/builder" className="text-sm font-semibold uppercase tracking-wide">
          Context Manager
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-3 py-1 transition hover:text-primary",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          {status === "authenticated" ? (
            <>
              <div className="rounded-full border border-border/80 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                Coins:{" "}
                <span className="text-foreground">
                  {balanceLabel}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={() =>
                  signOut({ callbackUrl: "/builder" }).catch(() => null)
                }
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </Button>
            </>
          ) : null}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
