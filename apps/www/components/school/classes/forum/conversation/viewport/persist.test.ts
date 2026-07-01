import { Effect } from "effect";
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
  waitForState,
} from "@/components/school/classes/forum/conversation/viewport/fixture";

describe("conversation/viewport/persist", () => {
  it("persists only after opening placement has settled", async () => {
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

  it("flushes a pending snapshot before shutdown", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openReadyViewport(viewport);
    const detachedMeasurement = makePostMeasurement(firstPost._id);
    rig.setMeasurement(detachedMeasurement);
    await dispatchMeasure(viewport, detachedMeasurement, "scroll");
    expect(rig.snapshots).toEqual([]);

    await Effect.runPromise(viewport.flushSnapshot);

    expect(rig.snapshots.at(-1)).toMatchObject({
      lastPostId: secondPost._id,
      view: { kind: "post", postId: firstPost._id },
      wasAtBottom: false,
    });

    await Effect.runPromise(viewport.flushSnapshot);
    expect(rig.snapshots).toHaveLength(2);

    await shutdownViewport(viewport);
  });
});
