import { parseProjectText, validateProject } from "./schema.mjs";
export const LEGACY_KEY = "ehs-sil-scenario-project-v1",
  STORAGE_KEY = "ehs-sil-scenario-project-v2",
  PREVIOUS_KEY = "ehs-sil-scenario-previous-v2";
const CLEARED_KEY = "ehs-sil-scenario-cleared-v2";
export function save(storage, project) {
  try {
    validateProject(project);
    const text = JSON.stringify(project);
    storage.setItem(STORAGE_KEY, text);
    const checked = storage.getItem(STORAGE_KEY);
    if (checked !== text) throw Error("写入后读回不一致");
    parseProjectText(checked);
    return { status: "saved" };
  } catch (e) {
    return { status: "failed", error: e.message };
  }
}
export function load(storage) {
  try {
    const current = storage.getItem(STORAGE_KEY);
    if (current !== null)
      return {
        project: parseProjectText(current),
        status: "loaded",
        sourceKey: STORAGE_KEY,
      };
    if (storage.getItem(CLEARED_KEY) === "1")
      return { project: null, status: "empty" };
    const raw = storage.getItem(LEGACY_KEY);
    if (raw === null) return { project: null, status: "empty" };
    const p = parseProjectText(raw),
      saved = save(storage, p);
    return {
      project: p,
      status: saved.status === "saved" ? "migrated" : "unsaved",
      error: saved.error,
      sourceKey: LEGACY_KEY,
      legacyRaw: raw,
    };
  } catch (e) {
    return { project: null, status: "failed", error: e.message };
  }
}
export function savePrevious(storage, project) {
  try {
    validateProject(project);
    const text = JSON.stringify(project);
    storage.setItem(PREVIOUS_KEY, text);
    if (storage.getItem(PREVIOUS_KEY) !== text) throw Error("备份读回失败");
    return { status: "saved" };
  } catch (e) {
    return { status: "failed", error: e.message };
  }
}
export function loadPrevious(storage) {
  const raw = storage.getItem(PREVIOUS_KEY);
  return raw ? parseProjectText(raw) : null;
}
export function clear(storage) {
  storage.setItem(CLEARED_KEY, "1");
  storage.removeItem(STORAGE_KEY);
  storage.removeItem(PREVIOUS_KEY);
}
