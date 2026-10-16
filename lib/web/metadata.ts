export type PublicWebRoute = '/' | '/app/crop' | '/app/image' | '/app/layout' | '/app/gift-rush' | '/app/foundry' | '/exports' | '/pro' | '/oauth/callback' | '/privacy' | '/terms' | '/support';
export type PublicRouteMetadata = { title: string; description: string; noindex?: boolean };
export const PUBLIC_WEB_ROUTE_FILES: Record<PublicWebRoute, string> = {
  '/': 'index.html', '/app/crop': 'app/crop.html', '/app/image': 'app/image.html', '/app/layout': 'app/layout.html', '/app/gift-rush': 'app/gift-rush.html', '/app/foundry': 'app/foundry.html',
  '/exports': 'exports.html', '/pro': 'pro.html', '/oauth/callback': 'oauth/callback.html',
  '/privacy': 'privacy.html', '/terms': 'terms.html', '/support': 'support.html',
};
export const PUBLIC_ROUTE_METADATA: Record<PublicWebRoute, PublicRouteMetadata> = {
  '/': { title: 'GameShot LABS — Local-first image studio', description: 'Crop, resize, convert and arrange screenshots into ordered exports, reference contact sheets and PDF layouts. Your image processing stays on your device.' },
  '/app/crop': { title: 'Crop Lab — GameShot LABS', description: 'Batch-crop screenshots with exact source pixels or custom ratios, preserve your preferred order and export new numbered copies.' },
  '/app/image': { title: 'Image Lab — Resize and convert | GameShot LABS', description: 'Prepare PNG and JPEG copies locally with aspect-preserving resizing, precise target dimensions and quality controls.' },
  '/app/layout': { title: 'Layout Lab — Ordered PDF and contact sheets | GameShot LABS', description: 'Arrange screenshot references, research boards and album images into contact sheets or multi-page PDF layouts for print and design handoff.' },
  '/app/gift-rush': { title: 'Gift Rush — Virtual-credit reveal game | GameShot LABS', description: 'Queue a virtual gift, trigger a rapid social reveal and play a no-cash-value prototype from GameShot LABS.' },
  '/app/foundry': { title: 'GameShot Foundry — Buildable app and tool blueprints', description: 'Turn a rough idea into a structured app, agent, game, or utility blueprint with workflow, roles, safety gates, and launch steps.' },
  '/exports': { title: 'GameShot exports — Keep screenshot order', description: 'Review full-resolution exports, lock your preferred order and transfer numbered image copies.', noindex: true },
  '/pro': { title: 'GameShot LABS pricing — Workflow packs and studio bundle', description: 'Choose the GameShot LABS workflow pack you need, from Crop Pass and Creator Pack to the planned Studio Bundle.' },
  '/oauth/callback': { title: 'GameShot sign-in — Verifying access', description: 'Complete GameShot sign-in securely before returning to Pro access.', noindex: true },
  '/privacy': { title: 'GameShot LABS privacy — Images stay local', description: 'Learn about local image preparation, device storage and the account/payment information used for Pro.' },
  '/terms': { title: 'GameShot LABS terms — Free batches and one-time Pro', description: 'Read service terms, free three-image workflows, one-time Pro billing, device limits and purchase support.' },
  '/support': { title: 'GameShot LABS support — Tools and purchases', description: 'Get crop, resize, layout, numbered-export and verified Pro help from GameShot LABS.' },
};
export function normalizePublicWebRoute(pathname: string): PublicWebRoute | null {
  const normalized = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
  return Object.prototype.hasOwnProperty.call(PUBLIC_WEB_ROUTE_FILES, normalized) ? normalized as PublicWebRoute : null;
}
export function metadataForPublicRoute(pathname: string): PublicRouteMetadata | null {
  const route = normalizePublicWebRoute(pathname);
  return route ? PUBLIC_ROUTE_METADATA[route] : null;
}
