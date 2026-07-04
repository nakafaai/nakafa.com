import { describe, expect, it } from "vitest";
import {
  conversationTestFirstPost as firstPost,
  conversationTestSecondPost as secondPost,
} from "@/components/school/classes/forum/conversation/fixtures/data";
import {
  makeMeasurement,
  makePostMeasurement,
  viewportTestTranscript,
} from "@/components/school/classes/forum/conversation/viewport/fixture";
import {
  hasScrollMeasurementInterruptedPlacement,
  isPendingLatestIntent,
} from "@/components/school/classes/forum/conversation/viewport/intent";
import {
  deriveViewportState,
  type ViewportState,
} from "@/components/school/classes/forum/conversation/viewport/model";

describe("conversation/viewport/intent", () => {
  it("cancels pending post placement when manual scroll moves into no-view rows", () => {
    expect(
      hasScrollMeasurementInterruptedPlacement({
        activeTranscript: viewportTestTranscript,
        hasUserDetachedFromLatest: false,
        measurement: makeMeasurement({
          bottomDistance: 180,
          isAtLatest: false,
          lastVisiblePostId: null,
          offset: 280,
          view: null,
        }),
        pendingPlacement: {
          highlightPostId: firstPost._id,
          view: { kind: "post", postId: firstPost._id },
        },
        previousMeasurement: makePostMeasurement(secondPost._id, 80),
      })
    ).toBe(true);
  });

  it("preserves pending post placement when the target cannot be mapped", () => {
    const transcriptWithoutTargetIndex = {
      ...viewportTestTranscript,
      rowIndexByPostId: new Map([[secondPost._id, 1]]),
    };

    expect(
      hasScrollMeasurementInterruptedPlacement({
        activeTranscript: transcriptWithoutTargetIndex,
        hasUserDetachedFromLatest: false,
        measurement: makePostMeasurement(secondPost._id, 120),
        pendingPlacement: {
          highlightPostId: null,
          view: { kind: "post", postId: firstPost._id },
        },
        previousMeasurement: makePostMeasurement(secondPost._id, 80),
      })
    ).toBe(false);
  });

  it("persists placing latest intent for instant transcript auto-stick", () => {
    expect(
      isPendingLatestIntent(
        makeViewportState({
          lifecycle: "placing",
          pendingPlacement: {
            highlightPostId: null,
            motion: "instant",
            view: { kind: "bottom" },
          },
        })
      )
    ).toBe(true);
  });

  it("does not persist initial opening latest placement before it reaches bottom", () => {
    expect(
      isPendingLatestIntent(
        makeViewportState({
          lifecycle: "opening",
          pendingPlacement: {
            highlightPostId: null,
            motion: "instant",
            view: { kind: "bottom" },
          },
        })
      )
    ).toBe(false);
  });
});

/** Creates one complete viewport state for intent rule tests. */
function makeViewportState(
  overrides: Partial<Omit<ViewportState, "jumpControl">>
) {
  return deriveViewportState({
    backStack: [],
    hasOverflow: true,
    highlightedPostId: null,
    isAtLatest: true,
    latestAffinity: "latest",
    lifecycle: "ready",
    pendingPlacement: null,
    ...overrides,
  });
}
