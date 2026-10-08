import type { tryoutStartAccessValidator } from "@repo/backend/confect/tryouts/start/spec";
export const anonymousStartAccess: typeof tryoutStartAccessValidator.Type = {
  kind: "free-attempt",
};
