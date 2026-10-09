import { encodeMaterialContextHint } from "@repo/contents/route/material/context";
import { Schema } from "effect";

const learningContextModeValues = ["canonical", "placement"] as const;
const learningContextModeValidator = Schema.Literals([
  ...learningContextModeValues,
]);
const learningContextInputModeValues = ["placement"] as const;
const learningContextInputModeValidator = Schema.Literals([
  ...learningContextInputModeValues,
]);

/**
 * Optional client-provided learning context hint.
 *
 * The backend verifies these fields against durable route rows before storing
 * them. Missing or invalid hints become canonical context.
 */
export const learningContextInputValidator = Schema.Struct({
  mode: learningContextInputModeValidator,
  nodeKey: Schema.optionalKey(Schema.String),
  programKey: Schema.optionalKey(Schema.String),
});

/**
 * Persisted learning-context projection shared by views, recents, and counters.
 *
 * `contextKey` is the indexed grouping key. The other fields preserve only
 * verified source identity, never display text or invented curriculum labels.
 */
export const learningContextStorageFields = {
  contextKey: Schema.String,
  contextMaterialKey: Schema.optionalKey(Schema.String),
  contextMode: learningContextModeValidator,
  contextNodeKey: Schema.optionalKey(Schema.String),
  contextParentPath: Schema.optionalKey(Schema.String),
  contextProgramKey: Schema.optionalKey(Schema.String),
  contextPublicPath: Schema.optionalKey(Schema.String),
  contextSourcePath: Schema.optionalKey(Schema.String),
};

/** Persisted material/question context fields attached to engagement rows. */
const learningContextStorageValidator = Schema.Struct(
  learningContextStorageFields
);
export type LearningContextInput = typeof learningContextInputValidator.Type;
export type LearningContextStorage =
  typeof learningContextStorageValidator.Type;

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
