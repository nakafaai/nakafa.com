import { describe, expect, it } from "@effect/vitest";
import type { Operation } from "@repo/backend/confect/island/build";
import { Option } from "effect";
import { createToolStore } from "@/lib/island/tools";

const cell = { x: 1, y: 2, z: 0 };
const remove: Operation = { _tag: "remove", at: cell };
const upgrade: Operation = { _tag: "upgrade", at: cell };

describe("island tools", () => {
  it("starts building with nothing picked and drops what was picked when it ends", () => {
    const tools = createToolStore();
    expect(tools.getState().building).toBe(false);
    tools.getState().toggle();
    tools.getState().choose(Option.some("grass"));
    expect(tools.getState()).toMatchObject({
      building: true,
      choice: Option.some("grass"),
    });
    tools.getState().toggle();
    expect(tools.getState()).toMatchObject({
      building: false,
      choice: Option.none(),
    });
  });

  it("keeps one of an item to place and a placement picked, never both", () => {
    const tools = createToolStore();
    tools.getState().choose(Option.some("house"));
    tools.getState().select(Option.some(cell));
    expect(tools.getState()).toMatchObject({
      choice: Option.none(),
      selected: Option.some(cell),
    });
    tools.getState().move();
    expect(tools.getState().moving).toBe(true);
    tools.getState().choose(Option.some("tree"));
    expect(tools.getState()).toMatchObject({
      moving: false,
      selected: Option.none(),
    });
  });

  it("turns a quarter at a time and comes round", () => {
    const tools = createToolStore();
    for (let turn = 0; turn < 4; turn += 1) {
      tools.getState().rotate();
    }
    expect(tools.getState().rotation).toBe(0);
    tools.getState().rotate();
    expect(tools.getState().rotation).toBe(1);
  });

  it("undoes newest first, keeps redo until a new edit, and forgets on request", () => {
    const tools = createToolStore();
    expect(tools.getState().takeUndo()).toEqual(Option.none());
    tools.getState().record([remove]);
    tools.getState().record([upgrade]);
    expect(tools.getState().takeUndo()).toEqual(Option.some([upgrade]));
    tools.getState().undone([remove]);
    expect(tools.getState().takeRedo()).toEqual(Option.some([remove]));
    tools.getState().redone([upgrade]);
    expect(tools.getState().past).toEqual([[remove], [upgrade]]);
    tools.getState().undone([remove]);
    tools.getState().record([remove]);
    expect(tools.getState().future).toEqual([]);
    tools.getState().forget();
    expect(tools.getState()).toMatchObject({ future: [], past: [] });
  });
});
