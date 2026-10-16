import { AppStoreServerAPIClient, Environment, SignedDataVerifier } from '@apple/app-store-server-library';
import { PRO_OFFER, type PaymentEnvironment } from '../../shared/billing';
import { applePaymentEnvironment, appleRuntimeAllowsPurchases } from './apple-environment';
import { APPLE_ROOT_CERTIFICATES } from './apple-roots';
import { accountToken, eventProcessed, recordEvent, purchaseByKey, savePurchase, setPurchaseState } from './repository';
import { validateAppleOffer } from './policy';

export function appleReady(mode = applePaymentEnvironment()) {
  return appleRuntimeAllowsPurchases(mode) && Boolean(
    process.env.APPLE_IAP_PRIVATE_KEY && process.env.APPLE_IAP_KEY_ID && process.env.APPLE_IAP_ISSUER_ID &&
    (mode === 'test' || /^\d+$/.test(process.env.APPLE_APP_ID ?? '')),
  );
}
function sdkEnvironment(mode: PaymentEnvironment) {
  return mode === 'test' ? Environment.SANDBOX : Environment.PRODUCTION;
}
function verifier(mode: PaymentEnvironment) {
  if (!appleReady(mode)) throw new Error('App Store verification is not configured for this environment.');
  return new SignedDataVerifier(APPLE_ROOT_CERTIFICATES, true, sdkEnvironment(mode), PRO_OFFER.bundleId,
    process.env.APPLE_APP_ID ? Number(process.env.APPLE_APP_ID) : undefined);
}
function client(mode: PaymentEnvironment) {
  if (!appleReady(mode)) throw new Error('App Store verification is not configured for this environment.');
  return new AppStoreServerAPIClient(process.env.APPLE_IAP_PRIVATE_KEY!, process.env.APPLE_IAP_KEY_ID!,
    process.env.APPLE_IAP_ISSUER_ID!, PRO_OFFER.bundleId, sdkEnvironment(mode));
}
const keyFor = (originalId: string, mode: PaymentEnvironment) => `apple:${mode}:${originalId}`;

export async function verifyApplePurchase(userId: number, jws: string) {
  const mode = applePaymentEnvironment();
  if (typeof jws !== 'string' || jws.length > 100000 || jws.split('.').length !== 3) throw new Error('Invalid App Store transaction.');
  const token = await accountToken(userId);
  const signatureVerifier = verifier(mode);
  const submitted = await signatureVerifier.verifyAndDecodeTransaction(jws);
  validateAppleOffer(submitted, token, mode);
  // CURRENT provider state, not an older signed receipt that predates a refund.
  const info = await client(mode).getTransactionInfo(submitted.transactionId!);
  if (!info.signedTransactionInfo) throw new Error('Current App Store transaction is unavailable.');
  const current = await signatureVerifier.verifyAndDecodeTransaction(info.signedTransactionInfo);
  const status = validateAppleOffer(current, token, mode);
  if (current.originalTransactionId !== submitted.originalTransactionId) throw new Error('App Store transaction mismatch.');
  const record = await savePurchase({
    key: keyFor(current.originalTransactionId!, mode), userId, provider: 'apple', environment: mode,
    productKey: PRO_OFFER.key, status, providerTransactionId: current.transactionId!, originalTransactionId: current.originalTransactionId,
    amount: current.price === undefined ? null : (current.price / 1000).toFixed(3), currency: current.currency ?? null,
  });
  if (record.status !== 'active') throw new Error('This App Store purchase was refunded or revoked.');
  return record;
}

export async function refreshApplePurchase(userId: number, originalId: string, transactionId: string, mode = applePaymentEnvironment()) {
  const info = await client(mode).getTransactionInfo(transactionId);
  if (!info.signedTransactionInfo) throw new Error('Could not confirm App Store access.');
  const current = await verifier(mode).verifyAndDecodeTransaction(info.signedTransactionInfo);
  const status = validateAppleOffer(current, await accountToken(userId), mode);
  if (current.originalTransactionId !== originalId) throw new Error('App Store transaction mismatch.');
  if (status === 'revoked') await setPurchaseState(keyFor(originalId, mode), 'revoked');
  return status;
}

export async function processAppleNotification(signedPayload: string) {
  const mode = applePaymentEnvironment();
  if (typeof signedPayload !== 'string' || signedPayload.length > 200000) throw new Error('Invalid App Store notification.');
  const verify = verifier(mode);
  const notification = await verify.verifyAndDecodeNotification(signedPayload);
  if (!notification.notificationUUID) throw new Error('Missing notification identifier.');
  const eventKey = `apple:${mode}:${notification.notificationUUID}`;
  if (await eventProcessed(eventKey)) return;
  const transaction = notification.data?.signedTransactionInfo;
  if (transaction && ['REFUND', 'REVOKE'].includes(String(notification.notificationType))) {
    const payload = await verify.verifyAndDecodeTransaction(transaction);
    const originalId = payload.originalTransactionId;
    if (payload.productId !== PRO_OFFER.appleProductId || payload.bundleId !== PRO_OFFER.bundleId || !originalId) throw new Error('App Store notification product mismatch.');
    const record = await purchaseByKey(keyFor(originalId, mode));
    if (record) await setPurchaseState(record.key, notification.notificationType === 'REFUND' ? 'refunded' : 'revoked');
  }
  await recordEvent(eventKey);
}
