"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, PlusCircle, ArrowUpRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/hooks/use-toast";
import { AppTopbar } from "@/components/navigation/app-topbar";
import { broadcastWalletBalance } from "@/lib/events";

type TransactionItem = {
  id: string;
  type: string;
  amount: number;
  meta: Record<string, unknown> | null;
  createdAt: string;
};

type WalletDashboardProps = {
  initialBalance: number;
  initialTransactions: TransactionItem[];
  slotsUsed: number;
  slotLimit: number;
  rewardPerAd: number;
  coinsPerPack: number;
  slotsPerPack: number;
};

const TRANSACTION_LABELS: Record<string, string> = {
  ad_reward: "Ad reward",
  paypal_topup: "PayPal top-up",
  xendit_topup: "Xendit top-up",
  buy_slots: "Slot purchase",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  hour12: true,
});

function formatDate(timestamp: string) {
  try {
    return DATE_FORMATTER.format(new Date(timestamp));
  } catch {
    return timestamp;
  }
}

export function WalletDashboard({
  initialBalance,
  initialTransactions,
  slotsUsed,
  slotLimit,
  rewardPerAd,
  coinsPerPack,
  slotsPerPack,
}: WalletDashboardProps) {
  const { toast } = useToast();
  const [balance, setBalance] = useState(initialBalance);
  const [transactions, setTransactions] = useState(initialTransactions);
  const slotsUsedState = slotsUsed;
  const [slotLimitState, setSlotLimitState] = useState(slotLimit);
  const [paypalAmount, setPaypalAmount] = useState("5");
  const [xenditAmount, setXenditAmount] = useState("150000");
  const [isClaiming, startClaim] = useTransition();
  const [isBuyingSlots, startBuySlot] = useTransition();
  const [isCreatingPaypal, startPaypal] = useTransition();
  const [isCreatingXendit, startXendit] = useTransition();

  const addTransaction = (transaction: TransactionItem) => {
    setTransactions((current) => [
      transaction,
      ...current,
    ].slice(0, 25));
  };

  const handleClaimAd = () => {
    startClaim(async () => {
      const response = await fetch("/api/wallet/ads/claim", {
        method: "POST",
      });

      if (response.status === 429) {
        const data = await response.json().catch(() => null);
        toast({
          title: "Cooldown active",
          description:
            data?.retryAfterSeconds != null
              ? `Please wait ${Math.ceil(
                  data.retryAfterSeconds / 60,
                )} minute(s) before claiming again.`
              : "Please try again later.",
          variant: "destructive",
        });
        return;
      }

      if (!response.ok) {
        toast({
          title: "Could not claim reward",
          description: "Please try again in a few seconds.",
          variant: "destructive",
        });
        return;
      }

      const data = await response.json();
      setBalance(data.balance);
      broadcastWalletBalance(data.balance);
      addTransaction({
        ...data.transaction,
        meta: data.transaction.meta ?? null,
      });
      toast({
        title: "Reward added",
        description: `You earned ${rewardPerAd} coins.`,
      });
    });
  };

  const handleBuySlots = () => {
    startBuySlot(async () => {
      const response = await fetch("/api/wallet/buy-slots", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast({
          title: "Purchase failed",
          description: data?.error ?? "Not enough coins to buy slots.",
          variant: "destructive",
        });
        return;
      }

      const data = await response.json();
      setBalance(data.balance);
      broadcastWalletBalance(data.balance);
      setSlotLimitState(data.slotLimit);
      addTransaction({
        ...data.transaction,
        meta: data.transaction.meta ?? null,
      });
      toast({
        title: "Slots upgraded",
        description: `Your limit increased by ${slotsPerPack} slots.`,
      });
    });
  };

  const handleCreatePaypalOrder = () => {
    startPaypal(async () => {
      const numericAmount = Number.parseFloat(paypalAmount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        toast({
          title: "Invalid amount",
          description: "Enter a positive USD amount.",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch("/api/wallet/topup/paypal/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: numericAmount,
          currency: "USD",
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast({
          title: "Could not create order",
          description: data?.error ?? "Please try again later.",
          variant: "destructive",
        });
        return;
      }

      const data = await response.json();
      const approveLink =
        data.order?.links?.find((link: { rel: string }) => link.rel === "approve")
          ?.href ?? null;

      if (approveLink) {
        toast({
          title: "PayPal order created",
          description: "Complete the payment in the newly opened window.",
        });
        window.open(approveLink, "_blank", "noopener,noreferrer");
      } else {
        toast({
          title: "Order created",
          description: "Approve the payment from your PayPal dashboard.",
        });
      }
    });
  };

  const handleCreateXenditInvoice = () => {
    startXendit(async () => {
      const numericAmount = Number.parseFloat(xenditAmount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        toast({
          title: "Invalid amount",
          description: "Enter a positive IDR amount.",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch("/api/wallet/topup/xendit/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: numericAmount,
          currency: "IDR",
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast({
          title: "Could not create invoice",
          description: data?.error ?? "Please try again later.",
          variant: "destructive",
        });
        return;
      }

      const data = await response.json();
      const invoiceUrl = data.invoice?.invoice_url;
      if (invoiceUrl) {
        toast({
          title: "Invoice ready",
          description: "Complete the payment in the newly opened window.",
        });
        window.open(invoiceUrl, "_blank", "noopener,noreferrer");
      } else {
        toast({
          title: "Invoice created",
          description: "Open your Xendit invoice dashboard to pay.",
        });
      }
    });
  };

  const balanceLabel = useMemo(
    () =>
      balance.toLocaleString(undefined, {
        maximumFractionDigits: 0,
      }),
    [balance],
  );

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <AppTopbar />
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 lg:px-10">
        <header className="flex flex-col gap-4 rounded-3xl border border-border/80 bg-background/90 p-6 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Wallet</h1>
            <p className="text-sm text-muted-foreground">
              Earn coins, top up via PayPal/Xendit, and expand your template capacity.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
              <span>
                Slots in use:{" "}
                <span className="font-medium text-foreground">
                  {slotsUsedState}
                </span>{" "}
                / {slotLimitState}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="gap-2" asChild>
              <Link href="/templates">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Refresh templates
              </Link>
            </Button>
            <Button className="gap-2" asChild>
              <Link href="/builder">
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                New template
              </Link>
            </Button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Card className="border border-border/80 bg-background/90 shadow-sm backdrop-blur">
            <CardHeader className="space-y-2">
              <CardTitle className="text-3xl font-semibold">
                {balanceLabel} coins
              </CardTitle>
              <CardDescription>
                Spend coins to buy more template slots or run plug-ins.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-medium">Watch rewarded ad</h3>
                    <p className="text-sm text-muted-foreground">
                      Earn {rewardPerAd} coins (cooldown applies).
                    </p>
                  </div>
                  <Button
                    onClick={handleClaimAd}
                    disabled={isClaiming}
                    className="gap-2"
                  >
                    {isClaiming ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Claim reward
                  </Button>
                </div>

                <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-medium">Buy slot pack</h3>
                    <p className="text-sm text-muted-foreground">
                      Costs {coinsPerPack} coins for +{slotsPerPack} slots.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={handleBuySlots}
                    disabled={isBuyingSlots}
                    className="gap-2"
                  >
                    {isBuyingSlots ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Buy slots
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/10 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Top up with PayPal</h3>
                      <p className="text-sm text-muted-foreground">
                        Receive coins after the payment is captured.
                      </p>
                    </div>
                    <Badge variant="outline">USD</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={paypalAmount}
                      onChange={(event) => setPaypalAmount(event.target.value)}
                    />
                    <Button
                      onClick={handleCreatePaypalOrder}
                      disabled={isCreatingPaypal}
                      className="gap-2"
                    >
                      {isCreatingPaypal ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      )}
                      Create order
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/10 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Top up with Xendit</h3>
                      <p className="text-sm text-muted-foreground">
                        Pay local IDR invoice via QRIS, VA, or cards.
                      </p>
                    </div>
                    <Badge variant="outline">IDR</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="10000"
                      step="1000"
                      value={xenditAmount}
                      onChange={(event) => setXenditAmount(event.target.value)}
                    />
                    <Button
                      onClick={handleCreateXenditInvoice}
                      disabled={isCreatingXendit}
                      className="gap-2"
                    >
                      {isCreatingXendit ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      )}
                      Create invoice
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/80 bg-background/90 shadow-sm backdrop-blur">
            <CardHeader className="space-y-2">
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>
                Transactions are recorded for auditing and support retries.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No wallet activity yet. Start by earning or purchasing coins.
                </p>
              ) : (
                <div className="space-y-3">
                  {transactions.map((transaction) => {
                    const label =
                      TRANSACTION_LABELS[transaction.type] ?? transaction.type;
                    const amountLabel =
                      (transaction.amount > 0 ? "+" : "") +
                      transaction.amount.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      });
                    return (
                      <div
                        key={transaction.id}
                        className="flex flex-col rounded-xl border border-border/50 bg-muted/10 p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{label}</span>
                          <span
                            className={`text-sm font-semibold ${
                              transaction.amount >= 0
                                ? "text-emerald-600"
                                : "text-rose-600"
                            }`}
                          >
                            {amountLabel}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(transaction.createdAt)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
