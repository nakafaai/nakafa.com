import { Effect, Match, Queue, Ref } from "effect";
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
  return Match.value(event).pipe(
    Match.discriminatorsExhaustive("type")({
      back: () => handleBackNavigation(runtime),
      "highlight-expired": (expired) =>
        Effect.gen(function* () {
          const token = yield* Ref.get(runtime.highlightTokenRef);

          if (token !== expired.token) {
            return;
          }

          yield* updateViewportState(runtime, (state) => ({
            ...state,
            highlightedPostId: null,
          }));
        }),
      latest: () =>
        startViewportPlacement(runtime, {
          highlightPostId: null,
          view: { kind: "bottom" },
        }),
      measure: (measured) =>
        handleViewportMeasurement(
          runtime,
          measured.measurement,
          measured.source
        ),
      persist: () => persistCurrentSnapshot(runtime),
      post: (navigation) => handlePostNavigation(runtime, navigation.postId),
      transcript: (transcript) => handleViewportTranscript(runtime, transcript),
      "user-scroll": (scroll) => handleViewportUserScroll(runtime, scroll),
    })
  );
}
