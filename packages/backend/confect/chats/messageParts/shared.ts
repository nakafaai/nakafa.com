import type { Docs } from "@repo/backend/confect/_generated/docs";
import { ConvexError } from "convex/values";
import { Predicate } from "effect";
export type DBPart = Omit<
  Docs["messageParts"],
  "_id" | "_creationTime" | "messageId"
>;

/** Validate that one persisted part field exists before reconstructing UI data. */
export function requirePartField<T>({
  value,
  fieldName,
  partType,
}: {
  value: T;
  fieldName: keyof Docs["messageParts"];
  partType: Docs["messageParts"]["type"];
}): Exclude<T, undefined> {
  if (Predicate.isNotUndefined(value)) {
    return value;
  }
  throw new ConvexError({
    code: "CHAT_PART_FIELD_MISSING",
    message: `Required field '${fieldName}' is missing for part type '${partType}'.`,
  });
}

/** Require the persisted tool state before rebuilding one tool UI part. */
export function requireToolState(part: Docs["messageParts"]) {
  return requirePartField({
    value: part.toolState,
    fieldName: "toolState",
    partType: part.type,
  });
}
