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
import type { ViewportAdapters } from "@/components/school/classes/forum/conversation/viewport/adapter";
import type {
  ViewportEvent,
  ViewportMeasurement,
  ViewportPlacement,
  ViewportState,
} from "@/components/school/classes/forum/conversation/viewport/model";
import type { ConversationViewport } from "@/components/school/classes/forum/conversation/viewport/module";
import { makeConversationViewport } from "@/components/school/classes/forum/conversation/viewport/module";
import type { ConversationScrollSnapshot } from "@/components/school/classes/forum/store/session";

export const moduleTestTranscript = {
  lastPostId: secondPost._id,
  postIds: [firstPost._id, secondPost._id],
  rowIndexByPostId,
  rows,
} satisfies ActiveTranscriptModel;

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

export function createViewport(adapters: ViewportAdapters) {
  return Effect.runPromise(makeConversationViewport(adapters));
}

export async function dispatchViewport(
  viewport: ConversationViewport,
  event: ViewportEvent
) {
  await Effect.runPromise(viewport.dispatch(event));
}

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

export async function openTranscript(viewport: ConversationViewport) {
  await dispatchViewport(viewport, {
    activeTranscript: moduleTestTranscript,
    savedSnapshot: null,
    type: "transcript",
    unreadCue: null,
  });
}

export async function openReadyViewport(viewport: ConversationViewport) {
  await openTranscript(viewport);
  await dispatchMeasure(viewport, makeMeasurement());
  return waitForState(viewport, (state) => state.lifecycle === "ready");
}

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

export async function shutdownViewport(viewport: ConversationViewport) {
  await Effect.runPromise(viewport.shutdown);
}
