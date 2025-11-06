import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type TransactionClient = Prisma.TransactionClient;

async function setUserContext(tx: TransactionClient, userId: string) {
  await tx.$executeRaw`SELECT set_config('app.role', 'user', true)`;
  await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
}

async function setServiceRole(tx: TransactionClient) {
  await tx.$executeRaw`SELECT set_config('app.role', 'service', true)`;
  await tx.$executeRaw`SELECT set_config('app.user_id', '', true)`;
}

export async function withUserContext<T>(
  userId: string,
  fn: (client: TransactionClient) => Promise<T>,
) {
  return db.$transaction(async (tx) => {
    await setUserContext(tx, userId);
    return fn(tx);
  });
}

export async function withServiceRole<T>(
  fn: (client: TransactionClient) => Promise<T>,
) {
  return db.$transaction(async (tx) => {
    await setServiceRole(tx);
    return fn(tx);
  });
}
