import { NextResponse } from "next/server";
import { withServiceRole } from "@/lib/db/rls";
import { adjustWalletWithClient } from "@/lib/wallet";
import { convertUsdToCoins } from "@/lib/payments/paypal";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET_PAYPAL;

function isAuthorized(headers: Headers) {
  if (!WEBHOOK_SECRET) return false;
  // ASSUMPTION: Webhook requests include a shared secret header `x-paypal-webhook-secret`.
  const provided = headers.get("x-paypal-webhook-secret");
  return provided === WEBHOOK_SECRET;
}

export async function POST(request: Request) {
  if (!isAuthorized(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await request.json().catch(() => null);
  if (!event) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const eventType: string = event.event_type ?? "";
  if (eventType !== "PAYMENT.CAPTURE.COMPLETED" && eventType !== "CHECKOUT.ORDER.APPROVED") {
    return NextResponse.json({ received: true });
  }

  const resource = event.resource ?? {};
  const purchaseUnits = resource.purchase_units ?? [];
  const unit = purchaseUnits[0] ?? {};
  const customId: string | undefined =
    resource.custom_id ?? unit.custom_id ?? unit.reference_id;

  if (!customId) {
    return NextResponse.json({ error: "Missing custom_id" }, { status: 400 });
  }

  const providerTransactionId: string | undefined =
    resource.id ?? resource.capture_id ?? resource.invoice_id;

  if (!providerTransactionId) {
    return NextResponse.json({ error: "Missing provider reference" }, { status: 400 });
  }

  const amountInfo = resource.amount ?? unit.amount ?? {};
  const amountValue = Number.parseFloat(amountInfo.value ?? "0");
  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const coins = convertUsdToCoins(amountValue);
  if (coins <= 0) {
    return NextResponse.json({ error: "Amount below coin threshold" }, { status: 400 });
  }

  return withServiceRole(async (client) => {
    const existing = await client.transaction.findFirst({
      where: {
        type: "paypal_topup",
        userId: customId,
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
      await adjustWalletWithClient(client, customId, coins, "paypal_topup", {
        provider: "paypal",
        providerTransactionId,
        amount: amountValue,
        currency: amountInfo.currency_code ?? "USD",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to credit wallet";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  });
}
