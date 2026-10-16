# GameShot LABS — Product Line Roadmap

## Product strategy

GameShot LABS should become a family of local-first creator tools rather than a collection of unrelated utilities. Every product should share the same promises:

- Images are processed on the user's device whenever practical.
- Originals are never overwritten.
- User-selected order is preserved.
- Exports use readable, deterministic filenames.
- Outputs include truthful limitations and destination guidance.
- Paid features add real workflow value rather than artificial lockouts.

## Recommended lineup

### 1. Crop Lab — current flagship

**Audience:** gamers, screenshot creators, researchers, social-media users, album builders.

**Core value:** exact pixel crops, custom aspect-ratio crops, batch processing, ordered filenames, ZIP receipts, and non-destructive exports.

**Next improvements:**

- Recent-settings strip for the last five crop configurations.
- More reusable preset categories: gaming UI, vertical social, square post, print, and research capture.
- A clearer invalid-image report with per-file reason and retry action.
- “Duplicate this batch” for repeating a known workflow with a new image set.
- Export-size estimate before processing.
- One-tap “save this workflow as a preset.”

### 2. Image Lab — current tool, expand into Creator Pack

**Audience:** social creators, web designers, book makers, streamers, and people preparing media for upload limits.

**Core value:** resize and convert ordered batches into predictable delivery formats.

**Recommended additions:**

- Platform-ready presets for vertical post, square post, landscape thumbnail, profile image, presentation image, and print-ready draft.
- A custom preset editor with width, height, fit behavior, format, JPEG quality, and background.
- A before/after dimension and file-size estimate.
- A “do not enlarge” warning before processing.
- A clear output manifest listing every generated filename, dimension, and format.
- A batch summary users can save or share without sharing image pixels.

**Monetization:** include core resizing for free batches; Pro unlocks larger batches, saved workflow presets, and persistent local history.

### 3. Layout Lab — expand into Storyboard & Print Lab

**Audience:** students, researchers, writers, photographers, streamers, authors, and print users.

**Core value:** turn ordered images into readable contact sheets, storyboards, albums, and PDFs.

**Recommended additions:**

- Storyboard mode with larger frame cells and optional scene numbers.
- Album mode with one image per page and optional captions.
- Research-board mode with two or three columns and ordered filenames.
- Print mode with margin, gutter, title, caption, and page-number controls.
- A page preview before PDF generation.
- A “large text” layout preset for small UI and game screenshots.
- PDF receipt containing source order, page count, and generated filename.

**Important boundary:** the tool prepares print files; it should not claim to send jobs to a printer.

### 4. Privacy Lab — highest-value new sub-app

**Audience:** OSINT researchers, journalists, moderators, families, creators, and anyone sharing screenshots safely.

**Core value:** prepare images for publication without uploading them.

**MVP tools:**

- Remove or preserve metadata as an explicit user choice.
- Pixelate or blur a selected region.
- Solid redaction rectangles for names, addresses, account numbers, and private messages.
- Crop sensitive edges.
- Preview original and redacted copy side by side.
- Generate a redaction receipt listing the output files, without storing the original.
- Preserve input order and produce numbered exports.

**Safety requirements:**

- Never claim redaction is irreversible unless the output is flattened and verified.
- Warn that hidden layers, metadata, and neighboring pixels may still reveal information.
- Keep originals untouched.
- Require an explicit final preview before export.

**Monetization:** free single-image redaction; Pro batch redaction, saved redaction workflows, and local history.

### 5. Transfer Kit — turn existing export tools into a dedicated workflow

**Audience:** TikTok, Instagram, YouTube, and multi-platform content creators.

**Core value:** move an ordered image set from GameShot into another app with fewer mistakes.

**Recommended additions:**

- Platform profile presets.
- Grouping presets for carousel limits.
- A numbered visual checklist.
- “Selected order” and “import order” comparison.
- Posting-session receipts.
- Separate guides for Files, Photos, Android gallery, and desktop folders.
- Clear statement that destination apps may reorder items.

This should be a named destination in the studio navigation even though parts already exist in Exports.

### 6. Scan Lab — later expansion

**Audience:** students, receipts/invoices users, families, and small businesses.

**Tools:**

- Camera capture.
- Perspective correction.
- Deskewing.
- Multi-page PDF.
- Page ordering.
- Optional local OCR only after a privacy-preserving implementation is available.

This should not be the next project because camera permissions, device testing, perspective correction, and OCR add substantial complexity.

### 7. Creator Kit — later expansion

**Audience:** streamers, YouTubers, podcast creators, and small businesses.

**Tools:**

- Thumbnail preparation.
- Profile and banner sizing.
- Ordered image packs.
- Transparent PNG handling.
- Contact sheets for approval rounds.
- Export manifest for editors.

The first version can be built mostly from Image Lab and Layout Lab without introducing a separate rendering engine.

### 8. Gift Rush — separate experimental game

Gift Rush should remain a separate product, not a hidden mode inside GameShot LABS. Its first build should use virtual credits only. Real-money rewards, Apple Cash, deposits, withdrawals, and wagering require a separate legal and payments project.

## Build priority

### Priority 1 — finish and strengthen the existing studio

1. Add named workflow presets across Crop Lab and Image Lab.
2. Improve preflight warnings and output-size estimates.
3. Add Storyboard, Album, and Print layout modes.
4. Make Transfer Kit visible as a first-class workflow.
5. Close the remaining source/publication and physical-device validation gaps.

### Priority 2 — Privacy Lab

Privacy Lab is the best independent sub-app because it has a clear problem, strong local-first differentiation, and usefulness beyond gaming screenshots. It also creates a credible reason for journalists, researchers, families, and creators to pay for Pro.

### Priority 3 — Creator Kit

Reuse Image Lab and Layout Lab to create a focused creator workflow. Avoid adding a large social-media API integration at first; prepare files and receipts locally instead.

### Priority 4 — Scan Lab

Build only after native camera and permission testing are available.

### Priority 5 — Gift Rush real-money research

Keep the game prototype separate. Do not connect Apple Cash or real-money payouts until the exact legal, payments, licensing, age, geography, randomness, and responsible-gaming design is approved.

## Suggested navigation

```text
GameShot LABS
├── Crop Lab
├── Image Lab
├── Layout Lab
├── Privacy Lab
├── Transfer Kit
├── Export Library
├── Pro
└── Support / Suggest an App
```

## Strongest next product decision

Build **Privacy Lab** as the next sub-app while expanding Layout Lab into Storyboard & Print Lab inside the existing app. This gives GameShot LABS two distinct marketable promises:

1. **Prepare images for creation and publishing.**
2. **Prepare images for safe sharing.**

Both can remain local-first, preserve order, protect originals, and justify a $9.99 one-time Pro purchase more convincingly than adding unrelated filters.
