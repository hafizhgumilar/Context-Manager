import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { withUserContext } from "@/lib/db/rls";
import { adjustWalletWithClient } from "@/lib/wallet";
import {
  BUILDER_COPY_COST,
  BUILDER_DOWNLOAD_COST,
  BUILDER_SAVE_COST,
} from "@/lib/economy";

const ACTION_COSTS = {
  builder_copy: Math.abs(BUILDER_COPY_COST),
  builder_download: Math.abs(BUILDER_DOWNLOAD_COST),
  builder_save: Math.abs(BUILDER_SAVE_COST),
} as const;

type SpendAction = keyof typeof ACTION_COSTS;

const ACTION_META: Record<SpendAction, Record<string, unknown>> = {
  builder_copy: { feature: "builder", action: "copy" },
  builder_download: { feature: "builder", action: "download" },
  builder_save: { feature: "builder", action: "save" },
};

const SpendSchema = z.object({
  action: z.enum(["builder_copy", "builder_download", "builder_save"]),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = SpendSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const action = parsed.data.action as SpendAction;
  const cost = ACTION_COSTS[action];

  if (cost <= 0) {
    return NextResponse.json({
      balance: null,
      cost,
      action,
    });
  }

  return withUserContext(session.user.id, async (client) => {
    try {
      const { wallet } = await adjustWalletWithClient(
        client,
        session.user.id,
        -cost,
        action,
        ACTION_META[action],
      );

      return NextResponse.json({
        balance: wallet.balance,
        cost,
        action,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Insufficient balance") {
        return NextResponse.json(
          { error: "Not enough coins to use this feature." },
          { status: 402 },
        );
      }

      throw error;
    }
  });
}
