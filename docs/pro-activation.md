# GameShot Pro: activation guide

## What is built

**Free:** up to three selected images per batch, all pixel/aspect-ratio crop modes, preview and numbered non-destructive exports. No login or image upload is required for free cropping.

**Pro:** **$9.99 USD one-time**, linked to the buyer's GameShot account, for larger batches within the existing device limits. There is no subscription. Paid batches require an internet connection for verification; screenshot pixels stay on the device.

The app now has a Pro screen, real sign-in, Stripe-hosted web Checkout, durable purchase records, purchase history, signed callback handling and restoration. Native iPhone StoreKit buying/restoration is implemented but deliberately disabled until Apple configuration and a signed build are available.

## Current status

Stripe is **testing only**, not live. The approved $9.99 USD non-recurring test price was created and retrieved. Public preview, anonymous batch guards and login setup have been checked. Provider fulfillment, signatures, session validation, ownership and replay protection have automated coverage with isolated fixtures. No real buyer Checkout completion, live charge or physical iPhone StoreKit purchase was performed on your behalf.

## 1. Test web sales yourself

Open **Pro** in a separate browser tab, allow pop-ups, sign in, and click **Buy Pro**. Checkout opens in a new tab. Complete a test payment using Stripe's published test card **4242 4242 4242 4242**, a future expiry and a test CVC. Use test details only; do not send card details in chat.

The return page should show verified Pro access and a purchase-history record. Also try cancelling Checkout and a larger batch before buying: cancellation must not grant access, and a free batch over three selected images must keep the queue intact while asking for Pro. Restore should recover a verified purchase when you sign in with the same account.

Apple Pay appears in web Checkout only on eligible devices/browsers/wallets. In the native iPhone app, digital Pro access uses **App Store purchasing**, not an Apple Pay button.

## 2. Activate live web sales

Claim the Stripe sandbox through **Dashboard → Settings → Integrations**. Complete your own merchant onboarding and required business/bank/tax information.

Publish the app's backend before live sales. Publishing and official onboarding must be approved/completed by you. Supply the live publishable/secret Stripe key pair in that same protected Dashboard section, then republish so the server receives the live values. The managed production callback uses `/api/stripe/webhook`; do not create a duplicate callback or paste keys into source/chat.

Confirm the Pro screen says live/secure payments rather than test payments. Have an authorized real buyer perform the first live check. Stripe processing fees, refunds and any taxes are separate from the $9.99 price.

## 3. Activate native iPhone sales

In App Store Connect, finish the developer agreements and create the app's **non-consumable** product:

| Setting | Value |
| --- | --- |
| Bundle ID | `space.manus.gameshot.t070466106350822` |
| Pro product ID | `space.manus.gameshot.t070466106350822.pro.lifetime` |
| U.S. base price | $9.99, one-time |
| Product type | Non-consumable |

Create the App Store server In-App Purchase key and supply the following **through protected secret entry only**: `APPLE_IAP_PRIVATE_KEY` (the .p8 key contents), `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`, and production `APPLE_APP_ID` (the numeric App Store app ID). Never send private keys in chat.

Configure signed App Store server notifications at `/api/apple/notifications` on the published API origin. The app verifies current Apple transaction state and ties it to the signed-in account; a refunded/revoked purchase cannot be revived by replaying older data.

Apple verification is independent of Stripe. A production backend defaults to Apple Production; a development/testing backend defaults to Sandbox. `APPLE_IAP_ENVIRONMENT`, when explicitly configured, accepts only `production` or `sandbox`. Public production backends do not offer sandbox purchases or grant test licenses. An Apple-only launch does not require Stripe merchant activation. Web Stripe purchasing stays separately closed until its own live setup is complete.

Create a signed native development/TestFlight build from the latest recorded source version. Test purchase, cancellation, interrupted purchase and restoration on a physical iPhone with a separately configured sandbox-capable testing backend/account. **Expo Go cannot test IAP.** Use the stable published production API for the production release. Sandbox/TestFlight/reviewer purchase testing must be resolved before submission; a sandbox receipt sent to this production-only verifier is rejected, not silently promoted to a real paid license.

Complete store screenshots, metadata, privacy disclosures and applicable login/review requirements before submitting the app. No store submission has been made.

## Remaining boundaries

Android in-app billing is not part of this Apple-only payment setup. Android users can restore already-owned account access, but there is no Android purchase button configured. The existing file-order fix remains unchanged. Other posting apps can apply their own gallery ordering; numbered export filenames preserve the imported sequence when sorted by name.

The source is saved in the app repository after final verification. Before a native build, confirm the latest payment version appears in Version history; do not build an older crop-only version. Temporary development endpoints are not production hosting.

### Primary setup references

- [Stripe testing](https://docs.stripe.com/testing)
- [Stripe Checkout payment methods](https://docs.stripe.com/payments/payment-method-configurations)
- [Expo in-app purchase setup](https://openiap.dev/docs/setup/expo)
- [Apple App Store server library and key setup](https://github.com/apple/app-store-server-library-node)
