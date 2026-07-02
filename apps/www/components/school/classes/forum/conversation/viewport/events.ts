import { Effect, Queue, Ref } from "effect";
import {
  handleViewportMeasurement,
  handleViewportUserScroll,
} from "@/components/school/classes/forum/conversation/viewport/measure";
import type { ViewportEvent } from "@/components/school/classes/forum/conversation/viewport/model";
import { handleBackNavigation } from "@/components/school/classes/forum/conversation/viewport/navigate/back";
import { handlePostNavigation } from "@/components/school/classes/forum/conversation/viewport/navigate/post";
import { persistCurrentSnapshot } from "@/components/school/classes/forum/conversation/viewport/persist";
import { startViewportPlacement } from "@/components/school/classes/forum/conversation/viewport/placement";
import type { ViewportRuntime } from "@/components/school/classes/forum/conversation/viewport/runtime";
import { updateViewportState } from "@/components/school/classes/forum/conversation/viewport/state";
import { handleViewportTranscript } from "@/components/school/classes/forum/conversation/viewport/transcript";

/** Consumes queued viewport events for one open Forum Conversation. */
export function runViewportEventLoop(runtime: ViewportRuntime) {
  return Queue.take(runtime.eventQueue).pipe(
    Effect.flatMap((event) => handleViewportEvent(runtime, event)),
    Effect.forever
  );
}

/** Routes one viewport event to the state-machine branch that owns it. */
function handleViewportEvent(runtime: ViewportRuntime, event: ViewportEvent) {
  switch (event.type) {
    case "back":
      return handleBackNavigation(runtime);
    case "highlight-expired":
      return Effect.gen(function* () {
        const token = yield* Ref.get(runtime.highlightTokenRef);

        if (token !== event.token) {
          return;
        }

        yield* updateViewportState(runtime, (state) => ({
          ...state,
          highlightedPostId: null,
        }));
      });
    case "latest":
      return startViewportPlacement(runtime, {
        highlightPostId: null,
        view: { kind: "bottom" },
      });
    case "measure":
      return handleViewportMeasurement(
        runtime,
        event.measurement,
        event.source
      );
    case "persist":
      return persistCurrentSnapshot(runtime);
    case "post":
      return handlePostNavigation(runtime, event.postId);
    case "transcript":
      return handleViewportTranscript(runtime, event);
    case "user-scroll":
      return handleViewportUserScroll(runtime);
    default:
      return Effect.void;
  }
}
