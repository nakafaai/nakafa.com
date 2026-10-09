import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import {
  createAdapters,
  createViewport,
  dispatchViewport,
  shutdownViewport,
  waitForState,
} from "@/components/school/classes/forum/conversation/viewport/fixture";

describe("conversation/viewport/events", () => {
  it("processes idle user scroll intent before the next queued event", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await dispatchViewport(viewport, {
      awayFromLatest: false,
      type: "user-scroll",
    });
    await dispatchViewport(viewport, { type: "latest" });
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "bottom"
    );

    expect(Option.getOrThrow(Arr.last(rig.placements))).toMatchObject({
      view: { kind: "bottom" },
    });
    await shutdownViewport(viewport);
  });

  it("runs latest events through the serialized event loop", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await dispatchViewport(viewport, { type: "latest" });
    await waitForState(
      viewport,
      (state) => state.pendingPlacement?.view.kind === "bottom"
    );

    expect(Option.getOrThrow(Arr.last(rig.placements))).toMatchObject({
      view: { kind: "bottom" },
    });
    await dispatchViewport(viewport, {
      awayFromLatest: false,
      type: "user-scroll",
    });
    await waitForState(viewport, () => true);
    await shutdownViewport(viewport);
  });
});
