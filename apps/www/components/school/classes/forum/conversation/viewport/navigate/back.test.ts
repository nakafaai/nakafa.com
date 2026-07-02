import type { Id } from "@repo/backend/convex/_generated/dataModel";
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

describe("conversation/viewport/navigate/back", () => {
  it("navigates back to latest when latest is the semantic back target", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openTranscript(viewport);
    await dispatchViewport(viewport, { postId: firstPost._id, type: "post" });
    await waitForState(viewport, (state) => state.backStack.length === 1);

    await dispatchViewport(viewport, { type: "back" });
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "bottom"
    );

    expect(rig.placements.at(-1)).toMatchObject({
      view: { kind: "bottom" },
    });

    await shutdownViewport(viewport);
  });

  it("navigates back to a valid post view with the same placement flow", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openReadyViewport(viewport);
    const firstPostView = makePostMeasurement(firstPost._id);
    rig.setMeasurement(firstPostView);
    await dispatchMeasure(viewport, firstPostView, "scroll");
    await dispatchViewport(viewport, { postId: secondPost._id, type: "post" });
    await waitForState(viewport, (state) => state.backStack.length === 1);

    await dispatchViewport(viewport, { type: "back" });
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "post"
    );

    expect(rig.placements.at(-1)).toMatchObject({
      align: "center",
      view: { kind: "post", postId: firstPost._id },
    });

    await shutdownViewport(viewport);
  });

  it("falls back to latest when back navigation points to a stale post", async () => {
    const stalePostId = "stale_post" as Id<"schoolClassForumPosts">;
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openReadyViewport(viewport);
    rig.setMeasurement(
      makeMeasurement({
        bottomDistance: 80,
        isAtLatest: false,
        lastVisiblePostId: firstPost._id,
        offset: 160,
        view: { kind: "post", postId: stalePostId },
      })
    );
    await dispatchMeasure(
      viewport,
      makeMeasurement({
        bottomDistance: 80,
        isAtLatest: false,
        lastVisiblePostId: firstPost._id,
        offset: 160,
        view: { kind: "post", postId: stalePostId },
      }),
      "scroll"
    );
    await dispatchViewport(viewport, { postId: firstPost._id, type: "post" });
    await waitForState(viewport, (state) => state.backStack.length === 1);

    await dispatchViewport(viewport, { type: "back" });
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "bottom"
    );

    expect(rig.placements.at(-1)).toMatchObject({
      view: { kind: "bottom" },
    });

    await shutdownViewport(viewport);
  });

  it("clears back targets after explicit user scroll", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openTranscript(viewport);
    await dispatchViewport(viewport, { postId: firstPost._id, type: "post" });
    await waitForState(viewport, (state) => state.backStack.length === 1);
    const firstPostView = makePostMeasurement(firstPost._id);
    rig.setMeasurement(firstPostView);
    await dispatchMeasure(viewport, firstPostView);
    const settled = await waitForState(
      viewport,
      (state) => state.pendingPlacement === null
    );
    expect(settled.backStack).toEqual([{ kind: "bottom" }]);
    expect(settled.jumpControl).toEqual({ kind: "back" });

    await dispatchMeasure(viewport, firstPostView);
    const stable = await waitForState(
      viewport,
      (state) => state.backStack.length === 1
    );
    expect(stable.jumpControl).toEqual({ kind: "back" });

    await dispatchMeasure(viewport, firstPostView, "scroll");
    const programmaticScroll = await waitForState(
      viewport,
      (state) => state.backStack.length === 1
    );
    expect(programmaticScroll.jumpControl).toEqual({ kind: "back" });

    await dispatchViewport(viewport, { type: "user-scroll" });
    const state = await waitForState(
      viewport,
      (nextState) => nextState.backStack.length === 0
    );

    expect(state.backStack).toEqual([]);
    expect(state.jumpControl).toEqual({ kind: "latest" });
    await shutdownViewport(viewport);
  });

  it("clears stale back targets after returning to latest", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openTranscript(viewport);
    await dispatchViewport(viewport, { postId: firstPost._id, type: "post" });
    await waitForState(viewport, (state) => state.backStack.length === 1);
    const firstPostView = makePostMeasurement(firstPost._id);
    rig.setMeasurement(firstPostView);
    await dispatchMeasure(viewport, firstPostView);
    await waitForState(viewport, (state) => state.pendingPlacement === null);

    const latest = makeMeasurement();
    rig.setMeasurement(latest);
    await dispatchMeasure(viewport, latest);
    const state = await waitForState(
      viewport,
      (nextState) => nextState.backStack.length === 0
    );

    expect(state.jumpControl).toEqual({ kind: "none" });
    await shutdownViewport(viewport);
  });
});
