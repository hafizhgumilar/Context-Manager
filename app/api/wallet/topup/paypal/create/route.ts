import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createPayPalOrder, convertUsdToCoins } from "@/lib/payments/paypal";

const CreateOrderSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default("USD"),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = CreateOrderSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { amount, currency } = parsed.data;

  try {
    const order = await createPayPalOrder({
      userId: session.user.id,
      amount,
      currency,
    });

    return NextResponse.json({
      order,
      estimatedCoins: convertUsdToCoins(amount),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create PayPal order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

