import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withUserContext } from "@/lib/db/rls";
import {
  AD_COOLDOWN_MIN,
  REWARD_PER_AD,
} from "@/lib/economy";
import {
  getLastTransactionByType,
  rewardAdCoins,
} from "@/lib/wallet";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withUserContext(session.user.id, async (client) => {
    const lastReward = await getLastTransactionByType(
      session.user.id,
      "ad_reward",
      client,
    );

    if (lastReward) {
      const elapsedMs = Date.now() - lastReward.createdAt.getTime();
      const minBetween = AD_COOLDOWN_MIN * 60 * 1000;
      if (elapsedMs < minBetween) {
        const remaining = Math.ceil((minBetween - elapsedMs) / 1000);
        return NextResponse.json(
          {
            error: "Cooldown active",
            retryAfterSeconds: remaining,
          },
          { status: 429 },
        );
      }
    }

    const { wallet, transaction } = await rewardAdCoins(
      session.user.id,
      client,
    );

    return NextResponse.json({
      balance: wallet.balance,
      reward: REWARD_PER_AD,
      transaction: {
        ...transaction,
        createdAt: transaction.createdAt.toISOString(),
      },
    });
  });
}
