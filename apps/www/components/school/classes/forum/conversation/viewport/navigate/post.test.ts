import { describe, expect, it } from "vitest";
import {
  conversationTestFirstPost as firstPost,
  conversationTestSecondPost as secondPost,
} from "@/components/school/classes/forum/conversation/fixtures/data";
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

describe("conversation/viewport/navigate/post", () => {
  it("pushes a semantic back view when jumping to a post", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openTranscript(viewport);
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "bottom"
    );
    await dispatchViewport(viewport, { postId: firstPost._id, type: "post" });

    const postState = await waitForState(
      viewport,
      (state) =>
        state.backStack.length === 1 &&
        state.pendingPlacement?.view.kind === "post"
    );

    expect(postState.backStack).toEqual([{ kind: "bottom" }]);
    expect(postState.highlightedPostId).toBeNull();
    expect(rig.placements.at(-1)).toMatchObject({
      align: "center",
      completion: "settled",
      view: { kind: "post", postId: firstPost._id },
    });

    await dispatchMeasure(viewport, makeMeasurement());
    const stillNavigating = await waitForState(
      viewport,
      (state) => state.backStack.length === 1
    );
    expect(stillNavigating.backStack).toEqual([{ kind: "bottom" }]);

    const firstPostView = makePostMeasurement(firstPost._id, 240);
    rig.setMeasurement(firstPostView);
    await dispatchMeasure(viewport, firstPostView);
    await waitForState(
      viewport,
      (state) => state.highlightedPostId === firstPost._id
    );

    await shutdownViewport(viewport);
  });

  it("keeps semantic back when a visible reply target is already settled", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openReadyViewport(viewport);
    const placementCount = rig.placements.length;
    rig.setSettledView({ kind: "post", postId: firstPost._id });

    await dispatchViewport(viewport, { postId: firstPost._id, type: "post" });
    const highlighted = await waitForState(
      viewport,
      (state) => state.highlightedPostId === firstPost._id
    );

    expect(highlighted.backStack).toEqual([{ kind: "bottom" }]);
    expect(rig.placements).toHaveLength(placementCount);

    rig.setSettledView(null);
    const detachedView = makePostMeasurement(firstPost._id, 210);
    rig.setMeasurement(detachedView);
    await dispatchMeasure(viewport, detachedView);
    const detached = await waitForState(
      viewport,
      (state) => state.backStack.length === 1
    );

    expect(detached.backStack).toEqual([{ kind: "bottom" }]);
    expect(detached.shouldShowLatestButton).toBe(false);

    await shutdownViewport(viewport);
  });

  it("keeps latest as back target when live capture already points at the reply target", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openReadyViewport(viewport);
    const targetMeasurement = makePostMeasurement(firstPost._id, 120);
    rig.setMeasurement(targetMeasurement);
    rig.setSettledView({ kind: "post", postId: firstPost._id });

    await dispatchViewport(viewport, { postId: firstPost._id, type: "post" });
    const state = await waitForState(
      viewport,
      (nextState) =>
        nextState.backStack.length === 1 &&
        nextState.highlightedPostId === firstPost._id
    );

    expect(state.backStack).toEqual([{ kind: "bottom" }]);
    expect(state.shouldShowLatestButton).toBe(false);

    await shutdownViewport(viewport);
  });

  it("keeps latest as back target when a ready viewport has no captured view", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);
    const latestMeasurement = makeMeasurement({ view: null });

    await openTranscript(viewport);
    rig.setMeasurement(null);
    await dispatchMeasure(viewport, latestMeasurement);

    await dispatchViewport(viewport, { postId: firstPost._id, type: "post" });
    const state = await waitForState(
      viewport,
      (nextState) =>
        nextState.backStack.length === 1 &&
        nextState.pendingPlacement?.view.kind === "post"
    );

    expect(state.backStack).toEqual([{ kind: "bottom" }]);
    expect(state.latestAffinity).toBe("detached");

    await shutdownViewport(viewport);
  });

  it("keeps latest as back target while a user latest placement is pending", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openReadyViewport(viewport);
    await dispatchViewport(viewport, { type: "latest" });
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "bottom"
    );
    rig.setMeasurement(makePostMeasurement(firstPost._id, 120));
    rig.setSettledView({ kind: "post", postId: firstPost._id });

    await dispatchViewport(viewport, { postId: firstPost._id, type: "post" });
    const state = await waitForState(
      viewport,
      (nextState) =>
        nextState.backStack.length === 1 &&
        nextState.highlightedPostId === firstPost._id
    );

    expect(state.backStack).toEqual([{ kind: "bottom" }]);
    expect(state.shouldShowLatestButton).toBe(false);

    await shutdownViewport(viewport);
  });

  it("highlights an already settled post and clears the highlight event", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openTranscript(viewport);
    rig.setMeasurement(makePostMeasurement(firstPost._id));
    expect(
      rig.adapters.scroller.isViewReached({
        kind: "post",
        postId: firstPost._id,
      })
    ).toBe(true);
    await dispatchViewport(viewport, { postId: firstPost._id, type: "post" });
    await dispatchViewport(viewport, { postId: firstPost._id, type: "post" });

    const highlighted = await waitForState(
      viewport,
      (state) => state.highlightedPostId === firstPost._id
    );

    expect(highlighted.backStack).toEqual([{ kind: "bottom" }]);

    await dispatchViewport(viewport, { token: 0, type: "highlight-expired" });
    const stillHighlighted = await waitForState(
      viewport,
      (state) => state.highlightedPostId === firstPost._id
    );

    expect(stillHighlighted.highlightedPostId).toBe(firstPost._id);

    await dispatchViewport(viewport, { token: 2, type: "highlight-expired" });
    const cleared = await waitForState(
      viewport,
      (state) => state.highlightedPostId === null
    );

    expect(cleared.highlightedPostId).toBeNull();
    await shutdownViewport(viewport);
  });

  it("highlights the current detached target without adding a back entry", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);
    const targetMeasurement = makePostMeasurement(firstPost._id);

    await openReadyViewport(viewport);
    rig.setMeasurement(targetMeasurement);
    await dispatchMeasure(viewport, targetMeasurement, "scroll");
    await waitForState(
      viewport,
      (state) => state.latestAffinity === "detached"
    );
    rig.setSettledView({ kind: "post", postId: firstPost._id });

    await dispatchViewport(viewport, { postId: firstPost._id, type: "post" });
    const highlighted = await waitForState(
      viewport,
      (state) => state.highlightedPostId === firstPost._id
    );

    expect(highlighted.backStack).toEqual([]);
    await shutdownViewport(viewport);
  });

  it("jumps to a post without a back entry when a detached viewport has no current view", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);
    const detachedMeasurement = makeMeasurement({
      bottomDistance: 80,
      isAtLatest: false,
      view: null,
    });

    await openReadyViewport(viewport);
    rig.setMeasurement(null);
    await dispatchMeasure(viewport, detachedMeasurement, "scroll");
    rig.setMeasurement(null);
    await dispatchViewport(viewport, { postId: firstPost._id, type: "post" });
    const state = await waitForState(
      viewport,
      (nextState) => nextState.pendingPlacement?.view.kind === "post"
    );

    expect(state.backStack).toEqual([]);
    expect(state.latestAffinity).toBe("detached");
    expect(rig.placements.at(-1)).toMatchObject({
      align: "center",
      view: { kind: "post", postId: firstPost._id },
    });

    await shutdownViewport(viewport);
  });

  it("keeps a measured back target when live capture is temporarily unavailable", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);
    const detachedMeasurement = makePostMeasurement(firstPost._id, 140);

    await openReadyViewport(viewport);
    rig.setMeasurement(detachedMeasurement);
    await dispatchMeasure(viewport, detachedMeasurement, "scroll");
    rig.setMeasurement(null);

    await dispatchViewport(viewport, { postId: secondPost._id, type: "post" });
    const state = await waitForState(
      viewport,
      (nextState) => nextState.pendingPlacement?.view.kind === "post"
    );

    expect(state.backStack).toEqual([{ kind: "post", postId: firstPost._id }]);
    expect(state.latestAffinity).toBe("detached");
    expect(rig.placements.at(-1)).toMatchObject({
      align: "center",
      view: { kind: "post", postId: secondPost._id },
    });

    const targetMeasurement = makePostMeasurement(secondPost._id, 90);
    rig.setMeasurement(targetMeasurement);
    await dispatchMeasure(viewport, targetMeasurement);
    const highlighted = await waitForState(
      viewport,
      (nextState) => nextState.highlightedPostId === secondPost._id
    );

    expect(highlighted.backStack).toEqual([
      { kind: "post", postId: firstPost._id },
    ]);

    await shutdownViewport(viewport);
  });
});
