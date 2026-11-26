import { describe, expect, it } from "@effect/vitest";
import { playActions, STILL } from "@repo/design-system/components/visual/play";
import { createStore } from "zustand";
import { combine } from "zustand/middleware";

describe("visual card play", () => {
  it("starts still at its first view, plays, pauses, stops, and resets", () => {
    const store = createStore(combine(STILL, playActions));
    expect(store.getState()).toMatchObject({
      playing: false,
      stopCount: 0,
      view: 0,
    });

    store.getState().togglePlaying();
    store.getState().resetView();
    store.getState().resetView();
    expect(store.getState()).toMatchObject({
      playing: true,
      stopCount: 0,
      view: 2,
    });

    store.getState().togglePlaying();
    expect(store.getState()).toMatchObject({
      playing: false,
      stopCount: 0,
      view: 2,
    });

    store.getState().play();
    store.getState().play();
    expect(store.getState()).toMatchObject({
      playing: true,
      stopCount: 0,
      view: 2,
    });

    store.getState().pause();
    store.getState().pause();
    expect(store.getState()).toMatchObject({
      playing: false,
      stopCount: 0,
      view: 2,
    });

    store.getState().play();
    store.getState().stop();
    expect(store.getState()).toMatchObject({
      playing: false,
      stopCount: 1,
      view: 2,
    });

    store.getState().play();
    store.getState().reset();
    expect(store.getState()).toMatchObject({
      playing: false,
      stopCount: 2,
      view: 3,
    });
  });
});
