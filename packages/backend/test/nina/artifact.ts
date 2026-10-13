import type { CapabilityArtifact } from "@repo/backend/confect/nina/capability/progress";

/** A source search that is still loading. */
export const loading = {
  type: "data-web-search",
  id: "search-1",
  data: {
    queries: ["limit"],
    sources: [],
    status: "loading",
  },
} satisfies CapabilityArtifact;

/** The same search once it settled with its sources. */
export const done = {
  ...loading,
  data: { ...loading.data, status: "done" },
} satisfies CapabilityArtifact;

/** A second search that settled with an error. */
export const lost = {
  ...loading,
  id: "search-2",
  data: { ...loading.data, status: "error", error: "Unavailable" },
} satisfies CapabilityArtifact;

/** A calculation request. */
export const request = {
  expression: "1 + 1",
  kind: "math",
  operation: "evaluate",
} as const;

const sum = { expression: "2", latex: "2" };

/** A calculation that was verified. */
export const verified = {
  type: "data-math",
  id: "math-1",
  data: {
    input: request,
    kind: "evaluate",
    result: {
      conditions: [],
      input: request,
      items: [],
      kind: "evaluate",
      operation: "evaluate",
      primary: { expression: "1 + 1", latex: "1 + 1" },
      reason: "verified",
      secondary: sum,
      stepStatus: "complete",
      steps: [],
      status: "verified",
    },
    status: "verified",
    summary: "verified",
  },
} satisfies CapabilityArtifact;
