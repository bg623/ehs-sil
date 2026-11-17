import test from "node:test";
import assert from "node:assert/strict";
import { newProject, clone } from "../js/scenario/schema.mjs";
import { load, save, clear, STORAGE_KEY, ORIGINAL_V011_KEY } from "../js/scenario/storage.mjs";

function originalRaw() {
  const p = newProject();
  for (const key of ["quality", "cutaway", "pressureAux", "labelDetail"]) delete p.ui[key];
  delete p.inputs.scenario.conditions.confined;
  p.meta.title = "V0.1.1原始草稿";
  const frozen = clone(p);
  frozen.meta.title = "原冻结方案A";
  p.comparison = { project: frozen, modelVersion: "0.1.0", dataVersion: "scenario-data-0.1.1", inputRevision: 1 };
  return "\uFEFF" + JSON.stringify(p, null, 3) + "\n";
}
function memoryStorage(raw, denyOriginal = false) {
  const values = new Map([[STORAGE_KEY, raw]]), writes = [];
  return {
    values, writes,
    getItem: key => values.get(key) ?? null,
    setItem(key, value) {
      writes.push(key);
      if (denyOriginal && key === ORIGINAL_V011_KEY) throw Error("QuotaExceededError");
      values.set(key, value);
    },
    removeItem: key => values.delete(key),
  };
}

test("V020 preserves complete V011 v2 bytes once, including frozen A, and clear retains recovery copy", () => {
  const raw = originalRaw(), storage = memoryStorage(raw), loaded = load(storage);
  assert.equal(loaded.status, "loaded");
  assert.equal(loaded.writeBlocked, false);
  assert.equal(loaded.originalV011Preserved, true);
  assert.equal(storage.getItem(ORIGINAL_V011_KEY), raw);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  assert.equal(loaded.project.comparison.project.meta.title, "原冻结方案A");
  assert.equal(loaded.project.comparison.project.ui.quality, "balanced");
  loaded.project.meta.title = "新版编辑";
  assert.equal(save(storage, loaded.project).status, "saved");
  assert.equal(storage.getItem(ORIGINAL_V011_KEY), raw);
  // Even a later old-format draft cannot overwrite the first recovery copy.
  storage.values.set(STORAGE_KEY, raw.replace("V0.1.1原始草稿", "另一个旧草稿"));
  assert.equal(load(storage).writeBlocked, false);
  assert.equal(storage.getItem(ORIGINAL_V011_KEY), raw);
  assert.equal(storage.writes.filter(key => key === ORIGINAL_V011_KEY).length, 1);
  clear(storage);
  assert.equal(storage.getItem(STORAGE_KEY), null);
  assert.equal(storage.getItem(ORIGINAL_V011_KEY), raw);
});

test("V020 backup quota failure returns editable project but blocks every old v2 overwrite", () => {
  const raw = originalRaw(), storage = memoryStorage(raw, true), loaded = load(storage);
  assert.equal(loaded.status, "loaded");
  assert.equal(loaded.writeBlocked, true);
  assert.equal(loaded.originalV011Raw, raw);
  assert.equal(loaded.project.ui.quality, "balanced");
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  assert.equal(storage.getItem(ORIGINAL_V011_KEY), null);
  loaded.project.meta.title = "仍可导出的内存草稿";
  const saved = save(storage, loaded.project);
  assert.equal(saved.status, "failed");
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  assert.equal(storage.writes.includes(STORAGE_KEY), false);
  assert.throws(() => clear(storage), /QuotaExceededError/);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});
