import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createXenditInvoice, convertIdrToCoins } from "@/lib/payments/xendit";

const CreateInvoiceSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default("IDR"),
  description: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = CreateInvoiceSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { amount, currency, description } = parsed.data;

  try {
    const invoice = await createXenditInvoice({
      userId: session.user.id,
      amount,
      currency,
      description,
    });

    return NextResponse.json({
      invoice,
      estimatedCoins: convertIdrToCoins(amount),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create Xendit invoice";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

