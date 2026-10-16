import {
  metadataForPublicRoute,
  normalizePublicWebRoute,
  type PublicRouteMetadata,
  type PublicWebRoute,
} from "../../lib/web/metadata";
import { PUBLIC_SITE } from "../../shared/public-site";

export { normalizePublicWebRoute } from "../../lib/web/metadata";
export type { PublicWebRoute } from "../../lib/web/metadata";

export function configuredPublicOrigin(value = process.env.PUBLIC_APP_ORIGIN || PUBLIC_SITE.origin): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function metaTag(attribute: "name" | "property", value: string, content: string): string {
  return `<meta ${attribute}="${value}" content="${escapeHtml(content)}">`;
}

function removeMetaTag(html: string, attribute: "name" | "property", value: string): string {
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(
    new RegExp(
      `<meta\\b(?=[^>]*\\b${attribute}\\s*=\\s*(?:"${escapedValue}"|'${escapedValue}'|${escapedValue})(?:\\s|/|>))[^>]*>`,
      "gi",
    ),
    "",
  );
}

function metadataHead(metadata: PublicRouteMetadata, pathname: PublicWebRoute, origin: string | null): string {
  const tags = [
    `<title>${escapeHtml(metadata.title)}</title>`,
    metaTag("name", "description", metadata.description),
    metadata.noindex ? metaTag("name", "robots", "noindex, nofollow, noarchive") : "",
    metaTag("property", "og:type", "website"),
    metaTag("property", "og:title", metadata.title),
    metaTag("property", "og:description", metadata.description),
    metaTag("property", "og:site_name", PUBLIC_SITE.publisher),
    metaTag("name", "twitter:card", "summary"),
    metaTag("name", "twitter:title", metadata.title),
    metaTag("name", "twitter:description", metadata.description),
  ];

  if (origin) {
    const pageUrl = new URL(pathname, origin).toString();
    const imageUrl = new URL("/icons/icon-512.png", origin).toString();
    tags.push(
      `<link rel="canonical" href="${escapeHtml(pageUrl)}">`,
      metaTag("property", "og:url", pageUrl),
      metaTag("property", "og:image", imageUrl),
      metaTag("name", "twitter:image", imageUrl),
    );
  }

  return tags.filter(Boolean).join("");
}

/** Injects route-specific public metadata into Expo's statically generated initial HTML. */
export function injectRouteMetadata(html: string, pathname: string, publicOrigin?: string): string {
  const route = normalizePublicWebRoute(pathname);
  const metadata = metadataForPublicRoute(pathname);
  if (!route || !metadata) return html;

  let document = html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "");
  for (const [attribute, value] of [
    ["name", "description"],
    ["name", "robots"],
    ["name", "twitter:card"],
    ["name", "twitter:title"],
    ["name", "twitter:description"],
    ["name", "twitter:image"],
    ["property", "og:type"],
    ["property", "og:title"],
    ["property", "og:description"],
    ["property", "og:site_name"],
    ["property", "og:url"],
    ["property", "og:image"],
  ] as const) {
    document = removeMetaTag(document, attribute, value);
  }
  document = document.replace(/<link\b(?=[^>]*\brel\s*=\s*(?:"canonical"|'canonical'|canonical)(?:\s|\/|>))[^>]*>/gi, "");

  return document.replace(/<head(?:\s[^>]*)?>/i, (head) => {
    return `${head}${metadataHead(metadata, route, configuredPublicOrigin(publicOrigin))}`;
  });
}

export function notFoundHtml(): string {
  return "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><meta name=\"robots\" content=\"noindex, nofollow\"><title>GameShot Cropper — Page not found</title></head><body><main><h1>Page not found</h1><p>This GameShot page is unavailable.</p></main></body></html>";
}
