import type { BillingStatus } from '@/shared/billing';
export type NativePurchaseActions = {
  ready: boolean; reason: string | null; displayPrice?: string;
  buy: () => Promise<void>; restore: () => Promise<void>;
};
export type NativeBridgeProps = {
  status: BillingStatus | null;
  register: (actions: NativePurchaseActions | null) => void;
  refresh: () => Promise<boolean>;
  message: (text: string, error?: boolean) => void;
  setBusy: (busy: boolean) => void;
};
