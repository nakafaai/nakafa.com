import { Effect, Schema } from "effect";

/** Expected failures owned by the legacy try-out synchronization capability. */
export class TryoutSyncError extends Schema.TaggedError<TryoutSyncError>()(
  "TryoutSyncError",
  {
    code: Schema.Literal(
      "CONTENT_SYNC_BATCH_TOO_LARGE",
      "TRYOUT_SYNC_CHOICE_LIMIT_EXCEEDED",
      "TRYOUT_SYNC_EXAM_HAS_TRACKS",
      "TRYOUT_SYNC_MANAGED",
      "TRYOUT_SYNC_QUESTION_SET_HAS_SECTIONS",
      "TRYOUT_SYNC_QUESTION_SET_NOT_FOUND",
      "TRYOUT_SYNC_QUESTION_SET_NOT_EMPTY",
      "TRYOUT_SYNC_SECTION_DELETE_LIMIT_EXCEEDED",
      "TRYOUT_SYNC_SET_DELETE_LIMIT_EXCEEDED",
      "TRYOUT_SYNC_SET_HAS_SECTIONS",
      "TRYOUT_SYNC_SET_NOT_FOUND",
      "TRYOUT_SYNC_TRACK_DELETE_LIMIT_EXCEEDED",
      "TRYOUT_SYNC_TRACK_HAS_SETS"
    ),
    message: Schema.String,
  }
) {}

/** Creates one typed legacy try-out synchronization failure. */
export function tryoutSyncFail(code: TryoutSyncError["code"], message: string) {
  return Effect.fail(new TryoutSyncError({ code, message }));
}

/** Validates one bounded legacy try-out synchronization input. */
export function validateTryoutBatch(args: {
  functionName: string;
  limit: number;
  received: number;
  unit: string;
}) {
  if (args.received <= args.limit) {
    return Effect.void;
  }

  return tryoutSyncFail(
    "CONTENT_SYNC_BATCH_TOO_LARGE",
    `${args.functionName} received ${args.received} ${args.unit}, which exceeds the safe limit of ${args.limit}.`
  );
}
