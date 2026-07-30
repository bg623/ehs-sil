import assert from "node:assert/strict";
import fs from "node:fs";

const files = ["css/style.css", "css/product.css", "css/tools.css"];
const expected = {
  text: "#263238",
  bg: "#f7f4ee",
  primary: "#123b4a",
  secondary: "#dce9e7",
  accent: "#96630b",
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

for (const file of files) {
  const css = read(file);
  for (const [name, value] of Object.entries(expected)) {
    assert.equal(variable(css, name), value, `${file} 的 ${name} 色彩角色不一致`);
  }
}

const ratios = {
  text_on_background: contrast(expected.text, expected.bg),
  primary_on_background: contrast(expected.primary, expected.bg),
  white_on_primary: contrast("#ffffff", expected.primary),
  accent_on_background: contrast(expected.accent, expected.bg),
  white_on_accent: contrast("#ffffff", expected.accent),
  primary_on_secondary: contrast(expected.primary, expected.secondary),
};

assert.ok(ratios.text_on_background >= 7);
assert.ok(ratios.primary_on_background >= 7);
assert.ok(ratios.white_on_primary >= 7);
assert.ok(ratios.accent_on_background >= 4.5);
assert.ok(ratios.white_on_accent >= 4.5);
assert.ok(ratios.primary_on_secondary >= 7);

console.log(
  JSON.stringify({
    status: "PASS",
    ratios: Object.fromEntries(
      Object.entries(ratios).map(([name, value]) => [name, value.toFixed(2)]),
    ),
  }),
);
