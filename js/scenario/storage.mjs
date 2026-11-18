import { parseProjectText, validateProject } from "./schema.mjs";
export const LEGACY_KEY = "ehs-sil-scenario-project-v1",
  STORAGE_KEY = "ehs-sil-scenario-project-v2",
  PREVIOUS_KEY = "ehs-sil-scenario-previous-v2",
  ORIGINAL_V011_KEY = "ehs-sil-scenario-project-v011-original";
const CLEARED_KEY = "ehs-sil-scenario-cleared-v2";
function preserveOriginalV011(storage, raw) {
  if (raw === null) return false;
  const old = JSON.parse(raw.replace(/^\uFEFF/, ""));
  const legacy = old?.meta?.schemaVersion === "1.1.0" && old.ui &&
    typeof old.ui === "object" && !Array.isArray(old.ui) &&
    (!Object.hasOwn(old.ui, "quality") || !Object.hasOwn(old.ui, "labelDetail"));
  if (!legacy) return false;
  // Preserve the complete original document, including frozen A, only once.
  // A later old draft must never silently replace the first recovery copy.
  const preserved = storage.getItem(ORIGINAL_V011_KEY);
  if (preserved !== null) {
    // Never replace a first backup, but do not trust corrupt bytes as proof
    // that it is safe to overwrite the active legacy document.
    parseProjectText(preserved);
    return true;
  }
  storage.setItem(ORIGINAL_V011_KEY, raw);
  if (storage.getItem(ORIGINAL_V011_KEY) !== raw)
    throw Error("V0.1.1原始草稿备份读回不一致");
  return true;
}
export function save(storage, project) {
  try {
    validateProject(project);
    const text = JSON.stringify(project);
    // Also guard direct save callers: no overwrite of an unprotected old v2.
    preserveOriginalV011(storage, storage.getItem(STORAGE_KEY));
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
    if (current !== null) {
      const project = parseProjectText(current);
      try {
        const originalV011Preserved = preserveOriginalV011(storage, current);
        return {
          project,
          status: "loaded",
          sourceKey: STORAGE_KEY,
          originalV011Preserved,
          writeBlocked: false,
        };
      } catch (error) {
        return {
          project,
          status: "loaded",
          sourceKey: STORAGE_KEY,
          writeBlocked: true,
          originalV011Raw: current,
          error: `原V0.1.1草稿尚未安全备份，已阻止覆盖：${error.message}`,
        };
      }
    }
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
  preserveOriginalV011(storage, storage.getItem(STORAGE_KEY));
  storage.setItem(CLEARED_KEY, "1");
  storage.removeItem(STORAGE_KEY);
  storage.removeItem(PREVIOUS_KEY);
}
