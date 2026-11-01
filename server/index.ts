import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createApp } from "./app.js";
import { Store } from "./store.js";
import { Config } from "./config.js";

for (const file of [".env", ".env.local"])
  if (existsSync(file)) process.loadEnvFile(file);
const dataDir = resolve(process.env.AVENLYO_DATA_DIR || "data");
const store = new Store(resolve(dataDir, "avenlyo.sqlite"));
const app = createApp(store, new Config(dataDir));
const production = process.argv.includes("--production");
if (production) {
  const { default: express } = await import("express");
  if (!existsSync("dist/index.html"))
    throw new Error("Önce npm run build komutunu çalıştırın.");
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    // Bundled configs are temporary imports. Removing them triggers Node's
    // module watcher and otherwise restarts this process indefinitely.
    configLoader: "runner",
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 3000),
  host = process.env.HOST || "127.0.0.1";
const server = app.listen(port, host, () => {
  const address = server.address();
  const listeningPort =
    address && typeof address === "object" ? address.port : port;
  console.log(
    `\n  Avenlyo hazır → http://${host === "0.0.0.0" ? "localhost" : host}:${listeningPort}\n`,
  );
});
function shutdown() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
