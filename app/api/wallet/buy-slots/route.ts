import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withUserContext } from "@/lib/db/rls";
import {
  COINS_PER_PACK,
  SLOTS_PER_PACK,
} from "@/lib/economy";
import { buySlotsWithCoins } from "@/lib/wallet";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withUserContext(session.user.id, async (client) => {
    try {
      const { wallet, transaction, slotLimit } = await buySlotsWithCoins(
        session.user.id,
        client,
      );

      return NextResponse.json({
        balance: wallet.balance,
        slotLimit,
        cost: COINS_PER_PACK,
        slotsAdded: SLOTS_PER_PACK,
        transaction: {
          ...transaction,
          createdAt: transaction.createdAt.toISOString(),
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to buy slots";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
