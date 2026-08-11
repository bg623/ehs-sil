import assert from "node:assert/strict";
import fs from "node:fs";

const files = ["css/style.css", "css/product.css", "css/tools.css", "css/compliance.css"];
const expected = {
  "color-text": "#17211e",
  "color-bg": "#f5f7f5",
  "color-primary": "#0d473f",
  "color-primary-hover": "#083a34",
  "color-accent": "#d7a23a",
  "color-accent-text": "#805810",
  "color-border": "#dce4e0",
};

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function variable(css, name) {
  return css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1].toLowerCase();
}

function luminance(hex) {
  const values = hex
    .slice(1)
    .match(/.{2}/g)
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}

function contrast(first, second) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const tokens = read("css/design-system.css");
for (const [name, value] of Object.entries(expected)) {
  assert.equal(variable(tokens, name), value, `design-system.css 的 ${name} 色彩角色不一致`);
}
for (const file of files) {
  assert.match(read(file), /@import url\("\.\/design-system\.css"\);/, `${file} 未引用集中设计变量`);
}

const ratios = {
  text_on_background: contrast(expected["color-text"], expected["color-bg"]),
  primary_on_background: contrast(expected["color-primary"], expected["color-bg"]),
  white_on_primary: contrast("#ffffff", expected["color-primary"]),
  accent_text_on_background: contrast(expected["color-accent-text"], expected["color-bg"]),
  white_on_accent_text: contrast("#ffffff", expected["color-accent-text"]),
};

assert.ok(ratios.text_on_background >= 7);
assert.ok(ratios.primary_on_background >= 7);
assert.ok(ratios.white_on_primary >= 7);
assert.ok(ratios.accent_text_on_background >= 4.5);
assert.ok(ratios.white_on_accent_text >= 4.5);

console.log(
  JSON.stringify({
    status: "PASS",
    ratios: Object.fromEntries(
      Object.entries(ratios).map(([name, value]) => [name, value.toFixed(2)]),
    ),
  }),
);
