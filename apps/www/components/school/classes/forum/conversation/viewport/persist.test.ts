import { Effect, Ref } from "effect";
import { describe, expect, it } from "vitest";
import type { ActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/transcript/active";
import {
  createConversationTestPost,
  conversationTestFirstPost as firstPost,
  conversationTestRowIndexByPostId as rowIndexByPostId,
  conversationTestRows as rows,
  conversationTestSecondPost as secondPost,
} from "@/components/school/classes/forum/conversation/fixtures/data";
import { ViewportSessionError } from "@/components/school/classes/forum/conversation/viewport/adapter";
import {
  closeViewportRuntime,
  createAdapters,
  createViewport,
  createViewportRuntime,
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
import { deriveViewportState } from "@/components/school/classes/forum/conversation/viewport/model";
import {
  flushCurrentSnapshot,
  persistCurrentSnapshot,
} from "@/components/school/classes/forum/conversation/viewport/persist";

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
    rig.setMeasurement(null);

    await Effect.runPromise(
      Effect.gen(function* () {
        const { runtime, scope } = yield* createViewportRuntime({
          adapters: rig.adapters,
        });

        yield* flushCurrentSnapshot(runtime);
        yield* persistCurrentSnapshot(runtime, {
          activeTranscript: null,
          measurement: makeMeasurement(),
        });
        yield* closeViewportRuntime(scope);
      })
    );

    expect(rig.snapshots).toEqual([]);
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

  it("persists from the live measurement when synchronous flush sees changed geometry", async () => {
    const rig = createAdapters();
    const capturedMeasurement = makePostMeasurement(firstPost._id);
    const liveMeasurement = makeMeasurement({ offset: 999 });
    rig.setMeasurement(liveMeasurement);
    expect(rig.adapters.scroller.measure()).toEqual(liveMeasurement);

    await Effect.runPromise(
      Effect.gen(function* () {
        const { runtime, scope } = yield* createViewportRuntime({
          adapters: rig.adapters,
          measurement: capturedMeasurement,
          state: deriveViewportState({
            backStack: [],
            hasOverflow: true,
            highlightedPostId: null,
            isAtLatest: false,
            latestAffinity: "detached",
            lifecycle: "ready",
            pendingPlacement: null,
          }),
        });

        yield* flushCurrentSnapshot(runtime);
        yield* closeViewportRuntime(scope);
      })
    );

    expect(rig.snapshots).toEqual([
      {
        lastPostId: secondPost._id,
        offset: 999,
        renderedRowCount: rows.length,
        view: { kind: "bottom" },
        wasAtBottom: true,
      },
    ]);
  });

  it("persists latest snapshots with the flushed transcript", async () => {
    const rig = createAdapters();
    const latestPost = createConversationTestPost({
      postId: "post_3",
      sequence: 3,
    });
    const latestRows = [
      ...rows,
      { post: latestPost, type: "post" },
    ] satisfies ActiveTranscriptModel["rows"];
    const latestRowIndexByPostId = new Map(rowIndexByPostId);
    latestRowIndexByPostId.set(latestPost._id, latestRows.length - 1);
    const latestTranscript = {
      lastPostId: latestPost._id,
      postIds: [firstPost._id, secondPost._id, latestPost._id],
      rowIndexByPostId: latestRowIndexByPostId,
      rows: latestRows,
    } satisfies ActiveTranscriptModel;

    rig.setTranscript(latestTranscript);
    rig.setMeasurement(
      makeMeasurement({
        lastVisiblePostId: latestPost._id,
        offset: 480,
      })
    );

    await Effect.runPromise(
      Effect.gen(function* () {
        const { runtime, scope } = yield* createViewportRuntime({
          activeTranscript: viewportTestTranscript,
          adapters: rig.adapters,
          measurement: makeMeasurement(),
        });

        yield* flushCurrentSnapshot(runtime);
        yield* closeViewportRuntime(scope);
      })
    );

    expect(rig.snapshots).toEqual([
      {
        lastPostId: latestPost._id,
        offset: 480,
        renderedRowCount: latestRows.length,
        view: { kind: "bottom" },
        wasAtBottom: true,
      },
    ]);
  });

  it("keeps queued measurement history available during synchronous flush", async () => {
    const rig = createAdapters();
    const previousMeasurement = makePostMeasurement(secondPost._id);
    const liveMeasurement = makeMeasurement({
      bottomDistance: 260,
      isAtLatest: false,
      lastVisiblePostId: firstPost._id,
      offset: 620,
      view: { kind: "post", postId: firstPost._id },
    });
    rig.setMeasurement(liveMeasurement);

    await Effect.runPromise(
      Effect.gen(function* () {
        const { runtime, scope } = yield* createViewportRuntime({
          adapters: rig.adapters,
          measurement: previousMeasurement,
          state: deriveViewportState({
            backStack: [],
            hasOverflow: true,
            highlightedPostId: null,
            isAtLatest: false,
            latestAffinity: "detached",
            lifecycle: "placing",
            pendingPlacement: {
              highlightPostId: firstPost._id,
              view: { kind: "post", postId: firstPost._id },
            },
          }),
        });

        yield* flushCurrentSnapshot(runtime);

        expect(yield* Ref.get(runtime.lastMeasurementRef)).toEqual(
          previousMeasurement
        );
        yield* closeViewportRuntime(scope);
      })
    );
  });

  it("marks the live last-visible post read during synchronous flush", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openReadyViewport(viewport);
    rig.setMeasurement(makePostMeasurement(firstPost._id));
    await Effect.runPromise(viewport.flushSnapshot);
    await waitForState(viewport, () => rig.readPostIds.length === 2);

    expect(rig.readPostIds).toEqual([secondPost._id, firstPost._id]);
    await shutdownViewport(viewport);
  });

  it("skips unchanged pending post placements during snapshot persistence", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openReadyViewport(viewport);
    await dispatchViewport(viewport, { postId: firstPost._id, type: "post" });
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "post"
    );
    await Effect.runPromise(viewport.flushSnapshot);

    expect(rig.snapshots).toEqual([]);
    await shutdownViewport(viewport);
  });

  it("persists a live moved position while post placement is still pending", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openReadyViewport(viewport);
    await dispatchViewport(viewport, { postId: firstPost._id, type: "post" });
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "post"
    );

    rig.setMeasurement(makePostMeasurement(firstPost._id));
    await Effect.runPromise(viewport.flushSnapshot);

    expect(rig.snapshots).toEqual([
      {
        lastPostId: secondPost._id,
        offset: 160,
        renderedRowCount: rows.length,
        view: { kind: "post", postId: firstPost._id },
        wasAtBottom: false,
      },
    ]);
    await shutdownViewport(viewport);
  });

  it("persists no-view detached measurements as stale-bottom invalidation snapshots", async () => {
    const rig = createAdapters();
    rig.setMeasurement(null);

    await Effect.runPromise(
      Effect.gen(function* () {
        const { runtime, scope } = yield* createViewportRuntime({
          adapters: rig.adapters,
          measurement: makeMeasurement({
            bottomDistance: 320,
            isAtLatest: false,
            lastVisiblePostId: null,
            offset: 80,
            view: null,
          }),
          state: deriveViewportState({
            backStack: [],
            hasOverflow: true,
            highlightedPostId: null,
            isAtLatest: false,
            latestAffinity: "detached",
            lifecycle: "ready",
            pendingPlacement: null,
          }),
        });

        yield* flushCurrentSnapshot(runtime);
        yield* closeViewportRuntime(scope);
      })
    );

    expect(rig.snapshots).toEqual([
      {
        lastPostId: secondPost._id,
        offset: 80,
        renderedRowCount: rows.length,
        view: { kind: "bottom" },
        wasAtBottom: false,
      },
    ]);
  });

  it("persists a pending latest placement as bottom intent", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openReadyViewport(viewport);
    const detachedMeasurement = makePostMeasurement(firstPost._id);
    rig.setMeasurement(detachedMeasurement);
    await dispatchMeasure(viewport, detachedMeasurement, "scroll");
    await dispatchViewport(viewport, { type: "latest" });
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "bottom"
    );

    await Effect.runPromise(viewport.flushSnapshot);

    expect(rig.snapshots).toEqual([
      {
        lastPostId: secondPost._id,
        offset: 160,
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
        const { runtime, scope } = yield* createViewportRuntime({
          adapters: rig.adapters,
          measurement: latestMeasurement,
        });
        const pendingFiber = yield* Effect.forkIn(Effect.never, scope);
        yield* Ref.set(runtime.persistFiberRef, pendingFiber);

        yield* flushCurrentSnapshot(runtime);

        expect(yield* Ref.get(runtime.persistFiberRef)).toBeNull();
        yield* flushCurrentSnapshot(runtime);
        yield* closeViewportRuntime(scope);
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

  it("supports synchronous pagehide flush while debounce work is pending", () => {
    const rig = createAdapters();
    const latestMeasurement = makeMeasurement({ offset: 420 });
    rig.setMeasurement(latestMeasurement);

    Effect.runSync(
      Effect.gen(function* () {
        const { runtime, scope } = yield* createViewportRuntime({
          adapters: rig.adapters,
          measurement: latestMeasurement,
        });
        const pendingFiber = yield* Effect.forkIn(Effect.never, scope);
        yield* Ref.set(runtime.persistFiberRef, pendingFiber);

        yield* flushCurrentSnapshot(runtime);

        expect(yield* Ref.get(runtime.persistFiberRef)).toBeNull();
        yield* closeViewportRuntime(scope);
      })
    );

    expect(rig.snapshots).toEqual([
      {
        lastPostId: secondPost._id,
        offset: 420,
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

  it("persists detached snapshots to invalidate stale bottom restores", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openReadyViewport(viewport);
    const detachedMeasurement = makePostMeasurement(firstPost._id);
    rig.setMeasurement(detachedMeasurement);
    await dispatchMeasure(viewport, detachedMeasurement, "scroll");
    expect(rig.snapshots).toEqual([]);

    await Effect.runPromise(viewport.flushSnapshot);

    expect(rig.snapshots).toEqual([
      {
        lastPostId: secondPost._id,
        offset: 160,
        renderedRowCount: rows.length,
        view: { kind: "post", postId: firstPost._id },
        wasAtBottom: false,
      },
    ]);

    await shutdownViewport(viewport);
  });
});
