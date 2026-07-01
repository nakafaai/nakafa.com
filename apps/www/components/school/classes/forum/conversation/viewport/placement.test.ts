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
  openTranscript,
  shutdownViewport,
  viewportTestTranscript,
  waitForState,
} from "@/components/school/classes/forum/conversation/viewport/fixture";

describe("conversation/viewport/placement", () => {
  it("retries unresolved pending placement after Virtua settles scrolling", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);
    const staleBottom = makeMeasurement({
      bottomDistance: 3174,
      isAtLatest: false,
      offset: 3651,
      view: { kind: "bottom" },
    });

    await openTranscript(viewport);
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "bottom"
    );

    expect(rig.placements).toHaveLength(1);
    rig.setMeasurement(staleBottom);
    await dispatchMeasure(viewport, staleBottom, "scroll");
    expect(rig.placements).toHaveLength(1);

    await dispatchMeasure(viewport, staleBottom, "frame");
    const retrying = await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "bottom"
    );

    expect(rig.placements).toHaveLength(2);
    expect(rig.placements.at(-1)).toMatchObject({
      view: { kind: "bottom" },
    });
    expect(retrying.lifecycle).toBe("placing");
    expect(retrying.shouldShowLatestButton).toBe(false);

    rig.setMeasurement(makeMeasurement());
    await dispatchMeasure(viewport, makeMeasurement(), "frame");
    await waitForState(
      viewport,
      (state) => state.lifecycle === "ready" && state.pendingPlacement === null
    );

    await shutdownViewport(viewport);
  });

  it("cancels pending latest placement when the user scrolls away", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openTranscript(viewport);
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "bottom"
    );
    await dispatchMeasure(
      viewport,
      makeMeasurement({
        bottomDistance: 4,
        isAtLatest: false,
        offset: 120,
        view: { kind: "post", postId: firstPost._id },
      })
    );
    const placementCount = rig.placements.length;

    await dispatchMeasure(
      viewport,
      makeMeasurement({
        bottomDistance: 7,
        isAtLatest: false,
        offset: 117,
        view: { kind: "post", postId: firstPost._id },
      }),
      "scroll"
    );
    const state = await waitForState(
      viewport,
      (nextState) =>
        nextState.lifecycle === "ready" &&
        nextState.latestAffinity === "detached"
    );

    expect(state.pendingPlacement).toBeNull();
    await dispatchMeasure(
      viewport,
      makeMeasurement({
        bottomDistance: 7,
        isAtLatest: false,
        offset: 117,
        view: { kind: "post", postId: firstPost._id },
      })
    );
    expect(rig.placements).toHaveLength(placementCount);
    await shutdownViewport(viewport);
  });

  it("keeps pending post placement during programmatic placement scroll", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openTranscript(viewport);
    await dispatchViewport(viewport, { postId: firstPost._id, type: "post" });
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "post"
    );

    const intermediatePostView = makePostMeasurement(secondPost._id, 260);
    rig.setMeasurement(intermediatePostView);
    await dispatchMeasure(viewport, intermediatePostView, "scroll");
    const placing = await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "post"
    );

    expect(placing.lifecycle).toBe("placing");
    expect(placing.highlightedPostId).toBeNull();

    await shutdownViewport(viewport);
  });

  it("settles unread opening placements through post reach checks", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await dispatchViewport(viewport, {
      activeTranscript: viewportTestTranscript,
      savedSnapshot: null,
      type: "transcript",
      unreadCue: {
        count: 1,
        postId: firstPost._id,
        status: "history",
      },
    });
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "post"
    );

    expect(rig.placements.at(-1)).toMatchObject({
      align: "start",
      view: { kind: "post", postId: firstPost._id },
    });

    const firstPostView = makePostMeasurement(firstPost._id);
    rig.setMeasurement(firstPostView);
    await dispatchMeasure(viewport, firstPostView);
    const state = await waitForState(
      viewport,
      (nextState) =>
        nextState.lifecycle === "ready" && nextState.pendingPlacement === null
    );

    expect(state.shouldShowLatestButton).toBe(true);
    await shutdownViewport(viewport);
  });

  it("settles safely when placement cannot run yet", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    rig.setPlaceResult(false);
    await openTranscript(viewport);
    const state = await waitForState(
      viewport,
      (nextState) => nextState.lifecycle === "ready"
    );

    expect(rig.placements).toHaveLength(1);
    expect(state.pendingPlacement).toBeNull();
    await shutdownViewport(viewport);
  });

  it("clears pending placement when a frame retry cannot place", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);
    const staleBottom = makeMeasurement({
      bottomDistance: 260,
      isAtLatest: false,
      offset: 140,
      view: { kind: "bottom" },
    });

    await openTranscript(viewport);
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "bottom"
    );
    rig.setMeasurement(staleBottom);
    rig.setPlaceResult(false);

    await dispatchMeasure(viewport, staleBottom, "frame");
    const state = await waitForState(
      viewport,
      (nextState) =>
        nextState.lifecycle === "ready" && nextState.pendingPlacement === null
    );

    expect(state.pendingPlacement).toBeNull();
    await dispatchMeasure(viewport, staleBottom, "frame");
    expect(rig.placements).toHaveLength(2);
    await shutdownViewport(viewport);
  });
});
