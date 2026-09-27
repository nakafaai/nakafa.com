import type { tryoutStartAccessValidator } from "@repo/backend/confect/tryouts/start/spec";
import type { Schema } from "effect";
export const anonymousStartAccess: Schema.Schema.Type<
  typeof tryoutStartAccessValidator
> = {
  kind: "free-attempt",
};
