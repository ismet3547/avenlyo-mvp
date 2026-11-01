import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

test(
  "geliştirme sunucusu geçici Vite dosyaları nedeniyle yeniden başlamaz",
  { timeout: 20000 },
  async () => {
    const dataDir = mkdtempSync(resolve(".test-data-startup-"));
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
