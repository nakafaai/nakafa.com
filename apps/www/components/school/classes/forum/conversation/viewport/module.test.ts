import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  conversationTestFirstPost as firstPost,
  conversationTestRows as rows,
  conversationTestSecondPost as secondPost,
} from "@/components/school/classes/forum/conversation/fixtures/data";
import {
  ViewportReadError,
  ViewportSessionError,
} from "@/components/school/classes/forum/conversation/viewport/adapter";
import {
  createAdapters,
  createViewport,
  dispatchMeasure,
  dispatchViewport,
  makeMeasurement,
  makePostMeasurement,
  moduleTestTranscript,
  openReadyViewport,
  openTranscript,
  shutdownViewport,
  waitForState,
} from "@/components/school/classes/forum/conversation/viewport/module-fixture";

describe("conversation/viewport/module", () => {
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
      completion: "reached",
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

  it("settles unread opening placements through post reach checks", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await dispatchViewport(viewport, {
      activeTranscript: moduleTestTranscript,
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
      completion: "reached",
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
      (state) => state.backStack.length === 1
    );

    expect(postState.backStack).toEqual([{ kind: "bottom" }]);
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

    await dispatchViewport(viewport, { type: "back" });
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "bottom"
    );

    expect(rig.placements.at(-1)).toMatchObject({
      completion: "reached",
      view: { kind: "bottom" },
    });

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

    await dispatchViewport(viewport, { type: "back" });
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "bottom"
    );

    expect(rig.placements.at(-1)).toMatchObject({
      completion: "reached",
      view: { kind: "bottom" },
    });

    await shutdownViewport(viewport);
  });

  it("keeps latest transcript updates attached and detached updates stable", async () => {
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
      (state) => state.latestAffinity === "detached"
    );

    expect(rig.placements).toHaveLength(detachedPlacementCount);
    await shutdownViewport(viewport);
  });

  it("runs latest and default events through the serialized event loop", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await dispatchViewport(viewport, { type: "latest" });
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "bottom"
    );

    expect(rig.placements.at(-1)).toMatchObject({ view: { kind: "bottom" } });
    await dispatchViewport(viewport, { type: "unknown" } as never);
    await waitForState(viewport, () => true);
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

  it("navigates back to a valid post view with the same placement flow", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openTranscript(viewport);
    rig.setMeasurement(makePostMeasurement(firstPost._id));
    await dispatchViewport(viewport, { postId: secondPost._id, type: "post" });
    await waitForState(viewport, (state) => state.backStack.length === 1);

    await dispatchViewport(viewport, { type: "back" });
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "post"
    );

    expect(rig.placements.at(-1)).toMatchObject({
      align: "center",
      completion: "settled",
      view: { kind: "post", postId: firstPost._id },
    });

    await shutdownViewport(viewport);
  });

  it("keeps detached scroll detached and suppresses duplicate read sync", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openReadyViewport(viewport);
    const detachedView = makePostMeasurement(firstPost._id);
    rig.setMeasurement(detachedView);

    await dispatchMeasure(viewport, detachedView, "scroll");
    await dispatchMeasure(viewport, detachedView, "scroll");
    const state = await waitForState(
      viewport,
      (nextState) => nextState.latestAffinity === "detached"
    );

    expect(state.shouldShowLatestButton).toBe(true);
    await waitForState(viewport, () => rig.readPostIds.length === 2);
    expect(rig.readPostIds).toEqual([secondPost._id, firstPost._id]);
    await shutdownViewport(viewport);
  });

  it("keeps viewport state alive when read sync fails", async () => {
    const rig = createAdapters();
    const viewport = await createViewport({
      ...rig.adapters,
      read: {
        markPostRead: () =>
          Effect.fail(
            new ViewportReadError({
              cause: "test",
              message: "Read sync failed in test.",
            })
          ),
      },
    });

    await openTranscript(viewport);
    await dispatchMeasure(viewport, makeMeasurement());
    const state = await waitForState(
      viewport,
      (nextState) => nextState.lifecycle === "ready"
    );

    expect(state.isAtLatest).toBe(true);
    expect(rig.readPostIds).toEqual([]);
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

    expect(highlighted.backStack).toEqual([]);

    await dispatchViewport(viewport, { type: "highlight-expired" });
    const cleared = await waitForState(
      viewport,
      (state) => state.highlightedPostId === null
    );

    expect(cleared.highlightedPostId).toBeNull();
    await shutdownViewport(viewport);
  });

  it("falls back to latest when back navigation points to a stale post", async () => {
    const stalePostId = "stale_post" as Id<"schoolClassForumPosts">;
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openTranscript(viewport);
    rig.setMeasurement(
      makeMeasurement({
        bottomDistance: 80,
        isAtLatest: false,
        lastVisiblePostId: firstPost._id,
        offset: 160,
        view: { kind: "post", postId: stalePostId },
      })
    );
    await dispatchViewport(viewport, { postId: firstPost._id, type: "post" });
    await waitForState(viewport, (state) => state.backStack.length === 1);

    await dispatchViewport(viewport, { type: "back" });
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "bottom"
    );

    expect(rig.placements.at(-1)).toMatchObject({
      completion: "reached",
      view: { kind: "bottom" },
    });

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

  it("jumps to a post without a back entry when no current view is captured", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openTranscript(viewport);
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

  it("does not mark read when no visible post is measured", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openTranscript(viewport);
    await dispatchMeasure(
      viewport,
      makeMeasurement({ lastVisiblePostId: null })
    );
    await waitForState(viewport, (state) => state.lifecycle === "ready");

    expect(rig.readPostIds).toEqual([]);
    await shutdownViewport(viewport);
  });

  it("clears reached back targets during measurement", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openTranscript(viewport);
    await dispatchViewport(viewport, { postId: firstPost._id, type: "post" });
    await waitForState(viewport, (state) => state.backStack.length === 1);
    const firstPostView = makePostMeasurement(firstPost._id);
    rig.setMeasurement(firstPostView);
    await dispatchMeasure(viewport, firstPostView);
    await waitForState(viewport, (state) => state.pendingPlacement === null);
    rig.setMeasurement(makeMeasurement());

    await dispatchMeasure(viewport, makeMeasurement(), "scroll");
    const state = await waitForState(
      viewport,
      (nextState) => nextState.backStack.length === 0
    );

    expect(state.backStack).toEqual([]);
    await shutdownViewport(viewport);
  });
});
