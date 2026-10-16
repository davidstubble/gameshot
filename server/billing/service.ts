import { PRO_OFFER, type BillingStatus, type PurchaseHistory } from '../../shared/billing';
import type { User } from '../../drizzle/schema';
import { purchasesFor, accountToken } from './repository';
import { paymentEnvironment, reconcileCheckout } from './stripe';
import { appleReady, refreshApplePurchase } from './apple';
import { applePaymentEnvironment } from './apple-environment';
import { entitlementEnvironmentAllowed, webCheckoutReady } from './readiness';

export async function billingStatus(user: User | null): Promise<BillingStatus> {
  const environment = paymentEnvironment();
  const appleEnvironment = applePaymentEnvironment();
  // Admin remains a database role, not a client flag or fabricated payment.
  const isAdmin = user?.role === 'admin';
  const result: BillingStatus = { user: user ? { id: user.id, name: user.name, email: user.email } : null,
    isPro: isAdmin, isAdmin, environment, appleEnvironment, freeBatchLimit: PRO_OFFER.freeBatchLimit,
    webReady: await webCheckoutReady(), appleReady: appleReady(appleEnvironment), appAccountToken: null, history: [] };
  if (!user) return result;
  result.appAccountToken = await accountToken(user.id);
  const rows = environment === appleEnvironment ? await purchasesFor(user.id, environment) :
    (await Promise.all([purchasesFor(user.id, environment), purchasesFor(user.id, appleEnvironment)])).flat();
  const records = [...new Map(rows
    .filter((record) => record.environment === (record.provider === 'apple' ? appleEnvironment : environment))
    .map((record) => [record.key, record])).values()]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  const history: PurchaseHistory[] = [];
  for (const record of records) {
    let status = record.status;
    let amount = record.amount;
    let currency = record.currency;
    let receiptUrl: string | null = null;
    if (record.provider === 'stripe' && record.checkoutSessionId && ['active', 'pending', 'failed'].includes(status)) {
      const refreshed = await reconcileCheckout(record.checkoutSessionId, user.id);
      status = refreshed.record.status; amount = refreshed.record.amount ?? null;
      currency = refreshed.record.currency ?? null; receiptUrl = refreshed.receiptUrl;
    } else if (record.provider === 'apple' && status === 'active') {
      if (!appleReady(appleEnvironment) || !record.originalTransactionId) throw new Error('Current App Store access cannot be confirmed.');
      status = await refreshApplePurchase(user.id, record.originalTransactionId, record.providerTransactionId, appleEnvironment);
    }
    if (status === 'active' && record.productKey === PRO_OFFER.key && entitlementEnvironmentAllowed(record.environment)) result.isPro = true;
    history.push({ id: record.key, provider: record.provider, environment: record.environment, status,
      product: PRO_OFFER.name, amount, currency, createdAt: record.createdAt.toISOString(), receiptUrl });
  }
  result.history = history;
  return result;
}
