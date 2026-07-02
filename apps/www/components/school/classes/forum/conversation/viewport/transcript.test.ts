import { describe, expect, it } from "vitest";
import { conversationTestFirstPost as firstPost } from "@/components/school/classes/forum/conversation/fixtures/data";
import {
  createAdapters,
  createViewport,
  dispatchMeasure,
  makePostMeasurement,
  openReadyViewport,
  openTranscript,
  shutdownViewport,
  waitForState,
} from "@/components/school/classes/forum/conversation/viewport/fixture";

describe("conversation/viewport/transcript", () => {
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
});
