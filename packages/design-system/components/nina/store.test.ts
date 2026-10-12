// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import type { Options } from "@repo/design-system/components/nina/figure";
import { createLifeStore } from "@repo/design-system/components/nina/store";
import { Array as Arr } from "effect";

const WHOLE: Options = { act: "santai", whole: true };
const PEEK: Options = { act: "pegang", lean: "intip" };
const LOWEST = () => 0;

describe("the store of one Nina", () => {
  it("holds no life until it begins, and answers a press with nothing", () => {
    const store = createLifeStore(LOWEST);
    expect(store.getState().live).toBeUndefined();
    store.getState().tick(WHOLE, 1 / 60, [0, 0]);
    store.getState().retarget("melambai");
    expect(store.getState().live).toBeUndefined();
    expect(store.getState().press(WHOLE)).toBe(false);
  });

  it("begins her life on her still moment and lets time go by", () => {
    const store = createLifeStore(LOWEST);
    store.getState().begin(WHOLE);
    const begun = store.getState().live;
    expect(begun).toMatchObject({ act: "santai", clicks: 0, now: 0 });
    store.getState().tick(WHOLE, 1 / 60, [0, 0]);
    expect(store.getState().live?.now).toBeCloseTo(1 / 60, 9);
  });

  it("answers a press, and says when she ducks behind the edge", () => {
    const store = createLifeStore(LOWEST);
    store.getState().begin(PEEK);
    const ducks = Arr.map(Arr.range(1, 3), () => store.getState().press(PEEK));
    expect(ducks).toEqual([false, false, true]);
  });

  it("changes what she does", () => {
    const store = createLifeStore(LOWEST);
    store.getState().begin(WHOLE);
    store.getState().retarget("melambai");
    expect(store.getState().live?.act).toBe("melambai");
  });
});
