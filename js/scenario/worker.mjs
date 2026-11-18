import { assess } from "./engine.mjs";
self.onmessage = async ({ data }) => {
  try {
    self.postMessage({
      result: await assess(data.project, data.definition, data.calculationId),
    });
  } catch (e) {
    self.postMessage({
      error: e.message,
      calculationId: data.calculationId,
      inputRevision: data.project.inputRevision,
    });
  }
};
