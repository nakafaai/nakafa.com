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

    yield* Effect.forkIn(
      runtime.adapters.read.markPostRead(postId).pipe(
        Effect.zipRight(Ref.set(runtime.lastReadPostIdRef, postId)),
        Effect.catchTag("ViewportReadError", () => Effect.void)
      ),
      runtime.scope
    );
  });
}
