import { encodeMaterialContextHint } from "@repo/contents/_types/route/material/context";
import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";

export const learningContextModeValues = [
  "canonical",
  "placement",
  "session",
  "memory-assisted",
] as const;

const learningContextModeValidator = literals(...learningContextModeValues);

export const learningContextInputModeValues = [
  "placement",
  "session",
  "memory-assisted",
] as const;

const learningContextInputModeValidator = literals(
  ...learningContextInputModeValues
);

/**
 * Optional client-provided learning context hint.
 *
 * The backend verifies these fields against durable route rows before storing
 * them. Missing or invalid hints become canonical context.
 */
export const learningContextInputValidator = v.object({
  mode: learningContextInputModeValidator,
  nodeKey: v.optional(v.string()),
  programKey: v.optional(v.string()),
});

/**
 * Persisted learning-context projection shared by views, recents, and counters.
 *
 * `contextKey` is the indexed grouping key. The other fields preserve only
 * verified source identity, never display text or invented curriculum labels.
 */
export const learningContextStorageFields = {
  contextKey: v.string(),
  contextMaterialKey: v.optional(v.string()),
  contextMode: learningContextModeValidator,
  contextNodeKey: v.optional(v.string()),
  contextParentPath: v.optional(v.string()),
  contextProgramKey: v.optional(v.string()),
  contextPublicPath: v.optional(v.string()),
  contextSourcePath: v.optional(v.string()),
};

export const learningContextStorageValidator = v.object(
  learningContextStorageFields
);

export type LearningContextInput = Infer<typeof learningContextInputValidator>;
export type LearningContextStorage = Infer<
  typeof learningContextStorageValidator
>;

/** Returns the storage projection for a canonical asset visit. */
export function createCanonicalLearningContext(): LearningContextStorage {
  return {
    contextKey: "canonical",
    contextMode: "canonical",
  };
}

/** Returns the stable grouping key for a verified placement context. */
export function createContextKey(input: {
  readonly mode: Exclude<LearningContextStorage["contextMode"], "canonical">;
  readonly nodeKey: string;
  readonly programKey: string;
}) {
  return `${input.mode}:${input.programKey}:${input.nodeKey}`;
}

/** Encodes verified context storage as an optional material URL query string. */
export function toLearningContextQuery(context: LearningContextStorage) {
  if (context.contextMode === "canonical") {
    return "";
  }

  if (!(context.contextProgramKey && context.contextNodeKey)) {
    return "";
  }

  return `?ctx=${encodeMaterialContextHint({
    nodeKey: context.contextNodeKey,
    programKey: context.contextProgramKey,
  })}`;
}
