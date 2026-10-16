# GameShot LABS Pricing Recommendation

## Recommended launch structure

### Free — $0

Keep the free tier useful enough to create adoption and word-of-mouth.

- Up to 3 images per batch.
- Crop Lab pixel and ratio modes.
- Basic Image Lab conversion.
- Basic Layout Lab export.
- Ordered filenames and ZIP receipt.
- Local-first processing.
- No watermark.
- No account required for basic use.

Do not charge for basic privacy, original-file protection, or the ability to retrieve a user's own output.

### Crop Pass — $7.99 one time

For occasional users who only need the flagship crop workflow.

- Larger crop batches.
- Saved local crop presets.
- Advanced game and social presets.
- Repeat-batch workflow.
- Expanded export review.

### Creator Pack — $9.99 one time

For social creators, streamers, and people preparing media for multiple destinations.

- Larger Image Lab batches.
- Platform-size presets.
- Creator delivery packs.
- Export-size estimates.
- Saved local workflow presets.
- Transfer Kit posting receipts.

### Layout & Print Pack — $9.99 one time

For albums, storyboards, research boards, and printing.

- Larger ordered layouts.
- Storyboard mode.
- Album mode.
- Print-ready page presets.
- Captions, page numbers, margins, and gutters.
- Reusable local layout templates.

### Privacy Pack — $9.99 one time

Release after Privacy Lab is implemented and physically tested.

- Batch redaction.
- Pixelation and blur workflows.
- Flattened redaction verification.
- Metadata-choice workflows.
- Privacy receipts.
- Reusable local redaction presets.

### Studio Bundle — $19.99 early-adopter / $29.99 standard, one time

This should be the main cross-tool conversion target after several packs are available.

Includes:

- Crop Pass.
- Creator Pack.
- Layout & Print Pack.
- Privacy Pack when released.
- Transfer Kit premium workflows.
- Future compatible local studio tools during the bundle’s support period.

The early-adopter price should be time-limited and clearly labeled. Do not silently change an existing purchaser’s entitlement.

## Why this is stronger than one $9.99 studio purchase

A single $9.99 price is attractive but leaves money on the table from users who would pay more for a complete workflow. Separate packs create three useful paths:

- A casual user can buy only the tool they need.
- A creator can buy Creator Pack and later expand.
- A heavy user sees a clear reason to choose the $19.99–$29.99 bundle.

The comparable market supports a wide range: free local utilities exist, while Adobe Express lists Premium at $9.99/month and Canva lists Pro at US$144/year. [1] [2] TinyWow also presents a broad tool suite with free access and a premium offer centered on unlimited, ad-free, faster use, although its public page shows inconsistent visible monthly pricing and should not be treated as a precise benchmark. [3] Batch Image Crop is a direct free local competitor with no signup and no-upload processing. [4]

GameShot LABS should therefore compete on ordered transfer, exact-pixel workflows, local privacy, and practical receipts rather than trying to copy a full design suite.

## Subscription recommendation

Do **not** launch a subscription for the current local-only feature set. A subscription is easier to justify only when it provides ongoing recurring value such as:

- cloud project backup chosen by the user
- team workspaces
- collaborative review
- recurring AI usage
- creator-room services
- commercial support or managed delivery

After those exist, test a separate Creator Club plan at approximately $4.99/month or $49.99/year. Do not hide essential local processing behind a subscription.

## Gift Rush pricing

Keep the first version virtual-credit only. Monetize entertainment features rather than cash outcomes:

- Cosmetic reveal themes: $0.99–$1.99.
- Sound packs: $0.99–$2.99.
- Room themes: $1.99–$4.99.
- Creator room pass: $2.99–$4.99/month only if rooms provide recurring value.
- Sponsored virtual-credit events: custom pricing.

Virtual credits must have no cash value, cannot be withdrawn, and cannot be exchanged. A real-money reward mode is a separate regulated product and should not share the ordinary Pro purchase.

## Data-driven pricing loop

Instrument only product and purchase events, not source-image pixels.

Track:

- free batch starts
- batches stopped at the three-image limit
- paywall views
- pack-detail views
- checkout starts
- completed purchases
- refunds and failed payments
- repeat use after 7 and 30 days
- outputs per user
- use of each tool
- bundle attachment rate
- upgrade path from one pack to bundle

For web, test one price variable at a time by cohort. For iOS, use Apple’s configured product price tiers and do not invent client-side prices. The entitlement service must return the product actually purchased.

### Initial web experiment

Run a controlled test after production payment verification:

- Cohort A: Studio Bundle $19.99.
- Cohort B: Studio Bundle $29.99.
- Keep the free experience identical.
- Measure completed purchase revenue per eligible user, not only conversion rate.
- Stop a price variant if refund rate, payment failure, or support complaints materially increase.

Do not run a price experiment before checkout, entitlement verification, refunds, and support handling are reliable.

## Pricing rules

- Use fixed Stripe Price IDs and Apple product IDs.
- Never accept a price from a client request.
- Show the exact price, billing cadence, and included products before checkout.
- Preserve grandfathered entitlements.
- Keep test and production catalogs separate.
- Keep user images local and outside payment records.
- Do not claim a live purchase path until production verification is complete.

## Recommended immediate decision

Use this public-facing structure first:

```text
Free: 3 images per batch
Crop Pass: $7.99 one time
Creator Pack: $9.99 one time
Layout & Print Pack: $9.99 one time
Studio Bundle: $19.99 early adopter, later $29.99
```

Do not change live prices automatically. The owner should approve the exact catalog before product IDs, Apple price tiers, and production Stripe prices are created.

## References

[1]: https://www.adobe.com/express/pricing "Adobe Express official pricing"
[2]: https://www.canva.com/pricing/ "Canva official pricing"
[3]: https://tinywow.com/ "TinyWow official tool and premium page"
[4]: https://batchimagecrop.com/ "Batch Image Crop official product page"
