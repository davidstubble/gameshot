export type PricingKind = 'free' | 'one_time' | 'virtual_good';
export type PricingProduct = {
  key: string;
  name: string;
  kind: PricingKind;
  displayPrice: string;
  amountCents: number | null;
  availability: 'available' | 'planned';
  description: string;
  features: readonly string[];
};

export const APPROVED_PRICING = {
  free: {
    key: 'gameshot-free', name: 'Free', kind: 'free', displayPrice: '$0', amountCents: 0, availability: 'available',
    description: 'Try the local-first studio with up to 3 images per batch.',
    features: ['3 images per batch', 'Crop, Image, and Layout basics', 'Ordered exports and ZIP receipts', 'No watermark'],
  },
  crop: {
    key: 'gameshot-crop-pass-v1', name: 'Crop Pass', kind: 'one_time', displayPrice: '$7.99', amountCents: 799, availability: 'planned',
    description: 'For larger exact-pixel crop workflows.',
    features: ['Larger crop batches', 'Saved local crop presets', 'Game and social presets', 'Repeat-batch workflow'],
  },
  creator: {
    key: 'gameshot-creator-pack-v1', name: 'Creator Pack', kind: 'one_time', displayPrice: '$9.99', amountCents: 999, availability: 'planned',
    description: 'For social, streaming, and creator delivery workflows.',
    features: ['Larger Image Lab batches', 'Platform-size presets', 'Creator delivery packs', 'Transfer Kit receipts'],
  },
  layout: {
    key: 'gameshot-layout-print-pack-v1', name: 'Layout & Print Pack', kind: 'one_time', displayPrice: '$9.99', amountCents: 999, availability: 'planned',
    description: 'For storyboards, albums, research boards, and print preparation.',
    features: ['Larger ordered layouts', 'Storyboard and album modes', 'Print page presets', 'Captions and page numbers'],
  },
  privacy: {
    key: 'gameshot-privacy-pack-v1', name: 'Privacy Pack', kind: 'one_time', displayPrice: '$9.99', amountCents: 999, availability: 'planned',
    description: 'For batch redaction after Privacy Lab is released and tested.',
    features: ['Batch redaction', 'Flattened verification', 'Metadata-choice workflows', 'Privacy receipts'],
  },
  studio: {
    key: 'gameshot-studio-bundle-v1', name: 'Studio Bundle', kind: 'one_time', displayPrice: '$19.99 early / $29.99 standard', amountCents: 1999, availability: 'planned',
    description: 'The complete local-first studio bundle during the early-adopter window.',
    features: ['Crop Pass', 'Creator Pack', 'Layout & Print Pack', 'Privacy Pack when released', 'Premium Transfer Kit workflows'],
  },
  giftTheme: {
    key: 'gift-rush-theme-v1', name: 'Gift Rush cosmetic theme', kind: 'virtual_good', displayPrice: '$0.99–$1.99', amountCents: null, availability: 'planned',
    description: 'Virtual-only cosmetic content; no cash value.', features: ['Reveal theme', 'No withdrawals', 'No cash prizes'],
  },
} as const satisfies Record<string, PricingProduct>;

export type ApprovedPricingKey = keyof typeof APPROVED_PRICING;
export const APPROVED_PRICING_LIST = Object.values(APPROVED_PRICING) as PricingProduct[];
