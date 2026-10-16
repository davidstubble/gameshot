// Metro selects local-library.web.ts on web and local-library.native.ts on iOS/Android.
// This fallback gives TypeScript the common cross-platform contract.
export * from './local-library.native';
