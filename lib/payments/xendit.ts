import { IDR_TO_COINS } from "@/lib/economy";

const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY;
const XENDIT_ENV = process.env.XENDIT_ENV ?? "test";

function getBaseUrl() {
  return XENDIT_ENV === "live"
    ? "https://api.xendit.co"
    : "https://api.xendit.co";
}

export async function createXenditInvoice(opts: {
  userId: string;
  amount: number;
  currency: string;
  description?: string;
}) {
  if (!XENDIT_SECRET_KEY) {
    throw new Error("Xendit credentials are not configured");
  }

  const response = await fetch(`${getBaseUrl()}/v2/invoices`, {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(`${XENDIT_SECRET_KEY}:`, "utf8").toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      external_id: `wallet-${opts.userId}-${Date.now()}`,
      amount: opts.amount,
      currency: opts.currency,
      customer_notification_preference: {
        invoice_created: ["email"],
        invoice_paid: ["email"],
      },
      description: opts.description ?? "AI Context Manager wallet top-up",
      metadata: {
        userId: opts.userId,
        coins: convertIdrToCoins(opts.amount),
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Xendit invoice creation failed: ${message}`);
  }

  return response.json();
}

export function convertIdrToCoins(amountIdr: number) {
  return Math.max(0, Math.floor(amountIdr * IDR_TO_COINS));
}

