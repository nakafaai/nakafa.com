import { describe, expect, it } from "@effect/vitest";
import { AXIS_NAMES } from "@repo/design-system/components/three/names";
import { Array as Arr, Record } from "effect";
import katex from "katex";

describe("axis names", () => {
  it("are the markup KaTeX draws for each name", () => {
    expect(
      Arr.map(Record.keys(AXIS_NAMES), (name) => [
        name,
        katex.renderToString(name, { throwOnError: false, trust: false }),
      ])
    ).toEqual(Record.toEntries(AXIS_NAMES));
  });
});
