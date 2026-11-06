import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

test(
  "geliştirme sunucusu geçici Vite dosyaları nedeniyle yeniden başlamaz",
  { timeout: 20000 },
  async () => {
    const dataDir = mkdtempSync(resolve(".test-data-startup-"));
    const marker = "sk-fixture-that-must-stay-on-disk";
    writeFileSync(
      join(dataDir, "settings.json"),
      JSON.stringify({ apiKey: marker }),
    );
    const child = spawn(
      process.execPath,
      ["--watch", "--import", "tsx", "server/index.ts"],
      {
        cwd: resolve("."),
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          OPENAI_API_KEY: "",
          HOST: "127.0.0.1",
          PORT: "0",
          AVENLYO_DATA_DIR: dataDir,
        },
      },
    );
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    const closed = once(child, "close");
    try {
      const startedAt = Date.now();
      while (!/Avenlyo hazır → http:\/\/127\.0\.0\.1:\d+/.test(output)) {
        assert.equal(child.exitCode, null, output);
        assert.ok(
          Date.now() - startedAt < 10000,
          `Sunucu hazır olmadı:\n${output}`,
        );
        await delay(50);
      }
      const url = output.match(
        /Avenlyo hazır → (http:\/\/127\.0\.0\.1:\d+)/,
      )![1];
      const response = await fetch(`${url}/api/health`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true });
      const page = await fetch(url);
      assert.equal(page.status, 200);
      assert.match(await page.text(), /Avenlyo/);
      const entry = await fetch(url + "/src/main.tsx");
      assert.equal(entry.status, 200);
      assert.match(await entry.text(), /Site/);
      const settings = "/" + basename(dataDir) + "/settings.json";
      const sqlite = "/" + basename(dataDir) + "/a1/accounts.sqlite";
      for (const path of [
        settings,
        settings + "?raw",
        sqlite,
        sqlite + "-wal",
        "/server/index.ts?raw",
      ]) {
        const file = await fetch(url + path, {
          headers: { Origin: "http://127.0.0.1:49321" },
        });
        assert.ok(
          file.status === 403 || file.status === 404,
          path + " HTTP " + file.status,
        );
        assert.equal(file.headers.get("access-control-allow-origin"), null);
        assert.ok(!(await file.text()).includes(marker));
      }
      // The broken config restarts within a second of reporting readiness.
      await delay(1800);
      assert.equal(child.exitCode, null, output);
      assert.doesNotMatch(output, /Restarting|Change detected/, output);
      assert.equal((output.match(/Avenlyo hazır/g) || []).length, 1, output);
    } finally {
      if (child.pid && child.exitCode === null) {
        if (process.platform === "win32") {
          await once(
            spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
              stdio: "ignore",
            }),
            "close",
          );
        } else {
          try {
            process.kill(-child.pid, "SIGTERM");
          } catch {
            /* Already stopped. */
          }
        }
      }
      await closed;
      rmSync(dataDir, { recursive: true, force: true });
    }
  },
);
