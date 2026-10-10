import { Schema } from "effect";

/** The language model behind every Nakafa call, as the Convex AI gateway names it. */
export const languageModelId = "google/gemini-3.8-flash";

/** Every embedding model the Convex AI gateway served on 10 October 2026, as it names them. */
export const embeddingModels = [
  "google/gemini-embedding-001",
  "google/gemini-embedding-2",
  "openai/text-embedding-3-small",
  "qwen/qwen3-embedding-8b",
] as const;
export const EmbeddingModelId = Schema.Literals(embeddingModels);
export type EmbeddingModelId = typeof EmbeddingModelId.Type;

/**
 * The embedding model behind knowledge search. It is provisional: the model
 * test in `scripts/knowledge` decides, by the share of questions whose right
 * section lands in the top five, per language. Changing this constant changes
 * every stored vector, so the next section build re-embeds all of them.
 */
export const embeddingModelId: EmbeddingModelId = "google/gemini-embedding-2";

/**
 * The length of every stored and every query vector, requested from the model
 * with `dimensions`. The vector index of `contentSections` has the same length,
 * so one length for all candidate models keeps a model change from changing the
 * index. A section takes 768 numbers of 8 bytes.
 */
export const embeddingDimensions = 768;

/** How long one embedding call may run before it counts as a timeout. */
export const embeddingTimeoutMs = 30_000;

/** How much a model reasons: deeply for answers, briefly for supporting work. */
export const Effort = Schema.Literals(["fast", "interactive"]);
export type Effort = typeof Effort.Type;

/** How much the model reasons for each effort. */
export const reasoning = {
  fast: "low",
  interactive: "high",
} satisfies Record<Effort, "low" | "high">;
