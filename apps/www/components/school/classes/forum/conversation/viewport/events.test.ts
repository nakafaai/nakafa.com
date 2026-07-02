import { describe, expect, it } from "vitest";
import {
  createAdapters,
  createViewport,
  dispatchViewport,
  shutdownViewport,
  waitForState,
} from "@/components/school/classes/forum/conversation/viewport/fixture";

describe("conversation/viewport/events", () => {
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
});
