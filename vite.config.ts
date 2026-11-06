import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    hmr: false,
    ws: false,
    cors: false,
    fs: {
      allow: ["index.html", "shared.ts", "src", "node_modules"].map((path) =>
        resolve(path),
      ),
      deny: [
        ".env",
        ".env.*",
        "*.{crt,pem,key}",
        "**/.git/**",
        "**/settings.json",
        "**/settings.json.tmp",
        "**/*.sqlite{,-wal,-shm}",
      ],
    },
  },
  build: { outDir: "dist" },
});
