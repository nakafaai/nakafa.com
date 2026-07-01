import { Effect, Ref } from "effect";
import type {
  ForumPostId,
  ViewportRuntime,
} from "@/components/school/classes/forum/conversation/viewport/runtime";

/** Marks the last visible post as read once per observed post id. */
export function markLastVisibleViewportPostRead(
  runtime: ViewportRuntime,
  postId: ForumPostId | null
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
    yield* Effect.forkIn(
      runtime.adapters.read.markPostRead(postId).pipe(
        Effect.catchTag("ViewportReadError", () =>
          Ref.update(runtime.lastReadPostIdRef, (currentPostId) => {
            if (currentPostId === postId) {
              return null;
            }

            return currentPostId;
          })
        )
      ),
      runtime.scope
    );
  });
}
