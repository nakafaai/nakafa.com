import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";
import { vi } from "vitest";
import type { ActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/transcript/active";
import {
  areConversationViewsEqual,
  type ConversationView,
} from "@/components/school/classes/forum/conversation/data/view/model";
import {
  conversationTestFirstPost as firstPost,
  conversationTestRowIndexByPostId as rowIndexByPostId,
  conversationTestRows as rows,
  conversationTestSecondPost as secondPost,
} from "@/components/school/classes/forum/conversation/fixtures/data";
import {
  ConversationViewportAdapters,
  type ViewportAdapters,
} from "@/components/school/classes/forum/conversation/viewport/adapter";
import type {
  ViewportEvent,
  ViewportMeasurement,
  ViewportPlacement,
  ViewportState,
} from "@/components/school/classes/forum/conversation/viewport/model";
import type { ConversationViewport } from "@/components/school/classes/forum/conversation/viewport/service";
import { makeConversationViewport } from "@/components/school/classes/forum/conversation/viewport/service";
import type { ConversationScrollSnapshot } from "@/components/school/classes/forum/store/session";

export const viewportTestTranscript = {
  lastPostId: secondPost._id,
  postIds: [firstPost._id, secondPost._id],
  rowIndexByPostId,
  rows,
} satisfies ActiveTranscriptModel;

/** Creates one normalized bottom measurement for viewport service tests. */
export function makeMeasurement(
  overrides: Partial<ViewportMeasurement> = {}
): ViewportMeasurement {
  return {
    bottomDistance: 0,
    hasOverflow: true,
    isAtLatest: true,
    lastVisiblePostId: secondPost._id,
    offset: 300,
    view: { kind: "bottom" },
    ...overrides,
  };
}

/** Creates one detached post measurement for viewport service tests. */
export function makePostMeasurement(
  postId: Id<"schoolClassForumPosts">,
  bottomDistance = 80
) {
  return makeMeasurement({
    bottomDistance,
    isAtLatest: false,
    lastVisiblePostId: postId,
    offset: 160,
    view: { kind: "post", postId },
  });
}

/** Creates browser adapter fakes for one viewport service test. */
export function createAdapters() {
  let measurement: ViewportMeasurement | null = makeMeasurement();
  let placeResult = true;
  let settledView: ConversationView | null = null;
  const placements: ViewportPlacement[] = [];
  const readPostIds: Id<"schoolClassForumPosts">[] = [];
  const snapshots: ConversationScrollSnapshot[] = [];
  const adapters = {
    read: {
      markPostRead: (postId) =>
        Effect.sync(() => {
          readPostIds.push(postId);
        }),
    },
    scroller: {
      captureView: () => measurement?.view ?? null,
      isViewReached: (view) => {
        if (!measurement) {
          return false;
        }

        if (view.kind === "bottom") {
          return measurement.isAtLatest;
        }

        return areConversationViewsEqual(measurement.view, view);
      },
      isViewSettled: (view) =>
        areConversationViewsEqual(settledView ?? measurement?.view, view),
      measure: () => measurement,
      place: vi.fn((placement: ViewportPlacement) => {
        placements.push(placement);
        return placeResult;
      }),
    },
    session: {
      saveSnapshot: (snapshot) =>
        Effect.sync(() => {
          snapshots.push(snapshot);
        }),
    },
    timer: {
      sleep: () => Effect.never,
    },
  } satisfies ViewportAdapters;

  return {
    adapters,
    placements,
    readPostIds,
    setMeasurement: (nextMeasurement: ViewportMeasurement | null) => {
      measurement = nextMeasurement;
    },
    setPlaceResult: (nextPlaceResult: boolean) => {
      placeResult = nextPlaceResult;
    },
    setSettledView: (view: ConversationView | null) => {
      settledView = view;
    },
    snapshots,
  };
}

/** Creates one Effect-owned viewport service with test adapters provided. */
export function createViewport(adapters: ViewportAdapters) {
  return Effect.runPromise(
    makeConversationViewport().pipe(
      Effect.provideService(ConversationViewportAdapters, adapters)
    )
  );
}

/** Sends one event through the serialized viewport service queue. */
export async function dispatchViewport(
  viewport: ConversationViewport,
  event: ViewportEvent
) {
  await Effect.runPromise(viewport.dispatch(event));
}

/** Sends one normalized measurement event through the viewport service queue. */
export async function dispatchMeasure(
  viewport: ConversationViewport,
  measurement: ViewportMeasurement | null,
  source: "frame" | "scroll" = "frame"
) {
  await dispatchViewport(viewport, {
    measurement,
    source,
    type: "measure",
  });
}

/** Opens the test transcript without waiting for initial placement to settle. */
export async function openTranscript(viewport: ConversationViewport) {
  await dispatchViewport(viewport, {
    activeTranscript: viewportTestTranscript,
    savedSnapshot: null,
    type: "transcript",
    unreadCue: null,
  });
}

/** Opens the test transcript and settles it at the latest edge. */
export async function openReadyViewport(viewport: ConversationViewport) {
  await openTranscript(viewport);
  await dispatchMeasure(viewport, makeMeasurement());
  return waitForState(viewport, (state) => state.lifecycle === "ready");
}

/** Waits until the viewport service exposes a state matching the predicate. */
export async function waitForState(
  viewport: ConversationViewport,
  predicate: (state: ViewportState) => boolean
) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const state = await Effect.runPromise(viewport.getState);

    if (predicate(state)) {
      return state;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return Effect.runPromise(viewport.getState);
}

/** Shuts down one viewport service test instance. */
export async function shutdownViewport(viewport: ConversationViewport) {
  await Effect.runPromise(viewport.shutdown);
}
