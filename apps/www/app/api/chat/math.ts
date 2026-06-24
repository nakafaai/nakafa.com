import { api as convexApi } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { CasEngine } from "@repo/math/cas/engine";
import {
  MathCasAdapterError,
  MathPersistenceError,
  MathPlanningError,
  MathReasoningInputError,
} from "@repo/math/reason/errors";
import type {
  MathWorkPersistenceMetadata,
  MathWorkRepository,
} from "@repo/math/reason/repo";
import { MathWorkRepository as MathWorkRepositoryTag } from "@repo/math/reason/repo";
import { MathReasoning } from "@repo/math/reason/service";
import { MathWorkResult } from "@repo/math/schema/work";
import { fetchMutation } from "convex/nextjs";
import type { Context } from "effect";
import { Effect, Schema } from "effect";

/** Creates the Convex-backed repository Adapter for one chat stream. */
export function createMathWorkRepository({
  chatId,
  token,
}: {
  readonly chatId: Id<"chats">;
  readonly token: string;
}): Context.Tag.Service<typeof MathWorkRepository> {
  return {
    save: (result, metadata) =>
      Schema.encode(MathWorkResult)(result).pipe(
        Effect.mapError(
          (error) =>
            new MathPersistenceError({
              message: error.message,
              source: "mathWork.encode",
            })
        ),
        Effect.flatMap((encoded) =>
          saveMathWork({
            chatId,
            metadata,
            result: encoded,
            token,
          })
        )
      ),
  };
}

/** Creates the live MathReasoning Adapter with CAS config deferred to math use. */
export function createMathReasoningService({
  chatId,
  token,
}: {
  readonly chatId: Id<"chats">;
  readonly token: string;
}): Context.Tag.Service<typeof MathReasoning> {
  const repository = createMathWorkRepository({ chatId, token });

  return MathReasoning.make({
    produceWork: (input) =>
      MathReasoning.produceWork(input).pipe(
        Effect.provide(MathReasoning.Default),
        Effect.provide(CasEngine.Default),
        Effect.provideService(MathWorkRepositoryTag, repository),
        Effect.mapError(mapMathReasoningServiceError)
      ),
  });
}

/** Maps app Adapter setup failures into the public MathReasoning error union. */
function mapMathReasoningServiceError(
  error:
    | MathCasAdapterError
    | MathPersistenceError
    | MathPlanningError
    | MathReasoningInputError
    | unknown
) {
  if (
    error instanceof MathCasAdapterError ||
    error instanceof MathPersistenceError ||
    error instanceof MathPlanningError ||
    error instanceof MathReasoningInputError
  ) {
    return error;
  }

  return new MathCasAdapterError({
    message: "MathReasoning CAS configuration is unavailable.",
  });
}

/** Persists one encoded MathWork result through the authenticated Convex API. */
function saveMathWork({
  chatId,
  metadata,
  result,
  token,
}: {
  readonly chatId: Id<"chats">;
  readonly metadata: MathWorkPersistenceMetadata;
  readonly result: Schema.Schema.Encoded<typeof MathWorkResult>;
  readonly token: string;
}) {
  return Effect.tryPromise({
    try: () =>
      fetchMutation(
        convexApi.math.mutations.save,
        {
          chatId,
          result,
          ...(metadata.responseMessageIdentifier
            ? { responseMessageIdentifier: metadata.responseMessageIdentifier }
            : {}),
          ...(metadata.toolCallId ? { toolCallId: metadata.toolCallId } : {}),
        },
        { token }
      ),
    catch: () =>
      new MathPersistenceError({
        message: "Unable to persist normalized MathWork evidence.",
        source: "mathWork.convex",
      }),
  }).pipe(Effect.asVoid);
}
