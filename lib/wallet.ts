import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import {
  COINS_PER_PACK,
  MAX_ATTACHMENT_CHARS,
  MAX_SECTION_CHARS,
  REWARD_PER_AD,
  SLOTS_PER_PACK,
} from "@/lib/economy";

const transactionSelectable = {
  id: true,
  type: true,
  amount: true,
  meta: true,
  createdAt: true,
} satisfies Prisma.TransactionSelect;

type TransactionRecord = Prisma.TransactionGetPayload<{
  select: typeof transactionSelectable;
}>;

type DbClient = PrismaClient | Prisma.TransactionClient;

function getClient(tx?: DbClient) {
  return tx ?? db;
}

export async function ensureWallet(userId: string, tx?: DbClient) {
  const client = getClient(tx);
  return client.wallet.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export async function getWalletSummary(
  userId: string,
  opts: { limit?: number } = {},
  tx?: DbClient,
) {
  const limit = opts.limit ?? 25;
  const client = getClient(tx);
  const [wallet, transactions] = await Promise.all([
    ensureWallet(userId, client),
    client.transaction.findMany({
      where: { userId },
      select: transactionSelectable,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  return { wallet, transactions };
}

export async function getLastTransactionByType(
  userId: string,
  type: string,
  tx?: DbClient,
) {
  const client = getClient(tx);
  return client.transaction.findFirst({
    where: { userId, type },
    orderBy: { createdAt: "desc" },
  });
}

export async function rewardAdCoins(userId: string, tx?: DbClient) {
  return adjustWalletWithClient(
    getClient(tx),
    userId,
    REWARD_PER_AD,
    "ad_reward",
  );
}

export async function buySlotsWithCoins(
  userId: string,
  tx: Prisma.TransactionClient,
) {
  const wallet = await ensureWallet(userId, tx);
  if (wallet.balance < COINS_PER_PACK) {
    throw new Error("Not enough coins");
  }

  const updatedWallet = await tx.wallet.update({
    where: { userId },
    data: { balance: { decrement: COINS_PER_PACK } },
  });

  const user = await tx.user.update({
    where: { id: userId },
    data: {
      slotLimit: { increment: SLOTS_PER_PACK },
    },
    select: { slotLimit: true },
  });

  const transaction = await tx.transaction.create({
    data: {
      userId,
      type: "buy_slots",
      amount: -COINS_PER_PACK,
      meta: {
        slotsAdded: SLOTS_PER_PACK,
      },
    },
    select: transactionSelectable,
  });

  return {
    wallet: updatedWallet,
    transaction,
    slotLimit: user.slotLimit,
  };
}

export function validateSectionSize(content: string, isAttachment: boolean) {
  const trimmed = content ?? "";
  if (!trimmed) return;
  if (isAttachment && trimmed.length > MAX_ATTACHMENT_CHARS) {
    throw new Error("Attachment exceeds maximum size");
  }
  if (!isAttachment && trimmed.length > MAX_SECTION_CHARS) {
    throw new Error("Section exceeds maximum size");
  }
}

export type WalletSummary = Awaited<ReturnType<typeof getWalletSummary>>;
export type WalletTransaction = TransactionRecord;

export async function adjustWalletWithClient(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
  type: string,
  meta?: Prisma.JsonValue,
) {
  const wallet = await ensureWallet(userId, tx);

  if (wallet.balance + amount < 0) {
    throw new Error("Insufficient balance");
  }

  const updatedWallet = await tx.wallet.update({
    where: { userId },
    data: {
      balance: { increment: amount },
    },
  });

  const transaction = await tx.transaction.create({
    data: {
      userId,
      type,
      amount,
      meta,
    },
    select: transactionSelectable,
  });

  return { wallet: updatedWallet, transaction };
}
