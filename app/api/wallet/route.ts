import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withUserContext } from "@/lib/db/rls";
import { getWalletSummary } from "@/lib/wallet";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withUserContext(session.user.id, async (client) => {
    const summary = await getWalletSummary(session.user.id, { limit: 25 }, client);

    return NextResponse.json({
      balance: summary.wallet.balance,
      transactions: summary.transactions.map((transaction) => ({
        ...transaction,
        createdAt: transaction.createdAt.toISOString(),
      })),
    });
  });
}
