import { USD_TO_COINS } from "@/lib/economy";

const PAYPAL_ENV = process.env.PAYPAL_ENV ?? "sandbox";
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

function getBaseUrl() {
  return PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function getAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error("PayPal credentials are not configured");
  }

  const response = await fetch(`${getBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`,
          "utf8",
        ).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`PayPal auth failed: ${message}`);
  }

  const data = await response.json();
  return data.access_token as string;
}

export async function createPayPalOrder(opts: {
  userId: string;
  amount: number;
  currency: string;
}) {
  const accessToken = await getAccessToken();
  const response = await fetch(`${getBaseUrl()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: opts.currency,
            value: opts.amount.toFixed(2),
          },
          custom_id: opts.userId,
        },
      ],
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`PayPal order creation failed: ${message}`);
  }

  return response.json();
}

export function convertUsdToCoins(amountUsd: number) {
  return Math.max(0, Math.floor(amountUsd * USD_TO_COINS));
}

