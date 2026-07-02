import { Effect, Exit, Queue, Ref, Scope, SubscriptionRef } from "effect";
import { describe, expect, it } from "vitest";
import {
  conversationTestFirstPost as firstPost,
  conversationTestRows as rows,
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
  openTranscript,
  shutdownViewport,
  viewportTestTranscript,
  waitForState,
} from "@/components/school/classes/forum/conversation/viewport/fixture";
import {
  deriveViewportState,
  type ViewportEvent,
  type ViewportMeasurement,
} from "@/components/school/classes/forum/conversation/viewport/model";
import { flushCurrentSnapshot } from "@/components/school/classes/forum/conversation/viewport/persist";
import type {
  ActiveTranscript,
  ForumPostId,
  RuntimeFiber,
  ViewportRuntime,
} from "@/components/school/classes/forum/conversation/viewport/runtime";

describe("conversation/viewport/persist", () => {
  it("persists only after opening placement has reached its target", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openTranscript(viewport);
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "bottom"
    );
    await dispatchViewport(viewport, { type: "persist" });
    await waitForState(viewport, () => true);

    expect(rig.snapshots).toEqual([]);

    await dispatchMeasure(viewport, makeMeasurement());
    await waitForState(
      viewport,
      (state) => state.lifecycle === "ready" && state.pendingPlacement === null
    );
    await dispatchViewport(viewport, { type: "persist" });
    await waitForState(viewport, () => rig.snapshots.length === 1);

    expect(rig.snapshots).toEqual([
      {
        lastPostId: secondPost._id,
        offset: 300,
        renderedRowCount: rows.length,
        view: { kind: "bottom" },
        wasAtBottom: true,
      },
    ]);

    await shutdownViewport(viewport);
  });

  it("skips snapshot persistence when ready viewport has no captured view", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);
    await openReadyViewport(viewport);

    rig.setMeasurement(makeMeasurement({ view: null }));
    await dispatchViewport(viewport, { type: "persist" });
    await waitForState(viewport, () => true);
    expect(rig.snapshots).toEqual([]);
    await shutdownViewport(viewport);
  });

  it("persists from the last measurement when live measurement is unavailable", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);
    await openReadyViewport(viewport);

    rig.setMeasurement(null);
    await dispatchViewport(viewport, { type: "persist" });
    await waitForState(viewport, () => rig.snapshots.length === 1);

    expect(rig.snapshots).toEqual([
      {
        lastPostId: secondPost._id,
        offset: 300,
        renderedRowCount: rows.length,
        view: { kind: "bottom" },
        wasAtBottom: true,
      },
    ]);

    await shutdownViewport(viewport);
  });

  it("flushes pending debounce work before saving a latest snapshot", async () => {
    const rig = createAdapters();
    const latestMeasurement = makeMeasurement({ offset: 360 });
    rig.setMeasurement(latestMeasurement);

    await Effect.runPromise(
      Effect.gen(function* () {
        const scope = yield* Scope.make();
        const pendingFiber = yield* Effect.forkIn(
          Effect.never.pipe(Effect.asVoid),
          scope
        );
        const runtime = {
          activeTranscriptRef: yield* Ref.make<ActiveTranscript>(
            viewportTestTranscript
          ),
          adapters: rig.adapters,
          eventQueue: yield* Queue.bounded<ViewportEvent>(1),
          highlightFiberRef: yield* Ref.make<RuntimeFiber | null>(null),
          highlightTokenRef: yield* Ref.make(0),
          lastMeasurementRef: yield* Ref.make<ViewportMeasurement | null>(
            latestMeasurement
          ),
          lastReadPostIdRef: yield* Ref.make<ForumPostId | null>(null),
          persistFiberRef: yield* Ref.make<RuntimeFiber | null>(pendingFiber),
          scope,
          stateRef: yield* SubscriptionRef.make(
            deriveViewportState({
              backStack: [],
              hasOverflow: true,
              highlightedPostId: null,
              isAtLatest: true,
              latestAffinity: "latest",
              lifecycle: "ready",
              pendingPlacement: null,
            })
          ),
        } satisfies ViewportRuntime;

        yield* flushCurrentSnapshot(runtime);

        expect(yield* Ref.get(runtime.persistFiberRef)).toBeNull();
        yield* flushCurrentSnapshot(runtime);
        yield* Scope.close(scope, Exit.succeed(undefined));
      })
    );

    expect(rig.snapshots).toEqual([
      {
        lastPostId: secondPost._id,
        offset: 360,
        renderedRowCount: rows.length,
        view: { kind: "bottom" },
        wasAtBottom: true,
      },
      {
        lastPostId: secondPost._id,
        offset: 360,
        renderedRowCount: rows.length,
        view: { kind: "bottom" },
        wasAtBottom: true,
      },
    ]);
  });

  it("keeps viewport state alive when snapshot persistence fails", async () => {
    const rig = createAdapters();
    const viewport = await createViewport({
      ...rig.adapters,
      session: {
        saveSnapshot: () =>
          Effect.fail(
            new ViewportSessionError({
              cause: "test",
              message: "Snapshot persistence failed in test.",
            })
          ),
      },
    });

    await openReadyViewport(viewport);
    await dispatchViewport(viewport, { type: "persist" });
    const state = await waitForState(
      viewport,
      (nextState) => nextState.lifecycle === "ready"
    );

    expect(state.pendingPlacement).toBeNull();
    expect(rig.snapshots).toEqual([]);
    await shutdownViewport(viewport);
  });

  it("does not persist detached snapshots before shutdown", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openReadyViewport(viewport);
    const detachedMeasurement = makePostMeasurement(firstPost._id);
    rig.setMeasurement(detachedMeasurement);
    await dispatchMeasure(viewport, detachedMeasurement, "scroll");
    expect(rig.snapshots).toEqual([]);

    await Effect.runPromise(viewport.flushSnapshot);

    expect(rig.snapshots).toEqual([]);

    await shutdownViewport(viewport);
  });
});
