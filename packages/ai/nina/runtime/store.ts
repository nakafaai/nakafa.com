import type { CapabilityTrace } from "@repo/ai/nina/capability/spec";
import type { NinaContextPack } from "@repo/ai/nina/memory/pack";
import type { LearningArtifactWrite } from "@repo/ai/schema/artifact";
import type { MyUIMessage } from "@repo/ai/types/message";
import { Context, type Effect, Schema } from "effect";

/** Raised when the app-owned chat persistence adapter fails during a Nina turn. */
export class NinaStoreError extends Schema.TaggedError<NinaStoreError>()(
  "NinaStoreError",
  {
    message: Schema.String,
    source: Schema.String,
  }
) {}

/**
 * Request-scoped persistence seam used by NinaHarness.
 *
 * The app owns Convex deployment details and binds them into this service at
 * the route boundary; the harness owns when stream lifecycle events persist.
 */
export class NinaStore extends Context.Tag("NinaStore")<
  NinaStore,
  {
    readonly loadMessages: () => Effect.Effect<MyUIMessage[], NinaStoreError>;
    readonly saveAssistant: (input: {
      readonly artifacts?: readonly LearningArtifactWrite[];
      readonly context: NinaContextPack;
      readonly responseMessage: MyUIMessage;
    }) => Effect.Effect<void, NinaStoreError>;
    readonly saveFailure: (input: {
      readonly responseMessageId: string;
    }) => Effect.Effect<void, NinaStoreError>;
    readonly saveTrace: (
      input: CapabilityTrace
    ) => Effect.Effect<void, NinaStoreError>;
    readonly saveTitle: (input: {
      readonly messages: MyUIMessage[];
    }) => Effect.Effect<void, NinaStoreError>;
  }
>() {}
