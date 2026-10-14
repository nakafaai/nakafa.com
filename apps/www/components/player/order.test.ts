import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { readNeighbor, readPosition } from "@/components/player/order";

const keys = ["a", "b", "c"];

describe("question order", () => {
  it("numbers a question from 1 by its place in the order", () => {
    expect(readPosition(keys, "a")).toBe(1);
    expect(readPosition(keys, "c")).toBe(3);
  });

  it("gives a question that is not in the order the number 0", () => {
    expect(readPosition(keys, "z")).toBe(0);
    expect(readPosition(keys, null)).toBe(0);
  });

  it("finds the question before and after another", () => {
    expect(readNeighbor(keys, "b", -1)).toEqual(Option.some("a"));
    expect(readNeighbor(keys, "b", 1)).toEqual(Option.some("c"));
  });

  it("finds no neighbor past either end or for an unknown question", () => {
    expect(readNeighbor(keys, "a", -1)).toEqual(Option.none());
    expect(readNeighbor(keys, "c", 1)).toEqual(Option.none());
    expect(readNeighbor(keys, null, 1)).toEqual(Option.none());
  });
});
