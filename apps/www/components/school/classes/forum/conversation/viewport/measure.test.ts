import { describe, expect, it } from "vitest";
import { conversationTestFirstPost as firstPost } from "@/components/school/classes/forum/conversation/fixtures/data";
import {
  createAdapters,
  createViewport,
  dispatchMeasure,
  dispatchViewport,
  makeMeasurement,
  openReadyViewport,
  shutdownViewport,
  waitForState,
} from "@/components/school/classes/forum/conversation/viewport/fixture";

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

    expect(state.jumpControl).toEqual({ kind: "none" });
    await shutdownViewport(viewport);
  });
});
