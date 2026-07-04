import { Effect, Ref } from "effect";
import type {
  ForumPostId,
  ViewportRuntime,
} from "@/components/school/classes/forum/conversation/viewport/runtime";

/** Read-sync fiber lifetime relative to the open viewport service. */
export type ViewportReadSyncLifetime = "viewport" | "detached";

/** Marks the last visible post as read once per observed post id. */
export function markLastVisibleViewportPostRead(
  runtime: ViewportRuntime,
  postId: ForumPostId | null,
  options: { readonly lifetime?: ViewportReadSyncLifetime } = {}
) {
  if (!postId) {
    return Effect.void;
  }

  return Effect.gen(function* () {
    const lastReadPostId = yield* Ref.get(runtime.lastReadPostIdRef);

    if (lastReadPostId === postId) {
      return;
    }

    yield* Ref.set(runtime.lastReadPostIdRef, postId);
    const readSync = runtime.adapters.read.markPostRead(postId).pipe(
      Effect.catchTag("ViewportReadError", () =>
        Ref.update(runtime.lastReadPostIdRef, (currentPostId) => {
          if (currentPostId === postId) {
            return null;
          }

          return currentPostId;
        })
      )
    );

    if (options.lifetime === "detached") {
      yield* Effect.forkDaemon(readSync);
      return;
    }

    yield* Effect.forkIn(readSync, runtime.scope);
  });
}
