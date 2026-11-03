import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");
const tokens = new Map(
  Array.from(css.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g), (match) => [
    match[1],
    match[2].trim(),
  ]),
);

function tokenValue(value: string): string {
  const token = value.match(/^var\(--([a-z0-9-]+)\)$/);
  if (!token) return value;
  const resolved = tokens.get(token[1]);
  assert.ok(resolved, `Eksik tasarım değişkeni: ${value}`);
  return tokenValue(resolved);
}

test("tüm responsive kurallarda metin en az 14px, temel metin en az 16px", () => {
  const declarations = Array.from(
    css.matchAll(/font-size:\s*([^;]+);/g),
    (match) => tokenValue(match[1].trim()),
  );
  assert.ok(
    declarations.length > 40,
    "Tüm ekran ve bileşenlerin tipografi kuralları taranmalı.",
  );
  function pixels(value: string) {
    const size = value.match(/^([\d.]+)(rem|px|%)$/);
    assert.ok(size, `Bilinmeyen font ölçüsü kontrol edilmeli: ${value}`);
    return (
      Number(size[1]) * (size[2] === "rem" ? 16 : size[2] === "%" ? 0.16 : 1)
    );
  }
  assert.ok(pixels(tokenValue("var(--text-base)")) >= 16);
  for (const value of declarations)
    assert.ok(pixels(value) >= 14, `Okunamayacak kadar küçük metin: ${value}`);
});

function luminance(color: string) {
  assert.match(color, /^#[0-9a-f]{6}$/i);
  const rgb = [1, 3, 5].map(
    (index) => parseInt(color.slice(index, index + 2), 16) / 255,
  );
  const linear = rgb.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contrast(foreground: string, background: string) {
  const values = [
    luminance(tokenValue(`var(--${foreground})`)),
    luminance(tokenValue(`var(--${background})`)),
  ].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("metin paleti 4.5:1, kontrol sınırları en az 3:1 kontrast sağlar", () => {
  const textPairs: [string, string][] = [];
  for (const background of ["surface", "canvas", "selected"]) {
    for (const foreground of ["text", "secondary", "muted", "link"])
      textPairs.push([foreground, background]);
  }
  textPairs.push(
    ["surface", "primary"],
    ["surface", "primary-hover"],
    ["sidebar-text", "navy"],
    ["sidebar-muted", "navy"],
    ["sidebar-text", "sidebar-active"],
    ["hero-text", "hero-start"],
    ["hero-text", "hero-end"],
    ["hero-muted", "hero-start"],
    ["hero-muted", "hero-end"],
    ["success", "success-bg"],
    ["warning", "warning-bg"],
    ["danger", "danger-bg"],
    ["success", "surface"],
    ["warning", "surface"],
    ["danger", "surface"],
  );
  for (const background of [
    "agent-blue",
    "agent-navy",
    "agent-green",
    "agent-amber",
    "agent-slate",
  ])
    textPairs.push(["surface", background]);
  for (const [foreground, background] of textPairs) {
    const ratio = contrast(foreground, background);
    assert.ok(
      ratio >= 4.5,
      `${foreground}/${background}: ${ratio.toFixed(2)}:1`,
    );
  }
  for (const background of ["surface", "canvas"]) {
    assert.ok(
      contrast("control-border", background) >= 3,
      `Kontrol kenarlığı: ${background}`,
    );
    assert.ok(
      contrast("focus", background) >= 3,
      `Odak halkası: ${background}`,
    );
  }
});
