import { describe, expect, it } from "@effect/vitest";
import { STARTER_LAYOUT } from "@repo/backend/confect/island/starter";
import { Option } from "effect";
import { aimedItem, aimedOperation } from "@/lib/island/aim";

const target = { x: 4, y: 4, z: 0 };
const idle = {
  choice: Option.none(),
  moving: false,
  rotation: 1,
  selected: Option.none(),
} as const;

describe("island aim", () => {
  it("places the chosen item on the target at the current turn", () => {
    const operation = aimedOperation(
      { ...idle, choice: Option.some("grass") },
      target,
      []
    );
    expect(operation).toEqual(
      Option.some({
        _tag: "place",
        at: target,
        item: "grass",
        rotation: 1,
        stage: 0,
      })
    );
    expect(aimedItem(Option.getOrThrow(operation), [])).toEqual(
      Option.some("grass")
    );
  });

  it("moves the picked placement there while moving, and only then", () => {
    const hut = { x: 3, y: 2, z: 0 };
    const moving = aimedOperation(
      { ...idle, moving: true, selected: Option.some(hut) },
      target,
      STARTER_LAYOUT
    );
    expect(moving).toEqual(
      Option.some({ _tag: "move", from: hut, rotation: 1, to: target })
    );
    expect(aimedItem(Option.getOrThrow(moving), STARTER_LAYOUT)).toEqual(
      Option.some("house")
    );
    expect(
      aimedOperation(
        { ...idle, selected: Option.some(hut) },
        target,
        STARTER_LAYOUT
      )
    ).toEqual(Option.none());
    expect(
      aimedOperation(
        { ...idle, moving: true, selected: Option.some({ x: 0, y: 0, z: 0 }) },
        target,
        STARTER_LAYOUT
      )
    ).toEqual(Option.none());
  });

  it("outlines nothing for a change that names no item", () => {
    expect(aimedItem({ _tag: "remove", at: target }, [])).toEqual(
      Option.none()
    );
  });
});
