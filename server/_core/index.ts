import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { createCorsMiddleware } from "./cors";
import { clearLegacySessionCookie } from "./cookies";
import { registerBillingRoutes, registerPaymentWebhooks } from "../billing/routes";
import { registerProductionWeb, type ProductionWebOptions } from "../web";

export type ServerOptions = ProductionWebOptions & {
  port?: number;
  production?: boolean;
};

export function createApp(options: ServerOptions = {}) {
  const app = express();

  app.use(createCorsMiddleware());
  app.use(clearLegacySessionCookie());
  // This does not parse request bodies, so Stripe's exact-byte raw webhook handler stays ahead
  // of all body parsers while every API response remains out of browser/shared caches.
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    next();
  });

  registerPaymentWebhooks(app);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerBillingRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found." });
  });

  if (options.production ?? process.env.NODE_ENV === "production") {
    registerProductionWeb(app, options);
  }

  return app;
}

export function startServer(options: ServerOptions = {}) {
  const app = createApp(options);
  const server = createServer(app);
  const port = options.port ?? parseInt(process.env.PORT || "3000", 10);
  server.listen(port, "0.0.0.0", () => {
    console.log("[api] server listening");
  });
  return server;
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && resolve(entry) === fileURLToPath(import.meta.url));
}

if (isMainModule()) {
  const server = startServer();
  server.once("error", () => {
    console.error("[api] server failed to start");
  });
}
