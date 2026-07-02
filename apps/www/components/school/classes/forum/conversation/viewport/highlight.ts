import { Effect, Fiber, Queue, Ref } from "effect";
import {
  type ForumPostId,
  HIGHLIGHT_DURATION_MS,
  type ViewportRuntime,
} from "@/components/school/classes/forum/conversation/viewport/runtime";
import { updateViewportState } from "@/components/school/classes/forum/conversation/viewport/state";

/** Highlights one post and schedules highlight expiration. */
export function startViewportHighlight(
  runtime: ViewportRuntime,
  postId: ForumPostId
) {
  return Effect.gen(function* () {
    const currentFiber = yield* Ref.get(runtime.highlightFiberRef);

    if (currentFiber) {
      yield* Fiber.interrupt(currentFiber);
    }

    yield* updateViewportState(runtime, (state) => ({
      ...state,
      highlightedPostId: postId,
    }));
    const token = yield* Ref.updateAndGet(
      runtime.highlightTokenRef,
      (currentToken) => currentToken + 1
    );

    const fiber = yield* Effect.forkIn(
      runtime.adapters.timer.sleep(HIGHLIGHT_DURATION_MS).pipe(
        Effect.zipRight(
          Queue.offer(runtime.eventQueue, {
            token,
            type: "highlight-expired",
          })
        ),
        Effect.asVoid
      ),
      runtime.scope
    );

    yield* Ref.set(runtime.highlightFiberRef, fiber);
  });
}
