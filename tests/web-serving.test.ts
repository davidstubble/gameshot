import express from "express";
import { createServer, type Server } from "node:http";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../server/_core/index";

describe("production web serving", () => {
  let server: Server;
  let origin: string;
  let staticDir: string;

  beforeEach(async () => {
    staticDir = await mkdtemp(join(tmpdir(), "gameshot-web-"));
    await mkdir(join(staticDir, "oauth"), { recursive: true });
    await mkdir(join(staticDir, "_expo", "static", "js", "web"), { recursive: true });
    await mkdir(join(staticDir, "icons"), { recursive: true });
    await mkdir(join(staticDir, "dev"), { recursive: true });
    await mkdir(join(staticDir, "assets", "node_modules", "icons"), { recursive: true });
    await mkdir(join(staticDir, "app"), { recursive: true });
    const shell = "<!doctype html><html><head><title>old title</title><meta name=\"description\" content=\"old description\"></head><body><div id=\"root\">GameShot shell</div></body></html>";
    await Promise.all([
      writeFile(join(staticDir, "index.html"), shell),
      writeFile(join(staticDir, "app", "crop.html"), shell),
      writeFile(join(staticDir, "app", "image.html"), shell),
      writeFile(join(staticDir, "app", "layout.html"), shell),
      writeFile(join(staticDir, "app", "gift-rush.html"), shell),
      writeFile(join(staticDir, "app", "foundry.html"), shell),
      writeFile(join(staticDir, "exports.html"), shell),
      writeFile(join(staticDir, "pro.html"), shell),
      writeFile(join(staticDir, "oauth", "callback.html"), shell),
      writeFile(join(staticDir, "_expo", "static", "js", "web", "entry-0123456789abcdef.js"), "console.log('asset')"),
      writeFile(join(staticDir, "icons", "icon-512.png"), "png"),
      writeFile(join(staticDir, "dev", "theme-lab.html"), shell),
      writeFile(join(staticDir, "assets", "node_modules", "icons", "Ionicons.0123456789abcdef.ttf"), "font fixture"),
    ]);

    const app = createApp({
      production: true,
      staticDir,
      publicOrigin: "https://app.example.test",
    });
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test address");
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  it("serves known named routes with route-specific initial metadata", async () => {
    const response = await fetch(`${origin}/pro`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(html).toContain("<title>GameShot LABS pricing — Workflow packs and studio bundle</title>");
    expect(html).toContain('property="og:title" content="GameShot LABS pricing — Workflow packs and studio bundle"');
    expect(html).toContain('property="og:site_name" content="GameShot LABS"');
    expect(html).toContain('rel="canonical" href="https://app.example.test/pro"');
    expect(html).toContain('property="og:image" content="https://app.example.test/icons/icon-512.png"');
    expect(html).not.toContain("old title");
  });

  it("serves each studio route with its own title and a real missing-route 404", async () => {
    for (const [path, title] of [
      ["/", "GameShot LABS — Local-first image studio"],
      ["/app/crop", "Crop Lab — GameShot LABS"],
      ["/app/image", "Image Lab — Resize and convert | GameShot LABS"],
      ["/app/layout", "Layout Lab — Ordered PDF and contact sheets | GameShot LABS"],
      ["/app/gift-rush", "Gift Rush — Virtual-credit reveal game | GameShot LABS"],
      ["/app/foundry", "GameShot Foundry — Buildable app and tool blueprints"],
    ]) {
      const response = await fetch(`${origin}${path}`);
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain(`<title>${title}</title>`);
      expect(html).toContain(`rel="canonical" href="https://app.example.test${path}"`);
      expect(html).not.toContain("old title");
    }
    expect((await fetch(`${origin}/app/missing-lab`)).status).toBe(404);
  });

  it("marks callback and missing pages noindex without exposing dev routes", async () => {
    const callback = await fetch(`${origin}/oauth/callback?code=private-code`);
    const callbackHtml = await callback.text();
    const missingRoute = await fetch(`${origin}/not-a-route`);
    const missingHtml = await missingRoute.text();
    const devRoute = await fetch(`${origin}/dev/theme-lab`);

    expect(callback.status).toBe(200);
    expect(callback.headers.get("cache-control")).toBe("private, no-store");
    expect(callbackHtml).toContain('name="robots" content="noindex, nofollow, noarchive"');
    expect(callbackHtml).not.toContain("private-code");
    expect(missingRoute.status).toBe(404);
    expect(missingHtml).toContain('name="robots" content="noindex, nofollow"');
    expect(devRoute.status).toBe(404);
  });

  it("keeps missing API and assets as 404s instead of returning the app shell", async () => {
    const [api, asset, validAsset] = await Promise.all([
      fetch(`${origin}/api/not-a-real-endpoint`),
      fetch(`${origin}/missing.css`),
      fetch(`${origin}/_expo/static/js/web/entry-0123456789abcdef.js`),
    ]);

    expect(api.status).toBe(404);
    expect(api.headers.get("cache-control")).toBe("private, no-store");
    expect((await api.json()) as unknown).toEqual({ error: "Not found." });
    expect(asset.status).toBe(404);
    expect(await asset.text()).not.toContain("GameShot shell");
    expect(validAsset.status).toBe(200);
    expect(validAsset.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  });

  it("serves the actual dot-fingerprinted Expo font path without exposing missing assets", async () => {
    const font = await fetch(`${origin}/assets/node_modules/icons/Ionicons.0123456789abcdef.ttf`);
    const missing = await fetch(`${origin}/assets/missing.ttf`);
    expect(font.status).toBe(200);
    expect(await font.text()).toBe("font fixture");
    expect(font.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(missing.status).toBe(404);
  });

  it("retains the unauthenticated health route", async () => {
    const response = await fetch(`${origin}/api/health`);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.json() as { ok: boolean }).ok).toBe(true);
  });
});
