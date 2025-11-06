import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { withUserContext } from "@/lib/db/rls";
import { getWalletSummary } from "@/lib/wallet";
import {
  COINS_PER_PACK,
  REWARD_PER_AD,
  SLOTS_PER_PACK,
} from "@/lib/economy";
import { WalletDashboard } from "@/components/wallet/wallet-dashboard";

export const metadata: Metadata = {
  title: "Wallet | AI Context Manager",
  description: "Manage coins, slot purchases, and transaction history.",
};

export default async function WalletPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=/wallet");
  }

  const userId = session.user.id;

  const { summary, slotsUsed, slotLimit } = await withUserContext(
    session.user.id,
    async (client) => {
      const [walletSummary, templatesUsed, user] = await Promise.all([
        getWalletSummary(userId, { limit: 25 }, client),
        client.template.count({ where: { ownerId: userId } }),
        client.user.findUnique({
          where: { id: userId },
          select: { slotLimit: true },
        }),
      ]);

      return {
        summary: walletSummary,
        slotsUsed: templatesUsed,
        slotLimit: user?.slotLimit ?? session.user.slotLimit ?? 10,
      };
    },
  );

  return (
    <WalletDashboard
      initialBalance={summary.wallet.balance}
      initialTransactions={summary.transactions.map((transaction) => ({
        ...transaction,
        meta: (transaction.meta as Record<string, unknown>) ?? null,
        createdAt: transaction.createdAt.toISOString(),
      }))}
      slotsUsed={slotsUsed}
      slotLimit={slotLimit}
      rewardPerAd={REWARD_PER_AD}
      coinsPerPack={COINS_PER_PACK}
      slotsPerPack={SLOTS_PER_PACK}
    />
  );
}
