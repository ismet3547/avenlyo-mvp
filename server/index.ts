import express from "express";
import { existsSync, mkdirSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { createA1App } from "./a1.js";
import { createApp } from "./app.js";
import { Config } from "./config.js";
import { Store } from "./store.js";

for (const file of [".env", ".env.local"])
  if (existsSync(file)) process.loadEnvFile(file);

const configuredHost = process.env.HOST || "127.0.0.1";
const host = configuredHost === "localhost" ? "127.0.0.1" : configuredHost;
if (host !== "127.0.0.1" && host !== "::1")
  throw new Error(
    "Kapalı test sürümü yalnızca 127.0.0.1 veya ::1 adresinde çalışır.",
  );

function contains(parent: string, child: string) {
  const path = relative(parent, child);
  return (
    path === "" ||
    (!isAbsolute(path) && path !== ".." && !path.startsWith(".." + sep))
  );
}

const dataPath = resolve(process.env.AVENLYO_DATA_DIR || "data");
mkdirSync(dataPath, { recursive: true, mode: 0o700 });
const dataDir = realpathSync(dataPath);
const servedPaths = ["src", "public", "dist", "node_modules"].map((path) =>
  existsSync(path) ? realpathSync(path) : resolve(path),
);
if (
  servedPaths.some((path) => contains(path, dataDir) || contains(dataDir, path))
)
  throw new Error(
    "Veri klasörü, uygulamanın sunulan dosyalarından ayrı olmalıdır.",
  );

const legacy = process.argv.includes("--local-workspace");
const production = process.argv.includes("--production");

function localWorkspace() {
  const store = new Store(resolve(dataDir, "avenlyo.sqlite"));
  return {
    app: createApp(store, new Config(dataDir)),
    close: () => store.close(),
  };
}

const { app, close } = legacy
  ? localWorkspace()
  : createA1App(resolve(dataDir, "a1"));
if (legacy) {
  app.get("/", (_req, res) => res.redirect("/yerel"));
} else {
  app.get("/yerel", (_req, res) => res.redirect("/"));
}

let closeVite: (() => Promise<void>) | undefined;
if (production) {
  if (!existsSync("dist/index.html"))
    throw new Error("Önce npm run build komutunu çalıştırın.");
  app.use(express.static(resolve("dist"), { index: false }));
  app.get(
    legacy
      ? ["/yerel"]
      : [
          "/",
          "/kayit",
          "/giris",
          "/kurtar",
          "/panel",
          "/sohbet/:slug",
          "/gomme/:slug",
        ],
    (_req, res) => res.sendFile(resolve("dist/index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    // The runner avoids temporary config files that restart the Node watcher.
    configLoader: "runner",
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
  closeVite = () => vite.close();
}

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, host, () => {
  const address = server.address();
  const listeningPort =
    address && typeof address === "object" ? address.port : port;
  console.log(
    "\n  Avenlyo hazır → http://" +
      (host === "::1" ? "[::1]" : host) +
      ":" +
      listeningPort +
      "\n",
  );
});
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  server.close(async () => {
    try {
      await closeVite?.();
    } finally {
      close();
      process.exit(0);
    }
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
