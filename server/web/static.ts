import type { Express, Request, Response } from "express";
import { resolve, sep } from "node:path";
import { PUBLIC_WEB_ROUTE_FILES } from "../../lib/web/metadata";
import { injectRouteMetadata, normalizePublicWebRoute, notFoundHtml } from "./routes";

export type ProductionWebOptions = {
  staticDir?: string;
  publicOrigin?: string;
};

const PUBLIC_FIXED_FILES = new Set([
  "/favicon.ico",
  "/manifest.webmanifest",
  "/service-worker.js",
  "/offline.html",
  "/manus-routes.json",
]);

const PRIVATE_WEB_PATH = /^(?:\/oauth(?:\/|$)|\/(?:auth|checkout|pro|history|exports?|user-images?)(?:\/|$))/i;
const HASHED_EXPO_ASSET = /^(?:\/_expo\/static\/(?:css|js|fonts?)\/.+-[a-f0-9]{12,}\.(?:css|js|woff2?|ttf|otf)|\/assets\/.+\.[a-f0-9]{12,}\.(?:png|jpe?g|webp|gif|svg|woff2?|ttf|otf))$/i;

function noStore(res: Response): void {
  res.setHeader("Cache-Control", "private, no-store");
}

function noCache(res: Response): void {
  res.setHeader("Cache-Control", "no-cache");
}

function cacheForStaticAsset(pathname: string, res: Response): void {
  if (HASHED_EXPO_ASSET.test(pathname)) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return;
  }
  noCache(res);
}

function decodedPathname(pathname: string): string | null {
  try {
    const decoded = decodeURIComponent(pathname);
    if (
      !decoded.startsWith("/") ||
      decoded.includes("\0") ||
      decoded.split("/").some((segment) => segment === "." || segment === "..")
    ) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function staticFilePath(root: string, pathname: string): string | null {
  const decoded = decodedPathname(pathname);
  if (!decoded) return null;

  const resolvedRoot = resolve(root);
  const candidate = resolve(resolvedRoot, `.${decoded}`);
  return candidate === resolvedRoot || candidate.startsWith(`${resolvedRoot}${sep}`) ? candidate : null;
}

function isAllowedStaticAsset(pathname: string): boolean {
  return (
    PUBLIC_FIXED_FILES.has(pathname) ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/_expo/static/")
  );
}

function sendNotFound(res: Response, html = false): void {
  noStore(res);
  if (html) {
    res.status(404).type("html").send(notFoundHtml());
    return;
  }
  res.status(404).type("text").send("Not found.");
}

function sendFile(res: Response, filePath: string, cachePath: string): void {
  cacheForStaticAsset(cachePath, res);
  res.sendFile(filePath, (error) => {
    if (!error) return;
    if (!res.headersSent) sendNotFound(res);
    else res.end();
  });
}

async function sendRouteWithMetadata(req: Request, res: Response, root: string, publicOrigin?: string): Promise<void> {
  const route = normalizePublicWebRoute(req.path);
  if (!route) {
    sendNotFound(res, true);
    return;
  }

  const filePath = staticFilePath(root, `/${PUBLIC_WEB_ROUTE_FILES[route]}`);
  if (!filePath) {
    sendNotFound(res, true);
    return;
  }

  try {
    const { readFile } = await import("node:fs/promises");
    const html = await readFile(filePath, "utf8");
    if (PRIVATE_WEB_PATH.test(route)) noStore(res);
    else noCache(res);
    res.type("html").send(injectRouteMetadata(html, route, publicOrigin));
  } catch {
    sendNotFound(res, true);
  }
}

/**
 * Serves only named public pages and declared public assets. This intentionally does not provide
 * a SPA catch-all: missing API routes, assets, and internal/dev routes remain real 404s.
 */
export function registerProductionWeb(app: Express, options: ProductionWebOptions = {}): void {
  const staticDir = options.staticDir ?? resolve(process.cwd(), "web-dist");

  app.use((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendNotFound(res);
      return;
    }

    const pathname = decodedPathname(req.path);
    if (!pathname) {
      sendNotFound(res);
      return;
    }

    if (normalizePublicWebRoute(pathname)) {
      void sendRouteWithMetadata(req, res, staticDir, options.publicOrigin);
      return;
    }

    if (isAllowedStaticAsset(pathname)) {
      const filePath = staticFilePath(staticDir, pathname);
      if (!filePath) {
        sendNotFound(res);
        return;
      }
      sendFile(res, filePath, pathname);
      return;
    }

    sendNotFound(res, !pathname.includes("."));
  });
}

export { HASHED_EXPO_ASSET, PRIVATE_WEB_PATH };
