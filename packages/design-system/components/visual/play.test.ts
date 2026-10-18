import { describe, expect, it } from "@effect/vitest";
import { playActions, STILL } from "@repo/design-system/components/visual/play";
import { createStore } from "zustand";
import { combine } from "zustand/middleware";

describe("visual card play", () => {
  it("starts still at its first view, plays on its action, and counts each reset", () => {
    const store = createStore(combine(STILL, playActions));
    expect(store.getState()).toMatchObject({ playing: false, view: 0 });

    store.getState().togglePlaying();
    store.getState().resetView();
    store.getState().resetView();
    expect(store.getState()).toMatchObject({ playing: true, view: 2 });

    store.getState().togglePlaying();
    expect(store.getState()).toMatchObject({ playing: false, view: 2 });
  });
});
