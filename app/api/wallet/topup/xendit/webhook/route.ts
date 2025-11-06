import { NextResponse } from "next/server";
import { withServiceRole } from "@/lib/db/rls";
import { adjustWalletWithClient } from "@/lib/wallet";
import { convertIdrToCoins } from "@/lib/payments/xendit";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET_XENDIT;

function isAuthorized(headers: Headers) {
  if (!WEBHOOK_SECRET) return false;
  // ASSUMPTION: Xendit webhooks provide a shared secret via the `x-callback-token` header.
  const provided = headers.get("x-callback-token");
  return provided === WEBHOOK_SECRET;
}

export async function POST(request: Request) {
  if (!isAuthorized(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const data = payload.data ?? payload;
  const status: string = data.status ?? "";
  if (status !== "PAID" && status !== "SETTLED") {
    return NextResponse.json({ received: true });
  }

  const metadata = data.metadata ?? {};
  const userId: string | undefined = metadata.userId;
  if (!userId) {
    return NextResponse.json({ error: "Missing userId metadata" }, { status: 400 });
  }

  const providerTransactionId: string | undefined =
    data.id ?? data.invoice_id ?? data.external_id;

  if (!providerTransactionId) {
    return NextResponse.json({ error: "Missing provider reference" }, { status: 400 });
  }

  const amount = Number.parseFloat(data.paid_amount ?? data.amount ?? "0");
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const coins =
    (metadata.coins && Number.isFinite(Number(metadata.coins)))
      ? Number(metadata.coins)
      : convertIdrToCoins(amount);

  if (coins <= 0) {
    return NextResponse.json({ error: "Amount below coin threshold" }, { status: 400 });
  }

  return withServiceRole(async (client) => {
    const existing = await client.transaction.findFirst({
      where: {
        type: "xendit_topup",
        userId,
        meta: {
          path: ["providerTransactionId"],
          equals: providerTransactionId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    try {
      await adjustWalletWithClient(client, userId, coins, "xendit_topup", {
        provider: "xendit",
        providerTransactionId,
        amount,
        currency: data.currency ?? "IDR",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to credit wallet";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  });
}
