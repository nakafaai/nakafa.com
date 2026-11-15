import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import { highestProven, type Pull, stacksOf } from "#scripts/landing/stack";

const pull = (number: number, base: string): Pull => ({
  number,
  headRefOid: String(number).repeat(40).slice(0, 40),
  headRefName: `branch-${number}`,
  baseRefName: base,
  title: `Change ${number}`,
  isDraft: false,
  files: [],
});

const numbers = (stack: readonly Pull[]) => Arr.map(stack, (one) => one.number);

describe("pull request stacks", () => {
  it("climbs from each pull request on main through the ones built on it", () => {
    const stacks = stacksOf([
      pull(4, "branch-2"),
      pull(1, "main"),
      pull(2, "branch-1"),
      pull(3, "main"),
      pull(5, "branch-2"),
      pull(9, "branch-gone"),
    ]);
    expect(Arr.map(stacks, numbers)).toEqual([[1, 2, 4], [1, 2, 5], [3]]);
  });

  it("lets the highest proven member carry the members below it", () => {
    const stack: Arr.NonEmptyReadonlyArray<Pull> = [
      pull(1, "main"),
      pull(2, "branch-1"),
      pull(3, "branch-2"),
    ];
    const carried = highestProven(stack, (one) => one.number !== 3);
    expect(
      Option.map(carried, ({ top, below }) => [top.number, numbers(below)])
    ).toEqual(Option.some([2, [1]]));
    expect(highestProven(stack, () => false)).toEqual(Option.none());
  });
});
