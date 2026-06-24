import { api as convexApi } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { MathPersistenceError } from "@repo/math/reason/errors";
import type {
  MathWorkPersistenceMetadata,
  MathWorkRepository,
} from "@repo/math/reason/repo";
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
