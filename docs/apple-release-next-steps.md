# GameShot: Apple-only release

Apple membership is **Pending**, according to the owner. The owner reports a **$104.45 membership payment**. Do not buy membership again. Google Play and Windows Store enrollment are no longer part of this release.

## What is ready in source

GameShot has exact-pixel and aspect-ratio cropping, ordered batch exports, full-screen export review, named crop presets and an opt-in local batch library. Originals and screenshot pixels are protected. Free batches contain up to three images; Pro is **$9.99 USD once**, not a subscription. Destination Photos/social apps can reorder images; numbered ZIP/folder exports sorted by Name are the reliable file-order workflow.

The Apple verification environment is now separate from Stripe. The production backend uses Apple Production without requiring a live Stripe account. Receipt verification, current transaction lookup, account binding, refund/revocation handling and purchase-history selection preserve this mode. Sandbox licenses do not become production Pro. Web Stripe purchasing remains independently closed until its own activation, which is not required for the Apple-only launch.

These are source changes and automated checks—not proof of a signed iPhone build, successful StoreKit purchase, or App Store listing.

## What happens when membership becomes Active

Open [App Store Connect](https://appstoreconnect.apple.com/) using the enrolled Apple Account. Create the app record using the existing bundle ID **`space.manus.gameshot.t070466106350822`**, keeping the project identifiers unchanged. Configure Pro as a **non-consumable**, U.S. base price **$9.99**, product ID **`space.manus.gameshot.t070466106350822.pro.lifetime`**.

Review and complete Apple's paid-app agreements and bank/tax setup directly with Apple. Native customer purchases go through Apple and are paid to the bank account you configure there, after applicable deductions—not to the assistant or through Stripe.

Apple server configuration uses `APPLE_IAP_PRIVATE_KEY`, `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID` and the numeric `APPLE_APP_ID`. Supply these through protected configuration, not chat, screenshots or source. Production defaults to Apple's production environment; a separate development/testing backend defaults to Sandbox. If explicitly supplied, `APPLE_IAP_ENVIRONMENT` accepts only `production` or `sandbox`.

## Required app work before submission

The current app has only the existing hosted sign-in flow. The owner has been asked whether to add **Sign in with Apple** as an additional customer login; the current web/admin accounts should remain intact. Apple requires an equivalent privacy-preserving option for qualifying third-party login flows, subject to its stated exceptions. This decision concerns app customers, not developer enrollment. [1]

**In-app account deletion is still missing.** The current support-email route is not sufficient for this type of app. Provide an authenticated in-app deletion flow, clear confirmation and correct handling of personal data, sessions and purchase records. Do not require customers to contact support to initiate deletion. If Sign in with Apple is added, its token revocation must be included. [2]

Resolve Sandbox/TestFlight/App Review purchase testing before submission. This production backend intentionally rejects sandbox licensing; configuring reviewer purchases is a real remaining gate, not permission to weaken the public production guard. Apple asks developers to configure in-app purchases for review in the sandbox. [3]

Use the project's native build Dashboard to create the signed iPhone/TestFlight build from accepted source. Check imports, touch controls, permission prompts, sharing/gallery behavior, purchase, cancellation and restoration on a real iPhone. An exported JavaScript/Hermes bundle is not an IPA or uploaded TestFlight build.

Prepare actual iPhone screenshots, support/privacy links, store description, age rating, privacy disclosures and reviewer access. Review the exact final submission with the owner before submitting. Approval is not guaranteed; no store submission is complete yet.

## References

[1]: https://developer.apple.com/app-store/review/guidelines/ "Apple App Review Guidelines, including login services"
[2]: https://developer.apple.com/support/offering-account-deletion-in-your-app/ "Apple's in-app account deletion requirements"
[3]: https://developer.apple.com/help/app-review/before-submitting-for-review/configure-in-app-purchases "Configure in-app purchases for App Review in Sandbox"
