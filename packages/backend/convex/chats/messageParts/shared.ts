import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { isNotUndefined } from "@repo/backend/convex/utils/type";
import { ConvexError } from "convex/values";

export type DBPart = Omit<Doc<"parts">, "_id" | "_creationTime" | "messageId">;

/** Validate that one persisted part field exists before reconstructing UI data. */
export function requirePartField<T>({
  value,
  fieldName,
  partType,
}: {
  value: T;
  fieldName: keyof Doc<"parts">;
  partType: Doc<"parts">["type"];
}): Exclude<T, undefined> {
  if (isNotUndefined(value)) {
    return value;
  }

  throw new ConvexError({
    code: "CHAT_PART_FIELD_MISSING",
    message: `Required field '${fieldName}' is missing for part type '${partType}'.`,
  });
}

/** Require the persisted tool state before rebuilding one tool UI part. */
export function requireToolState(part: Doc<"parts">) {
  return requirePartField({
    value: part.toolState,
    fieldName: "toolState",
    partType: part.type,
  });
}
