import { describe, expect, it } from "@repo/testing/effect";
import { Effect, Ref } from "effect";
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
import type { ConversationScrollSnapshot } from "@/components/school/classes/forum/store/session";

function makeExpectedSnapshot(
  overrides: Partial<ConversationScrollSnapshot> = {}
): ConversationScrollSnapshot {
  return {
    lastPostId: secondPost._id,
    offset: 300,
    renderedRowCount: rows.length,
    view: { kind: "bottom" },
    wasAtBottom: true,
    ...overrides,
  };
}

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

    expect(rig.snapshots).toEqual([makeExpectedSnapshot()]);

    await shutdownViewport(viewport);
  });

  it.live(
    "skips snapshot persistence when ready viewport has no captured view",
    () =>
      Effect.gen(function* () {
        const rig = createAdapters();
        rig.setMeasurement(null);

        const runtime = yield* createViewportRuntime({
          adapters: rig.adapters,
        });

        yield* flushCurrentSnapshot(runtime);
        yield* persistCurrentSnapshot(runtime, {
          activeTranscript: null,
          measurement: makeMeasurement(),
        });

        expect(rig.snapshots).toEqual([]);
      })
  );

  it("persists from the last measurement when live measurement is unavailable", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);
    await openReadyViewport(viewport);

    rig.setMeasurement(null);
    await dispatchViewport(viewport, { type: "persist" });
    await waitForState(viewport, () => rig.snapshots.length === 1);

    expect(rig.snapshots).toEqual([makeExpectedSnapshot()]);

    await shutdownViewport(viewport);
  });

  it.live(
    "persists from the live measurement when synchronous flush sees changed geometry",
    () =>
      Effect.gen(function* () {
        const rig = createAdapters();
        const capturedMeasurement = makePostMeasurement(firstPost._id);
        const liveMeasurement = makeMeasurement({ offset: 999 });
        rig.setMeasurement(liveMeasurement);
        expect(rig.adapters.scroller.measure()).toEqual(liveMeasurement);

        const runtime = yield* createViewportRuntime({
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

        expect(rig.snapshots).toEqual([makeExpectedSnapshot({ offset: 999 })]);
      })
  );

  it.live("persists latest snapshots with the flushed transcript", () =>
    Effect.gen(function* () {
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

      const runtime = yield* createViewportRuntime({
        activeTranscript: viewportTestTranscript,
        adapters: rig.adapters,
        measurement: makeMeasurement(),
      });

      yield* flushCurrentSnapshot(runtime);

      expect(rig.snapshots).toEqual([
        makeExpectedSnapshot({
          lastPostId: latestPost._id,
          offset: 480,
          renderedRowCount: latestRows.length,
        }),
      ]);
    })
  );

  it.live(
    "keeps queued measurement history available during synchronous flush",
    () =>
      Effect.gen(function* () {
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

        const runtime = yield* createViewportRuntime({
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
      })
  );

  it.live(
    "marks the live last-visible post read during synchronous flush",
    () =>
      Effect.gen(function* () {
        const rig = createAdapters();
        const viewport = yield* Effect.promise(() =>
          createViewport(rig.adapters)
        );

        yield* Effect.promise(() => openReadyViewport(viewport));
        rig.setMeasurement(makePostMeasurement(firstPost._id));
        yield* viewport.flushSnapshot;
        yield* Effect.promise(() =>
          waitForState(viewport, () => rig.readPostIds.length === 2)
        );

        expect(rig.readPostIds).toEqual([secondPost._id, firstPost._id]);
        yield* Effect.promise(() => shutdownViewport(viewport));
      })
  );

  it.live(
    "skips unchanged pending post placements during snapshot persistence",
    () =>
      Effect.gen(function* () {
        const rig = createAdapters();
        const viewport = yield* Effect.promise(() =>
          createViewport(rig.adapters)
        );

        yield* Effect.promise(() => openReadyViewport(viewport));
        yield* Effect.promise(() =>
          dispatchViewport(viewport, { postId: firstPost._id, type: "post" })
        );
        yield* Effect.promise(() =>
          waitForState(
            viewport,
            (state) => state.pendingPlacement?.view.kind === "post"
          )
        );
        yield* viewport.flushSnapshot;

        expect(rig.snapshots).toEqual([]);
        yield* Effect.promise(() => shutdownViewport(viewport));
      })
  );

  it.live(
    "persists a live moved position while post placement is still pending",
    () =>
      Effect.gen(function* () {
        const rig = createAdapters();
        const viewport = yield* Effect.promise(() =>
          createViewport(rig.adapters)
        );

        yield* Effect.promise(() => openReadyViewport(viewport));
        yield* Effect.promise(() =>
          dispatchViewport(viewport, { postId: firstPost._id, type: "post" })
        );
        yield* Effect.promise(() =>
          waitForState(
            viewport,
            (state) => state.pendingPlacement?.view.kind === "post"
          )
        );

        rig.setMeasurement(makePostMeasurement(firstPost._id));
        yield* viewport.flushSnapshot;

        expect(rig.snapshots).toEqual([
          makeExpectedSnapshot({
            offset: 160,
            view: { kind: "post", postId: firstPost._id },
            wasAtBottom: false,
          }),
        ]);
        yield* Effect.promise(() => shutdownViewport(viewport));
      })
  );

  it.live(
    "persists no-view detached measurements as stale-bottom invalidation snapshots",
    () =>
      Effect.gen(function* () {
        const rig = createAdapters();
        rig.setMeasurement(null);

        const runtime = yield* createViewportRuntime({
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

        expect(rig.snapshots).toEqual([
          makeExpectedSnapshot({ offset: 80, wasAtBottom: false }),
        ]);
      })
  );

  it.live("persists a pending latest placement as bottom intent", () =>
    Effect.gen(function* () {
      const rig = createAdapters();
      const viewport = yield* Effect.promise(() =>
        createViewport(rig.adapters)
      );

      yield* Effect.promise(() => openReadyViewport(viewport));
      const detachedMeasurement = makePostMeasurement(firstPost._id);
      rig.setMeasurement(detachedMeasurement);
      yield* Effect.promise(() =>
        dispatchMeasure(viewport, detachedMeasurement, "scroll")
      );
      yield* Effect.promise(() =>
        dispatchViewport(viewport, { type: "latest" })
      );
      yield* Effect.promise(() =>
        waitForState(
          viewport,
          (state) => state.pendingPlacement?.view.kind === "bottom"
        )
      );

      yield* viewport.flushSnapshot;

      expect(rig.snapshots).toEqual([makeExpectedSnapshot({ offset: 160 })]);

      yield* Effect.promise(() => shutdownViewport(viewport));
    })
  );

  it.live("flushes pending debounce work before saving a latest snapshot", () =>
    Effect.gen(function* () {
      const rig = createAdapters();
      const latestMeasurement = makeMeasurement({ offset: 360 });
      rig.setMeasurement(latestMeasurement);

      const runtime = yield* createViewportRuntime({
        adapters: rig.adapters,
        measurement: latestMeasurement,
      });
      const pendingFiber = yield* Effect.forkIn(Effect.never, runtime.scope);
      yield* Ref.set(runtime.persistFiberRef, pendingFiber);

      yield* flushCurrentSnapshot(runtime);

      expect(yield* Ref.get(runtime.persistFiberRef)).toBeNull();
      yield* flushCurrentSnapshot(runtime);

      expect(rig.snapshots).toEqual([
        makeExpectedSnapshot({ offset: 360 }),
        makeExpectedSnapshot({ offset: 360 }),
      ]);
    })
  );

  it.live(
    "supports synchronous pagehide flush while debounce work is pending",
    () =>
      Effect.gen(function* () {
        const rig = createAdapters();
        const latestMeasurement = makeMeasurement({ offset: 420 });
        rig.setMeasurement(latestMeasurement);

        const runtime = yield* createViewportRuntime({
          adapters: rig.adapters,
          measurement: latestMeasurement,
        });
        const pendingFiber = yield* Effect.forkIn(Effect.never, runtime.scope);
        yield* Ref.set(runtime.persistFiberRef, pendingFiber);

        yield* flushCurrentSnapshot(runtime);

        expect(yield* Ref.get(runtime.persistFiberRef)).toBeNull();

        expect(rig.snapshots).toEqual([makeExpectedSnapshot({ offset: 420 })]);
      })
  );

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

  it.live(
    "persists detached snapshots to invalidate stale bottom restores",
    () =>
      Effect.gen(function* () {
        const rig = createAdapters();
        const viewport = yield* Effect.promise(() =>
          createViewport(rig.adapters)
        );

        yield* Effect.promise(() => openReadyViewport(viewport));
        const detachedMeasurement = makePostMeasurement(firstPost._id);
        rig.setMeasurement(detachedMeasurement);
        yield* Effect.promise(() =>
          dispatchMeasure(viewport, detachedMeasurement, "scroll")
        );
        expect(rig.snapshots).toEqual([]);

        yield* viewport.flushSnapshot;

        expect(rig.snapshots).toEqual([
          makeExpectedSnapshot({
            offset: 160,
            view: { kind: "post", postId: firstPost._id },
            wasAtBottom: false,
          }),
        ]);

        yield* Effect.promise(() => shutdownViewport(viewport));
      })
  );
});
