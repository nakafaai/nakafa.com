import { listStreams, syncStreams } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import { QueryCtx } from "@repo/backend/confect/_generated/services";
import type { StreamRequest } from "@repo/backend/confect/nina/contract/message";
import { NinaReadError } from "@repo/backend/confect/nina/messages.spec";
import { Array as Arr, Effect, HashSet, MutableHashMap, pipe } from "effect";

/** Reads active streams or their deltas for one authorized thread. */
export const readStreams = Effect.fn("nina.messages.streams")(function* (
  threadId: string,
  request: typeof StreamRequest.Type
) {
  const ctx = yield* QueryCtx;
  let streamArgs = request;
  if (streamArgs.kind === "deltas") {
    // A cursor is untrusted input. Scope it to this thread before asking the
    // SDK for deltas; expired streams intentionally produce no more chunks.
    const available = yield* Effect.tryPromise({
      try: () =>
        listStreams(ctx, components.nina, {
          threadId,
          includeStatuses: ["streaming", "finished", "aborted"],
        }),
      catch: () =>
        new NinaReadError({ message: "Unable to read Nina streams." }),
    });
    const allowed = HashSet.fromIterable(
      Arr.map(available, (stream) => stream.streamId)
    );
    // A stream keeps its last cursor, in the order the streams first appear.
    const latest = MutableHashMap.fromIterable(
      pipe(
        streamArgs.cursors,
        Arr.filter((cursor) => HashSet.has(allowed, cursor.streamId)),
        Arr.map((cursor) => [cursor.streamId, cursor])
      )
    );
    streamArgs = {
      kind: "deltas",
      cursors: [...MutableHashMap.values(latest)],
    };
  }
  // The SDK answers every stream request; a missing result is a read failure.
  return yield* Effect.tryPromise(() =>
    syncStreams(ctx, components.nina, { threadId, streamArgs })
  ).pipe(
    Effect.flatMap(Effect.fromNullishOr),
    Effect.mapError(
      () => new NinaReadError({ message: "Unable to read Nina streams." })
    )
  );
});
