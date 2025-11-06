export const WALLET_BALANCE_EVENT = "wallet:balance-updated";

export type WalletBalanceEventDetail = {
  balance: number;
};

export function broadcastWalletBalance(balance: number) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<WalletBalanceEventDetail>(WALLET_BALANCE_EVENT, {
      detail: { balance },
    }),
  );
}
