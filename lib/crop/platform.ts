// Metro selects platform.web.ts on web and platform.native.ts on iOS/Android.
// This fallback gives TypeScript the common cross-platform contract.
export * from './platform.native';
