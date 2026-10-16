// Public release configuration only. Never add credentials or personal signup details here.
// Set the real canonical origin only after the platform returns a deployed URL.
// Set supportEmail only after the owner confirms the inbox works.
export const PUBLIC_SITE = {
  publisher: 'GameShot LABS',
  origin: 'https://gameshot-okddvuhx.manus.space' as string | null,
  supportEmail: 'gameshot.apps@outlook.com' as string | null,
  // Add the owner-created public profile URLs when available; null keeps the buttons honest.
  buyMeACoffeeUrl: null as string | null,
  patreonUrl: null as string | null,
  patreonSuggestionTier: 'Idea Partner',
} as const;

// Explicit owner-authorized aliases; never trust arbitrary request Host values.
export const PUBLIC_SITE_ALIASES = [
  'https://gameshotlabs.com',
  'https://www.gameshotlabs.com',
] as const;
