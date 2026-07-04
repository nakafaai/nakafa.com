import { Effect, Exit, Queue, Ref, Scope, SubscriptionRef } from "effect";
import { describe, expect, it } from "vitest";
import {
  type ActiveTranscriptModel,
  createActiveTranscriptModel,
} from "@/components/school/classes/forum/conversation/data/transcript/active";
import {
  createConversationTestPost,
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
  type ViewportState,
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

  it("cancels pending latest placement when manual scroll leaves bottom", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openReadyViewport(viewport);
    await dispatchViewport(viewport, { postId: firstPost._id, type: "post" });
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "post"
    );
    await dispatchViewport(viewport, { type: "latest" });
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "bottom"
    );

    const manualScrollMeasurement = makePostMeasurement(firstPost._id, 120);
    rig.setMeasurement(manualScrollMeasurement);
    await dispatchMeasure(viewport, manualScrollMeasurement, "scroll");
    const state = await waitForState(
      viewport,
      (nextState) =>
        nextState.pendingPlacement === null &&
        nextState.latestAffinity === "detached"
    );

    expect(state.backStack).toEqual([]);
    expect(state.jumpControl).toEqual({ showBack: false, showLatest: true });
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

  it("cancels pending post placement when manual scroll measurements move away from its target", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);
    const thirdPost = createConversationTestPost({
      postId: "post_3",
      sequence: 3,
    });
    const fourthPost = createConversationTestPost({
      postId: "post_4",
      sequence: 4,
    });
    const activeTranscript = createActiveTranscriptModel({
      forum: undefined,
      posts: [firstPost, secondPost, thirdPost, fourthPost],
    }) satisfies ActiveTranscriptModel;

    await dispatchViewport(viewport, {
      activeTranscript,
      savedSnapshot: null,
      type: "transcript",
      unreadCue: null,
    });
    await dispatchMeasure(viewport, makeMeasurement());
    await waitForState(
      viewport,
      (state) => state.lifecycle === "ready" && state.pendingPlacement === null
    );
    const thirdPostMeasurement = makePostMeasurement(thirdPost._id, 160);
    rig.setMeasurement(thirdPostMeasurement);
    await dispatchMeasure(viewport, thirdPostMeasurement, "scroll");
    await waitForState(
      viewport,
      (state) =>
        state.lifecycle === "ready" && state.latestAffinity === "detached"
    );

    await dispatchViewport(viewport, { postId: firstPost._id, type: "post" });
    const placing = await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "post"
    );
    const placementCount = rig.placements.length;
    expect(placing.backStack).toEqual([
      { kind: "post", postId: thirdPost._id },
    ]);

    const fourthPostMeasurement = makePostMeasurement(fourthPost._id, 220);
    rig.setMeasurement(fourthPostMeasurement);
    await dispatchMeasure(viewport, fourthPostMeasurement, "scroll");
    const interrupted = await waitForState(
      viewport,
      (state) => state.pendingPlacement === null
    );

    expect(interrupted.backStack).toEqual([]);
    expect(interrupted.jumpControl).toEqual({
      showBack: false,
      showLatest: true,
    });
    await dispatchMeasure(viewport, fourthPostMeasurement);
    expect(rig.placements).toHaveLength(placementCount);
    await shutdownViewport(viewport);
  });

  it("keeps back history when a manual scroll has no previous measurement", async () => {
    const rig = createAdapters();

    await Effect.runPromise(
      Effect.gen(function* () {
        const runtime = yield* makeMeasurementRuntime({
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
          state: {
            backStack: [{ kind: "bottom" }],
            hasOverflow: true,
            highlightedPostId: null,
            isAtLatest: false,
            latestAffinity: "detached",
            lifecycle: "ready",
            pendingPlacement: null,
          },
        });

        yield* handleViewportMeasurement(
          runtime,
          makePostMeasurement(firstPost._id),
          "scroll"
        );
        const state = yield* SubscriptionRef.get(runtime.stateRef);

        expect(state.jumpControl).toEqual({ showBack: true, showLatest: true });
        yield* Scope.close(runtime.scope, Exit.succeed(undefined));
      })
    );
  });

  it("keeps pending post placement when scroll rows cannot be mapped", async () => {
    const rig = createAdapters();
    const missingPost = createConversationTestPost({
      postId: "post_missing",
      sequence: 5,
    });

    await Effect.runPromise(
      Effect.gen(function* () {
        const runtime = yield* makeMeasurementRuntime({
          adapters: rig.adapters,
          lastMeasurement: makePostMeasurement(secondPost._id, 80),
          state: {
            backStack: [{ kind: "bottom" }],
            hasOverflow: true,
            highlightedPostId: null,
            isAtLatest: false,
            latestAffinity: "detached",
            lifecycle: "placing",
            pendingPlacement: {
              highlightPostId: firstPost._id,
              view: { kind: "post", postId: firstPost._id },
            },
          },
        });

        yield* handleViewportMeasurement(
          runtime,
          {
            ...makePostMeasurement(secondPost._id, 120),
            offset: 260,
          },
          "scroll"
        );
        const state = yield* SubscriptionRef.get(runtime.stateRef);

        expect(state.pendingPlacement?.view).toEqual({
          kind: "post",
          postId: firstPost._id,
        });
        expect(state.backStack).toEqual([{ kind: "bottom" }]);
        yield* Scope.close(runtime.scope, Exit.succeed(undefined));
      })
    );

    await Effect.runPromise(
      Effect.gen(function* () {
        const runtime = yield* makeMeasurementRuntime({
          activeTranscript: viewportTestTranscript,
          adapters: rig.adapters,
          lastMeasurement: makePostMeasurement(secondPost._id, 80),
          state: {
            backStack: [{ kind: "bottom" }],
            hasOverflow: true,
            highlightedPostId: null,
            isAtLatest: false,
            latestAffinity: "detached",
            lifecycle: "placing",
            pendingPlacement: {
              highlightPostId: missingPost._id,
              view: { kind: "post", postId: missingPost._id },
            },
          },
        });

        yield* handleViewportMeasurement(
          runtime,
          {
            ...makePostMeasurement(secondPost._id, 120),
            offset: 260,
          },
          "scroll"
        );
        const state = yield* SubscriptionRef.get(runtime.stateRef);

        expect(state.pendingPlacement?.view).toEqual({
          kind: "post",
          postId: missingPost._id,
        });
        expect(state.backStack).toEqual([{ kind: "bottom" }]);
        yield* Scope.close(runtime.scope, Exit.succeed(undefined));
      })
    );
  });

  it("keeps pending post placement when scroll measurements still approach the target", async () => {
    const rig = createAdapters();

    await Effect.runPromise(
      Effect.gen(function* () {
        const runtime = yield* makeMeasurementRuntime({
          activeTranscript: viewportTestTranscript,
          adapters: rig.adapters,
          lastMeasurement: makeMeasurement(),
          state: {
            backStack: [{ kind: "bottom" }],
            hasOverflow: true,
            highlightedPostId: null,
            isAtLatest: false,
            latestAffinity: "detached",
            lifecycle: "placing",
            pendingPlacement: {
              highlightPostId: firstPost._id,
              view: { kind: "post", postId: firstPost._id },
            },
          },
        });

        yield* handleViewportMeasurement(
          runtime,
          makePostMeasurement(secondPost._id, 260),
          "scroll"
        );
        const state = yield* SubscriptionRef.get(runtime.stateRef);

        expect(state.pendingPlacement?.view).toEqual({
          kind: "post",
          postId: firstPost._id,
        });
        expect(state.backStack).toEqual([{ kind: "bottom" }]);
        yield* Scope.close(runtime.scope, Exit.succeed(undefined));
      })
    );
  });

  it("reattaches latest affinity when a reached post placement is clamped at bottom", async () => {
    const rig = createAdapters();

    await Effect.runPromise(
      Effect.gen(function* () {
        const runtime = yield* makeMeasurementRuntime({
          adapters: rig.adapters,
          state: {
            backStack: [{ kind: "bottom" }],
            hasOverflow: true,
            highlightedPostId: null,
            isAtLatest: false,
            latestAffinity: "detached",
            lifecycle: "placing",
            pendingPlacement: {
              highlightPostId: firstPost._id,
              view: { kind: "post", postId: firstPost._id },
            },
          },
        });
        const clampedMeasurement = makeMeasurement({
          lastVisiblePostId: firstPost._id,
          view: { kind: "post", postId: firstPost._id },
        });
        rig.setMeasurement(clampedMeasurement);

        yield* handleViewportMeasurement(runtime, clampedMeasurement, "frame");
        const state = yield* SubscriptionRef.get(runtime.stateRef);

        expect(state.pendingPlacement).toBeNull();
        expect(state.latestAffinity).toBe("latest");
        yield* Scope.close(runtime.scope, Exit.succeed(undefined));
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

/** Creates a minimal Effect runtime for direct measurement reducer tests. */
function makeMeasurementRuntime({
  activeTranscript = null,
  adapters,
  lastMeasurement = null,
  state,
}: {
  activeTranscript?: ActiveTranscript;
  adapters: ViewportRuntime["adapters"];
  lastMeasurement?: ViewportMeasurement | null;
  state: Omit<ViewportState, "jumpControl">;
}) {
  return Effect.gen(function* () {
    const scope = yield* Scope.make();

    return {
      activeTranscriptRef: yield* Ref.make<ActiveTranscript>(activeTranscript),
      adapters,
      eventQueue: yield* Queue.bounded<ViewportEvent>(1),
      highlightFiberRef: yield* Ref.make<RuntimeFiber | null>(null),
      highlightTokenRef: yield* Ref.make(0),
      lastMeasurementRef: yield* Ref.make<ViewportMeasurement | null>(
        lastMeasurement
      ),
      lastReadPostIdRef: yield* Ref.make<ForumPostId | null>(null),
      persistFiberRef: yield* Ref.make<RuntimeFiber | null>(null),
      scope,
      stateRef: yield* SubscriptionRef.make(deriveViewportState(state)),
    } satisfies ViewportRuntime;
  });
}
