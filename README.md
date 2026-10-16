# GameShot Cropper

A React Native / Expo batch screenshot cropper for iOS and Android, with a functional browser preview. Cropping is local to the user's device. **Free batches support up to three selected images without login or uploads.** Larger batches require verified Pro access.

## Using the app

Choose several images from the crop studio. The **Pro preset** starts at X=1488, Y=570 and extracts exactly 3350 × 1700 pixels. A source must be at least 4838 × 2270 pixels for this preset. It is not scaled to match other screen resolutions; the preset remains available in free batches.

Switch to **Pixels** to enter an exact width, height and top-left offsets. Enable centering to compute a separate centered position for each image, or drag the preview rectangle to set fixed source-pixel offsets.

Switch to **Aspect ratio** for a common preset or your own positive ratio, such as 4.5:3. The largest fitting crop is the default. Move the frame or resize its lower-right handle; the ratio is preserved subject to integer-pixel rounding. The size buttons also shrink or enlarge the crop. Ratio-mode positions map proportionally across different source sizes.

Choose PNG for lossless screenshots or JPG for smaller, lossy copies. Crop the batch, then open Exports. Invalid sources are reported individually rather than silently scaled. Processing is sequential and can be stopped between images. Selecting more than three images is allowed; attempting an oversized free batch does not discard or reorder the queue.

## Posting order

Images stay in the picker-returned order, with later imports added at the end. Internal crop files keep their original import-numbered names. Every export makes a canonical immutable snapshot of the currently selected final order and names its files `0001_GameShot_<batch>.png` / `.jpg`, `0002_GameShot_<batch>…`. Padding is at least four digits and widens for larger exports. Selected subsets start at `0001` with no gaps; custom order is renumbered to match. ZIP, folder, phone share sheet, single-image export and native gallery copies use the same names. Retries keep each image's originally assigned name.

The reliable workflow is numbered ZIP/folder files sorted by **Name, ascending**. On iPhone: Files → Downloads → tap the ZIP to extract → open `cropped/` → **…** → **Name**. [Apple documents Files sorting by Name](https://support.apple.com/guide/iphone/find-and-view-files-and-folders-iphe4bff8827/ios), while [iPhone Photos sorts by date added or captured](https://support.apple.com/guide/iphone/sort-and-filter-the-photo-library-iph2e66e2f2c/ios), not filename. Native gallery writes are awaited sequentially (last-to-first, best effort), but this cannot control Photos or a posting app. Check the destination preview before posting. Renaming never re-encodes crops, edits capture dates, adds watermarks or changes originals.

## Exports: review, choose, order, save

Exports shows each batch as a numbered thumbnail grid. Selected badges match final export positions; excluded pictures are marked. **Review export order** previews only the selected pictures, in the exact sequence and filenames used by ZIP. Normal full-batch browsing labels its batch position separately from export position. Tap a crop for a full-screen preview (size, file size, source name, Earlier/Later, download/share). Tap a thumbnail's corner to include or exclude it; **All / None** select quickly. **Edit order** (or Earlier/Later in the preview) sets a custom posting order; every export path renumbers the selected files (`0001_GameShot_…`, `0002_GameShot_…`) to match, while **Reset** returns to import order. Batches over 35 images show **Post 1 · 1–35**, **Post 2 · 36–70** … buttons that select one TikTok-sized group. Every action exports only the selected images, in the shown order. An expandable **Where do my pictures go?** guide explains each destination.

| Action | Where the copies end up | Tier |
| --- | --- | --- |
| Share / Save to Photos (phone browsers) | Numbered image files go to the share sheet; Save Images creates Photos copies whose display order Photos controls | Free |
| Save numbered files (ZIP) (browser) | One `GameShot-<batch>.zip` in Downloads; extract `cropped/` and sort by Name ascending. ZIPs do not appear in Photos | Free |
| Save to gallery (iOS/Android app) | New numbered copies saved sequentially; Photos/Gallery may display by date rather than filename | Free |
| Share numbered ZIP (iOS/Android app) | Choose Save to Files/Drive, extract and sort by Name | Free |
| Save to a folder (desktop Chrome/Edge) | A new `GameShot-YYYY-MM-DD-HHMM` subfolder inside the folder you pick, as separate files; existing files are never overwritten | Pro |
| Keep on this device | Browser: IndexedDB site storage. App: copied into the private documents folder `GameShot/kept/<batch-id>/` plus local metadata. Reopen from **Exports → On this device**; limit 20 batches / 256 MB; not a cloud backup | Pro |

On iOS/Android, session outputs are written to temporary cache storage at `GameShot/session/<batch-id>/`, which GameShot clears on its next launch; **Keep on this device** copies a batch into durable app storage. Gallery and single-file shares use temporary copies named for the chosen posting order. In the browser, unsaved output URLs are session-local; without **Keep on this device**, save before closing or reloading. Originals are never edited.

**Saved crops (Pro)** live in the crop studio under the crop controls: save a named Pixels or Aspect-ratio crop (up to 30), tap to load it, × to delete. Each stores its name, creation time and crop settings on the device; no pixels.

ZIP assembly has a 128 MB encoded-output limit to protect device memory. Larger Pro batches can be exported as smaller selections, individually, to a folder, or as gallery copies. Imports above 100 megapixels are rejected. Native processing uses the native image engine asynchronously while the app is in the foreground. Cropping removes edge content by design. PNG exports do not promise preservation of source metadata, wide-gamut/HDR color profiles or animated image frames.

## Pro purchases

The approved offer is **$9.99 USD once** for GameShot Pro. Larger batches require current, server-verified paid access. The **Pro** tab contains sign-in, Checkout, account restoration and purchase/checkout history. Web Checkout accepts card-backed payments and eligible Apple Pay through Stripe's current `allowed_payment_method_types: ['card']` filter, with promotion codes and no subscription.

The Stripe account is still in **test mode**. A provider-verified payment, not a redirect URL or local flag, grants Pro. Native iOS buying uses the direct `expo-iap` StoreKit bridge and stays unavailable in Expo Go or before Apple setup. Android in-app purchasing was not added. Paid batches need an internet connection to verify access, but screenshot pixels never leave the device.

## Development

Keep the supplied application slug, iOS/Android identifiers and deep-link scheme. The app uses the installed Expo SDK 57 starter, Expo Router, TypeScript, NativeWind, and the supplied runtime providers. Metro/Web listens on 8081 and the API on 3000.

Use the pinned package manager:

```sh
npx --yes pnpm@9.12.0 install --frozen-lockfile
npx --yes pnpm@9.12.0 db:push
npx --yes pnpm@9.12.0 dev
```

The database command applies additive user/billing migrations. Free cropping itself does not depend on a server request. Do not set `CI=1` on resident Metro because it disables live reloads.

```sh
npx --yes pnpm@9.12.0 check
npx --yes pnpm@9.12.0 test
npx --yes pnpm@9.12.0 build
npx expo export --platform web --platform ios --platform android --output-dir /tmp/gameshot-bundles
```

## Modules

Pure crop geometry lives in `lib/crop/geometry.ts`, sequential batch execution in `batch.ts`, and current-session state in `store.tsx`. `platform.native.ts` uses Expo image, filesystem, picker, sharing and media-library APIs. `platform.web.ts` uses local browser decoding, canvas and ZIP downloads. Interactive components are in `components/crop/`; Crop studio, Exports and Pro are in `app/(tabs)/`.

`shared/billing.ts` centralizes the approved offer. `server/billing/` contains catalog/purchase/event records, signed Stripe callbacks, refund checks and current Apple transaction verification. The Metro `/api/*` proxy streams callbacks unchanged to port 3000. Login uses a public random state and a **different private verifier** in an HttpOnly cookie or native SecureStore; intercepted state alone cannot complete login. Provider keys and raw receipts are not stored in application tables.

## Owner activation

Claim the Stripe sandbox in **Dashboard → Settings → Integrations**, test the real buyer/login/Checkout flow yourself, then publish the backend and add the live Stripe key pair through that same protected Dashboard section. Republish to load live credentials. Do not enter real card details into test mode or send card details in chat.

For iOS, create a **non-consumable** App Store Connect product at the $9.99 U.S. base price:

| Setting | Value |
| --- | --- |
| Bundle ID | `space.manus.gameshot.t070466106350822` |
| Product ID | `space.manus.gameshot.t070466106350822.pro.lifetime` |
| Private server values | `APPLE_IAP_PRIVATE_KEY`, `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID` |
| Production app identifier | `APPLE_APP_ID` (numeric App Store ID) |

Provide Apple key values only through protected secret entry, never source or chat. Configure signed App Store notifications at `/api/apple/notifications` on the **published** API origin. Test purchases and restoration with a signed native development/TestFlight build on a physical iPhone. **Expo Go is not an IAP client.** Production verification uses Apple's current server transaction lookup, not an old receipt alone.

The backend's test/live mode follows the Stripe environment: use a test backend for App Store sandbox builds and a live backend for production. Release builds must use the stable published API environment, not the temporary development endpoint. Account/tax/bank attestations, live activation, payment completion and store submission remain owner actions. Before submission, finish store metadata, privacy disclosures and applicable login/review requirements. Build from the latest payment version in Version history, not an older crop-only version.

## Phone and validation boundaries

Use Dashboard Connect Expo and sign into Expo Go with the matching account for free-crop phone previews. A web preview or native bundle compilation does not verify phone permissions, file sharing, gallery writes, memory use or StoreKit. Signed APK/AAB and iOS/TestFlight builds are Dashboard actions; compilation is not store submission or a release binary.

Real HTTP checks verify public Pro rendering, logged-out free/paid batch guards, callback routing and secure public-login state/cookies. The approved $9.99 USD non-recurring Stripe **test catalog** was created and retrieved. Automated payment tests use isolated provider/database/buyer fixtures plus real signature/JWT cryptography; no fake buyers are seeded into the running app. No real buyer Checkout completion, live charge, signed native build or physical-device StoreKit purchase has been performed on your behalf.

## Implementation references

- [Expo ImageManipulator](https://docs.expo.dev/versions/latest/sdk/imagemanipulator/) — native crop/render/save API.
- [Expo ImagePicker](https://docs.expo.dev/versions/latest/sdk/imagepicker/) — multi-image selection.
- [Stripe Checkout API](https://docs.stripe.com/api/checkout/sessions/create) — central one-time price and card-only eligibility filter.
- [Expo IAP setup](https://openiap.dev/docs/setup/expo) — native module and signed-build requirements.
- [Apple server library](https://github.com/apple/app-store-server-library-node) — current signed-transaction verification.

## Ordered transfer tools

Exports starts with **Order locked**. Unlock only when intentionally rearranging; the original picker-returned sequence (including later additions) remains the default. The lock protects reorder controls in both the batch grid and full-screen viewer, not image selection or downloads. File-manager Name sorting of numbered exports follows the selected sequence. If your device picker returns a different order from your taps, review the numbered queue before cropping.

**Transfer to a posting app** offers TikTok, Instagram, YouTube and Other labels and a user-editable images-per-group setting. Group buttons select consecutive ranges without changing image order. Group size is a planning choice, not a guaranteed platform limit. For YouTube, these are still images: use an image-capable post or a video/slideshow editor; GameShot does not create or upload Shorts videos.

Every ZIP now includes **ORDER.txt** and **order.json**, mapping final posting position to original input position, source name, final filename and dimensions. A standalone selected-image checklist can also be downloaded/shared. Text receipts never enter photo share sheets. On the destination app, select numbered files in order and check its preview—GameShot cannot force another app’s sorting or automatically publish. Changed selections/orders can be saved to the native gallery as a new ordered set; successful copies of the same set are tracked to avoid duplicate saves, while partial failures remain retryable. Saved-library operations are serialized so rapid reordering cannot race a reopen or removal.
