import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { insertIndex, placeAt } from "@repo/backend/confect/exams/order";
import { Array as Arr, Option, Schema } from "effect";

/** The ID of the question named `name`, decoded as the table's own ID type. */
const question = (name: string) =>
  Schema.decodeUnknownSync(Id("examQuestions"))(name);

const [a, b, c, d] = Arr.map(["a", "b", "c", "d"], question);

describe("exams/order placeAt", () => {
  it("moves a question to the index it names", () => {
    expect(placeAt([a, b, c], c, 0)).toEqual([c, a, b]);
    expect(placeAt([a, b, c], a, 1)).toEqual([b, a, c]);
  });

  it("places a question that is not yet in the order at the index it names", () => {
    expect(placeAt([a, b], d, 1)).toEqual([a, d, b]);
  });

  it("places the question last when the index is past the end", () => {
    expect(placeAt([a, b, c], a, 9)).toEqual([b, c, a]);
  });

  it("keeps every question once when one of them moves", () => {
    const moved = placeAt([a, b, c, d], b, 2);
    expect(moved).toEqual([a, c, b, d]);
    expect(moved).toHaveLength(4);
  });
});

describe("exams/order insertIndex", () => {
  it("places a new question after the one it names", () => {
    expect(insertIndex([a, b, c], a)).toEqual(Option.some(1));
  });

  it("places a new question last when it names no question", () => {
    expect(insertIndex([a, b, c], null)).toEqual(Option.some(3));
  });

  it("names no place for a question that the exam does not hold", () => {
    expect(insertIndex([a, b], d)).toEqual(Option.none());
  });
});
