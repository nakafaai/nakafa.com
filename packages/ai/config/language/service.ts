import type { ModelId } from "@repo/ai/config/model";
import type { LanguageModel } from "ai";
import { Context, type Effect, Schema } from "effect";

/** Raised when a configured Nakafa model cannot be resolved for AI SDK calls. */
export class LanguageModelProviderError extends Schema.TaggedError<LanguageModelProviderError>()(
  "LanguageModelProviderError",
  {
    message: Schema.String,
    source: Schema.String,
  }
) {}

/** Effect dependency seam for resolving public Nakafa model IDs to AI SDK models. */
export class LanguageModelProvider extends Context.Tag("LanguageModelProvider")<
  LanguageModelProvider,
  {
    /** Resolves one schema-decoded Nakafa model id to an AI SDK v6 language model. */
    readonly resolve: (
      modelId: ModelId
    ) => Effect.Effect<LanguageModel, LanguageModelProviderError>;
  }
>() {}
