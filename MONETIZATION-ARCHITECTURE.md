# GameShot LABS Monetization Architecture

## Business goal

GameShot LABS should earn revenue from a connected family of tools while preserving local-first processing and clear user value.

The product should not depend on one risky mechanism. Revenue should come from several understandable sources:

1. GameShot LABS Pro.
2. Paid creator workflows.
3. Creator and event tools.
4. Optional support memberships.
5. Gift Rush virtual goods.
6. A separately reviewed real-money gaming product only if it becomes legally and operationally viable.

## Recommended core offer

### GameShot LABS Pro — $9.99 one time

Keep the approved one-time offer as the main cross-tool unlock.

Pro should cover:

- Larger image batches.
- Saved local crop workflows.
- Saved local image-preparation workflows.
- On-device export library.
- Save-to-folder conveniences.
- Advanced layout/storyboard presets.
- Privacy Lab batch operations when released.
- Transfer Kit receipts and reusable posting presets.
- No cloud image uploads.
- No recurring charge.

This makes the existing $9.99 purchase useful across the entire studio instead of attaching it only to Crop Lab.

## Tool-by-tool revenue map

### Crop Lab

Free:

- All crop modes.
- Up to three images per batch.
- ZIP and ordered export.
- Basic sharing and review.

Pro:

- Larger verified batches.
- Saved presets.
- Local batch history.
- Advanced reusable workflows.

### Image Lab / Creator Kit

Free:

- Basic resize and format conversion.
- Up to three images per batch.

Pro:

- Larger batches.
- Saved platform presets.
- Output manifests.
- Persistent local history.
- Creator delivery packs.

### Layout Lab / Storyboard & Print Lab

Free:

- Basic PDF and small layouts.

Pro:

- Larger albums.
- Saved layout templates.
- Storyboard and print presets.
- Page numbering, captions, and reusable title styles.

### Privacy Lab

Free:

- Single-image local redaction.
- Basic preview and export.

Pro:

- Batch redaction.
- Saved redaction workflows.
- Batch verification receipts.
- Persistent local history.

### Transfer Kit

Free:

- Basic ordered checklist.
- ZIP order receipt.
- Platform guidance.

Pro:

- Saved platform profiles.
- Reusable group sizes.
- Creator delivery packs.
- Multiple posting sessions and local history.

## Gift Rush monetization

The first Gift Rush version should use virtual credits only. It can still be monetized without cash gambling.

### Safe paid features

- Cosmetic reveal themes.
- Sound packs.
- Profile badges.
- Room themes.
- Creator-branded visual packs.
- Ad-free access.
- Creator room subscriptions.
- Sponsored virtual-credit events.

On iOS, digital goods and in-app functionality require the appropriate Apple In-App Purchase path. On the web, Stripe can be used only when the production account is activated and the exact product/payment configuration is ready.

### Virtual-credit rules

- Credits have no cash value.
- Credits cannot be withdrawn.
- Credits cannot be converted to gift cards.
- Credits cannot be sold or exchanged between users.
- The app must not advertise guaranteed profit.
- The app must not use Apple Cash as a wallet or gambling funding source.
- Any randomized purchased cosmetic item must disclose odds where required.

## Future real-money product gate

A cash-reward or randomized payout mode must not be mixed into the ordinary GameShot LABS Pro purchase.

Before enabling it, the owner would need:

```text
LEGAL OPINION
LICENSES_AND_PERMISSIONS
APPROVED_JURISDICTIONS
AGE_VERIFICATION
GEO_RESTRICTION
KYC_AML
RESPONSIBLE_GAMING
RANDOMNESS_AUDIT
DEPOSIT_AND_WITHDRAWAL_RECONCILIATION
FRAUD_AND_CHARGEBACK_CONTROLS
OFFICIAL_RULES
PAYMENT_PROVIDER_APPROVAL
APP_STORE_REVIEW_PLAN
OWNER_APPROVAL_OF_EXACT_REAL_MONEY_FLOW
```

Until all are complete, Gift Rush remains a virtual-credit entertainment game.

## Revenue flow architecture

```text
USER
  |
  +--> GameShot LABS Pro --------------------+
  |       $9.99 one-time                     |
  |                                           |
  +--> Creator workflow pack ---------------+--> Unified verified entitlement
  |                                           |
  +--> Gift Rush cosmetic purchase ----------+
  |
  +--> Optional Patreon / Buy Me a Coffee support
  |
  +--> Future regulated cash product
          separate account, ledger, compliance, and payout controls
```

The first four ordinary products can share the existing Pro entitlement. Gift Rush cosmetic purchases should use separate product IDs even when access is displayed in the same account.

## Important implementation rules

- Never grant paid access based on a client flag, URL parameter, local cache, or redirect alone.
- Use server-verified Stripe status for web access.
- Use verified StoreKit transactions for iOS access.
- Keep test and production payment environments separate.
- Keep purchase history durable but keep image pixels local.
- Do not send source images to payment or entitlement services.
- Do not call the app a marketplace until seller payouts and tax handling exist.
- Do not call Gift Rush real-money gaming until the regulated flow is actually approved and implemented.

## Pricing experiments

Start with the existing $9.99 Pro purchase. Do not add several confusing tiers immediately.

After usage data exists, evaluate:

- $9.99 one-time Pro.
- $4.99 Creator Pack add-on.
- $3.99 Gift Rush cosmetic pack.
- $5/month Creator Room subscription.
- Sponsored event pricing for organizations.

Prices should be tested only after the product demonstrates repeat use. Do not charge for basic local safety, export order, or the ability to retrieve a user's own files.

## Marketing claims that are safe and useful

Use:

- “Process locally.”
- “Keep your originals.”
- “Move ordered batches into your next workflow.”
- “Build creator-ready image packs.”
- “Turn screenshots into storyboards and print-ready PDFs.”
- “Gift Rush is a fast virtual-credit social reveal game.”

Avoid until legally approved:

- “Make money.”
- “Earn guaranteed cash.”
- “Double your deposit.”
- “Beat the house.”
- “Cash out instantly.”
- “Risk-free winnings.”

## Recommended next implementation sequence

1. Treat GameShot LABS Pro as the shared cross-tool entitlement.
2. Add named Creator, Storyboard, Print, Privacy, and Transfer presets.
3. Add a Gift Rush cosmetics screen with virtual-only product placeholders.
4. Keep payment buttons disabled or clearly marked unavailable until the correct web/iOS products are configured.
5. Activate ordinary live payments only after Stripe verification and protected production configuration are complete.
6. Keep any real-money Gift Rush mode in a separate legal and technical workstream.
