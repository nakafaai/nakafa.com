import { describe, expect, it } from "vitest";
import {
  conversationTestFirstPost as firstPost,
  conversationTestRows as rows,
  conversationTestSecondPost as secondPost,
} from "@/components/school/classes/forum/conversation/fixtures/data";
import {
  createAdapters,
  createViewport,
  dispatchMeasure,
  dispatchViewport,
  makeMeasurement,
  openTranscript,
  shutdownViewport,
  waitForState,
} from "@/components/school/classes/forum/conversation/viewport/fixture";

describe("conversation/viewport/service", () => {
  it("opens at latest, hides latest, marks read, and persists", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openTranscript(viewport);
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "bottom"
    );

    expect(rig.placements.at(-1)).toMatchObject({
      completion: "reached",
      view: { kind: "bottom" },
    });
    await dispatchMeasure(viewport, makeMeasurement());
    const settled = await waitForState(
      viewport,
      (state) => state.lifecycle === "ready" && state.isAtLatest
    );
    expect(settled.shouldShowLatestButton).toBe(false);
    await waitForState(viewport, () => rig.readPostIds.length === 1);
    expect(rig.readPostIds).toEqual([secondPost._id]);

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

  it("ignores no-op events without changing persisted state", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    rig.setMeasurement(null);
    expect(rig.adapters.scroller.isViewReached({ kind: "bottom" })).toBe(false);
    await dispatchViewport(viewport, { type: "back" });
    await dispatchMeasure(viewport, null);
    await dispatchViewport(viewport, { postId: firstPost._id, type: "post" });
    await dispatchViewport(viewport, { type: "persist" });
    await waitForState(viewport, () => true);

    expect(rig.placements).toEqual([]);
    expect(rig.snapshots).toEqual([]);
    const stableState = await waitForState(viewport, () => false);
    expect(stableState.pendingPlacement).toBeNull();
    await shutdownViewport(viewport);
  });
});
