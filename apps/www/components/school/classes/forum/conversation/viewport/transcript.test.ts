import { describe, expect, it } from "vitest";
import { createActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/transcript/active";
import {
  createConversationTestForum,
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

describe("conversation/viewport/transcript", () => {
  it("keeps latest updates attached and detached updates anchored to the current post", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openReadyViewport(viewport);
    const latestPlacementCount = rig.placements.length;
    await openTranscript(viewport);
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "bottom"
    );

    expect(rig.placements).toHaveLength(latestPlacementCount + 1);
    expect(rig.placements.at(-1)?.motion).toBe("instant");

    const detachedView = makePostMeasurement(firstPost._id);
    rig.setMeasurement(detachedView);
    await dispatchMeasure(viewport, detachedView, "scroll");
    await waitForState(
      viewport,
      (state) => state.latestAffinity === "detached"
    );

    const detachedPlacementCount = rig.placements.length;
    await openTranscript(viewport);
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "post"
    );

    expect(rig.placements).toHaveLength(detachedPlacementCount + 1);
    expect(rig.placements.at(-1)).toMatchObject({
      motion: "instant",
      view: { kind: "post", postId: firstPost._id },
    });
    await shutdownViewport(viewport);
  });

  it("ignores detached transcript updates when the captured anchor left the window", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);
    const transcriptWithoutAnchor = createActiveTranscriptModel({
      forum: createConversationTestForum(),
      posts: [secondPost],
      unreadCue: null,
    });

    await openReadyViewport(viewport);
    const detachedView = makePostMeasurement(firstPost._id);
    rig.setMeasurement(detachedView);
    await dispatchMeasure(viewport, detachedView, "scroll");
    await waitForState(
      viewport,
      (state) => state.latestAffinity === "detached"
    );

    const detachedPlacementCount = rig.placements.length;
    await dispatchViewport(viewport, {
      activeTranscript: transcriptWithoutAnchor,
      savedSnapshot: null,
      type: "transcript",
      unreadCue: null,
    });
    await waitForState(
      viewport,
      (state) => state.latestAffinity === "detached"
    );

    expect(rig.placements).toHaveLength(detachedPlacementCount);
    await shutdownViewport(viewport);
  });

  it("keeps an active post placement when the transcript changes mid-jump", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openReadyViewport(viewport);
    const currentView = makePostMeasurement(firstPost._id);
    rig.setMeasurement(currentView);
    await dispatchMeasure(viewport, currentView, "scroll");
    await dispatchViewport(viewport, { postId: secondPost._id, type: "post" });
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "post"
    );

    const pendingPlacementCount = rig.placements.length;
    await openTranscript(viewport);
    await waitForState(
      viewport,
      (state) =>
        state.pendingPlacement?.view.kind === "post" &&
        state.pendingPlacement.view.postId === secondPost._id
    );

    expect(rig.placements).toHaveLength(pendingPlacementCount + 1);
    expect(rig.placements.at(-1)).toMatchObject({
      view: { kind: "post", postId: secondPost._id },
    });
    await shutdownViewport(viewport);
  });

  it("preserves the last measured detached anchor when live scroller capture has newer rows", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openReadyViewport(viewport);
    const detachedView = makePostMeasurement(firstPost._id);
    rig.setMeasurement(detachedView);
    await dispatchMeasure(viewport, detachedView, "scroll");
    await waitForState(
      viewport,
      (state) => state.latestAffinity === "detached"
    );

    const detachedPlacementCount = rig.placements.length;
    rig.setMeasurement(makePostMeasurement(secondPost._id));
    await openTranscript(viewport);
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "post"
    );

    expect(rig.placements).toHaveLength(detachedPlacementCount + 1);
    expect(rig.placements.at(-1)).toMatchObject({
      motion: "instant",
      view: { kind: "post", postId: firstPost._id },
    });
    await shutdownViewport(viewport);
  });

  it("ignores detached transcript updates when no measured post anchor exists", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openReadyViewport(viewport);
    const detachedView = makeMeasurement({
      bottomDistance: 120,
      isAtLatest: false,
      lastVisiblePostId: null,
      offset: 80,
      view: null,
    });
    rig.setMeasurement(detachedView);
    await dispatchMeasure(viewport, detachedView, "scroll");
    await waitForState(
      viewport,
      (state) => state.latestAffinity === "detached"
    );

    const detachedPlacementCount = rig.placements.length;
    rig.setMeasurement(makePostMeasurement(secondPost._id));
    await openTranscript(viewport);
    await waitForState(
      viewport,
      (state) => state.latestAffinity === "detached"
    );

    expect(rig.placements).toHaveLength(detachedPlacementCount);
    await shutdownViewport(viewport);
  });
});
