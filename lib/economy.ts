function parseNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const REWARD_PER_AD = parseNumber(process.env.REWARD_PER_AD, 150);
export const AD_COOLDOWN_MIN = parseNumber(process.env.AD_COOLDOWN_MIN, 5);
export const COINS_PER_PACK = parseNumber(process.env.COINS_PER_PACK, 1000);
export const SLOTS_PER_PACK = parseNumber(process.env.SLOTS_PER_PACK, 10);
export const USD_TO_COINS = parseNumber(process.env.USD_TO_COINS, 1000);
export const IDR_TO_COINS = parseNumber(process.env.IDR_TO_COINS, 0.1);

export const BUILDER_SAVE_COST = parseNumber(
  process.env.BUILDER_SAVE_COST ?? process.env.NEXT_PUBLIC_BUILDER_SAVE_COST,
  2,
);
export const BUILDER_COPY_COST = parseNumber(
  process.env.BUILDER_COPY_COST ?? process.env.NEXT_PUBLIC_BUILDER_COPY_COST,
  1,
);
export const BUILDER_DOWNLOAD_COST = parseNumber(
  process.env.BUILDER_DOWNLOAD_COST ??
    process.env.NEXT_PUBLIC_BUILDER_DOWNLOAD_COST,
  1,
);

export const MAX_SECTION_CHARS = 512_000;
export const MAX_ATTACHMENT_CHARS = 2_000_000;
