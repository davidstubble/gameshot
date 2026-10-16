import { readFile } from "node:fs/promises";
import { createContext, Script } from "node:vm";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const projectRoot = join(__dirname, "..");

type FetchEventDouble = {
  request: { url: string; method: string; mode: string };
  respondWith: ReturnType<typeof vi.fn>;
  waitUntil: ReturnType<typeof vi.fn>;
};

async function serviceWorkerFetchHandler() {
  const source = await readFile(join(projectRoot, "public", "service-worker.js"), "utf8");
  const listeners = new Map<string, (event: FetchEventDouble) => void>();
  const cache = {
    addAll: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
  };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    match: vi.fn().mockResolvedValue(undefined),
    keys: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(true),
  };
  const networkResponse = {
    ok: true,
    type: "basic",
    clone: () => networkResponse,
  };
  const context = createContext({
    URL,
    Promise,
    caches,
    fetch: vi.fn().mockResolvedValue(networkResponse),
    self: {
      location: { origin: "https://app.example.test" },
      addEventListener: (name: string, listener: (event: FetchEventDouble) => void) => listeners.set(name, listener),
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn() },
    },
  });
  new Script(source).runInContext(context);
  const handler = listeners.get("fetch");
  if (!handler) throw new Error("Service worker did not register a fetch handler.");
  return handler;
}

function fetchEvent(pathname: string, mode = "cors"): FetchEventDouble {
  return {
    request: {
      url: `https://app.example.test${pathname}`,
      method: "GET",
      mode,
    },
    respondWith: vi.fn(),
    waitUntil: vi.fn(),
  };
}

describe("Windows-ready PWA assets", () => {
  it("declares an owned standalone manifest with existing-logo icon sizes", async () => {
    const manifest = JSON.parse(await readFile(join(projectRoot, "public", "manifest.webmanifest"), "utf8")) as {
      start_url: string;
      scope: string;
      display: string;
      icons: Array<{ src: string; sizes: string; type: string }>;
    };

    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons).toEqual([
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ]);
  });

  it("never intercepts account, payment, history, export, user-image, API, or cross-origin requests", async () => {
    const handler = await serviceWorkerFetchHandler();
    for (const pathname of [
      "/api/billing/status",
      "/auth/session",
      "/oauth/callback",
      "/checkout/session",
      "/pro",
      "/history",
      "/exports",
      "/export/download",
      "/user-image/abc.png",
    ]) {
      const event = fetchEvent(pathname, "navigate");
      handler(event);
      expect(event.respondWith).not.toHaveBeenCalled();
    }

    const crossOrigin: FetchEventDouble = {
      ...fetchEvent("/asset.js"),
      request: { url: "https://cdn.example.test/asset.js", method: "GET", mode: "cors" },
    };
    handler(crossOrigin);
    expect(crossOrigin.respondWith).not.toHaveBeenCalled();
  });

  it("handles only the root shell and immutable hashed Expo assets", async () => {
    const handler = await serviceWorkerFetchHandler();
    const root = fetchEvent("/", "navigate");
    const immutable = fetchEvent("/_expo/static/js/web/entry-0123456789abcdef.js");
    const arbitraryAsset = fetchEvent("/images/user-upload.png");

    handler(root);
    handler(immutable);
    handler(arbitraryAsset);

    expect(root.respondWith).toHaveBeenCalledOnce();
    expect(immutable.respondWith).toHaveBeenCalledOnce();
    expect(arbitraryAsset.respondWith).not.toHaveBeenCalled();
  });
});
