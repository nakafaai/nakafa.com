import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { createSoundStore } from "@/lib/island/sound";

describe("island sound store", () => {
  it("keeps the first audio context the owner's press opened", () => {
    const store = createSoundStore<string>(false);
    expect(store.getState().context).toEqual(Option.none());
    store.getState().open("first");
    store.getState().open("second");
    expect(store.getState().context).toEqual(Option.some("first"));
  });

  it("counts each cue, so the same cue twice plays twice", () => {
    const store = createSoundStore<string>(false);
    store.getState().play("place");
    store.getState().play("place");
    expect(store.getState().cue).toEqual(
      Option.some({ count: 2, name: "place" })
    );
    store.getState().play("water");
    expect(store.getState().cue).toEqual(
      Option.some({ count: 3, name: "water" })
    );
  });

  it("starts with the owner's remembered choice and turns sound off and on", () => {
    const store = createSoundStore<string>(true);
    expect(store.getState().muted).toBe(true);
    store.getState().toggle();
    expect(store.getState().muted).toBe(false);
    store.getState().toggle();
    expect(store.getState().muted).toBe(true);
  });
});
