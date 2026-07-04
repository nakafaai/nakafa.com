import { Effect, Exit, Queue, Ref, Scope, SubscriptionRef } from "effect";
import { describe, expect, it } from "vitest";
import {
  conversationTestFirstPost as firstPost,
  conversationTestSecondPost as secondPost,
} from "@/components/school/classes/forum/conversation/fixtures/data";
import { ViewportSessionError } from "@/components/school/classes/forum/conversation/viewport/adapter";
import {
  createAdapters,
  createViewport,
  dispatchMeasure,
  dispatchViewport,
  makeMeasurement,
  makePostMeasurement,
  openReadyViewport,
  shutdownViewport,
  viewportTestTranscript,
  waitForState,
} from "@/components/school/classes/forum/conversation/viewport/fixture";
import { handleViewportMeasurement } from "@/components/school/classes/forum/conversation/viewport/measure";
import {
  deriveViewportState,
  type ViewportEvent,
  type ViewportMeasurement,
} from "@/components/school/classes/forum/conversation/viewport/model";
import type {
  ActiveTranscript,
  ForumPostId,
  RuntimeFiber,
  ViewportRuntime,
} from "@/components/school/classes/forum/conversation/viewport/runtime";

describe("conversation/viewport/measure", () => {
  it("clears stale back history when latest placement reaches bottom", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openReadyViewport(viewport);
    await dispatchViewport(viewport, { postId: firstPost._id, type: "post" });
    await waitForState(
      viewport,
      (state) =>
        state.backStack.length === 1 &&
        state.pendingPlacement?.view.kind === "post"
    );
    await dispatchViewport(viewport, { type: "latest" });
    await waitForState(
      viewport,
      (state) =>
        state.backStack.length === 1 &&
        state.pendingPlacement?.view.kind === "bottom"
    );

    await dispatchMeasure(viewport, makeMeasurement(), "frame");
    const state = await waitForState(
      viewport,
      (nextState) =>
        nextState.backStack.length === 0 &&
        nextState.pendingPlacement === null &&
        nextState.isAtLatest
    );

    expect(state.jumpControl).toEqual({ showBack: false, showLatest: false });
    await shutdownViewport(viewport);
  });

  it("clears stale back history when manual scroll measurements leave the jump target", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openReadyViewport(viewport);
    await dispatchViewport(viewport, { postId: firstPost._id, type: "post" });
    await waitForState(viewport, (state) => state.backStack.length === 1);
    const targetMeasurement = makePostMeasurement(firstPost._id);
    rig.setMeasurement(targetMeasurement);
    await dispatchMeasure(viewport, targetMeasurement, "frame");
    await waitForState(
      viewport,
      (state) => state.backStack.length === 1 && state.pendingPlacement === null
    );

    const manualScrollMeasurement = makePostMeasurement(secondPost._id);
    rig.setMeasurement(manualScrollMeasurement);
    await dispatchMeasure(viewport, manualScrollMeasurement, "scroll");
    const state = await waitForState(
      viewport,
      (nextState) => nextState.backStack.length === 0
    );

    expect(state.jumpControl).toEqual({ showBack: false, showLatest: true });
    await shutdownViewport(viewport);
  });

  it("keeps back history when a manual scroll has no previous measurement", async () => {
    const rig = createAdapters();

    await Effect.runPromise(
      Effect.gen(function* () {
        const scope = yield* Scope.make();
        const runtime = {
          activeTranscriptRef: yield* Ref.make<ActiveTranscript>(null),
          adapters: {
            ...rig.adapters,
            session: {
              saveSnapshot: () =>
                Effect.fail(
                  new ViewportSessionError({
                    cause: "test",
                    message: "No snapshot should be persisted in this test.",
                  })
                ),
            },
          },
          eventQueue: yield* Queue.bounded<ViewportEvent>(1),
          highlightFiberRef: yield* Ref.make<RuntimeFiber | null>(null),
          highlightTokenRef: yield* Ref.make(0),
          lastMeasurementRef: yield* Ref.make<ViewportMeasurement | null>(null),
          lastReadPostIdRef: yield* Ref.make<ForumPostId | null>(null),
          persistFiberRef: yield* Ref.make<RuntimeFiber | null>(null),
          scope,
          stateRef: yield* SubscriptionRef.make(
            deriveViewportState({
              backStack: [{ kind: "bottom" }],
              hasOverflow: true,
              highlightedPostId: null,
              isAtLatest: false,
              latestAffinity: "detached",
              lifecycle: "ready",
              pendingPlacement: null,
            })
          ),
        } satisfies ViewportRuntime;

        yield* handleViewportMeasurement(
          runtime,
          makePostMeasurement(firstPost._id),
          "scroll"
        );
        const state = yield* SubscriptionRef.get(runtime.stateRef);

        expect(state.jumpControl).toEqual({ showBack: true, showLatest: true });
        yield* Scope.close(scope, Exit.succeed(undefined));
      })
    );
  });

  it("detaches latest affinity on away user intent before the next measurement", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openReadyViewport(viewport);
    const placementCount = rig.placements.length;
    await dispatchViewport(viewport, {
      awayFromLatest: true,
      type: "user-scroll",
    });
    const detached = await waitForState(
      viewport,
      (state) => state.latestAffinity === "detached"
    );
    expect(detached.isAtLatest).toBe(true);
    expect(detached.jumpControl).toEqual({
      showBack: false,
      showLatest: false,
    });

    await dispatchViewport(viewport, {
      activeTranscript: viewportTestTranscript,
      savedSnapshot: null,
      type: "transcript",
      unreadCue: null,
    });
    await dispatchViewport(viewport, { type: "latest" });
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "bottom"
    );

    expect(rig.placements).toHaveLength(placementCount + 1);
    await shutdownViewport(viewport);
  });

  it("keeps latest affinity for toward-latest user intent at bottom", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openReadyViewport(viewport);
    const placementCount = rig.placements.length;
    await dispatchViewport(viewport, {
      awayFromLatest: false,
      type: "user-scroll",
    });
    const attached = await waitForState(
      viewport,
      (state) => state.latestAffinity === "latest"
    );
    expect(attached.jumpControl).toEqual({
      showBack: false,
      showLatest: false,
    });

    await dispatchViewport(viewport, {
      activeTranscript: viewportTestTranscript,
      savedSnapshot: null,
      type: "transcript",
      unreadCue: null,
    });
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "bottom"
    );

    expect(rig.placements).toHaveLength(placementCount + 1);
    await shutdownViewport(viewport);
  });
});
