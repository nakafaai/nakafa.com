import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  changedSince,
  lostMemory,
} from "@repo/backend/confect/nina/memory/seen";
import { Array as Arr, Schema } from "effect";

const decode = Schema.decodeUnknownSync(Id("ninaMemories"));
const first = decode("first");
const second = decode("second");
const third = decode("third");

describe("memory a capture call had read", () => {
  it("finds a memory that is gone, and nothing when all are there or none was read", () => {
    const stored = [{ _id: first, confirmedAt: 1 }];
    expect(lostMemory([{ confirmedAt: 1, id: first }], stored)).toBe(false);
    expect(lostMemory([], stored)).toBe(false);
    expect(lostMemory([], [])).toBe(false);
    expect(
      lostMemory(
        [
          { confirmedAt: 1, id: first },
          { confirmedAt: 1, id: second },
        ],
        stored
      )
    ).toBe(true);
  });

  it("finds the memories confirmed after the call read them, and ignores those it never read", () => {
    expect(
      Arr.fromIterable(
        changedSince(
          [
            { confirmedAt: 1, id: first },
            { confirmedAt: 1, id: second },
          ],
          [
            { _id: first, confirmedAt: 5 },
            { _id: second, confirmedAt: 1 },
            { _id: third, confirmedAt: 9 },
          ]
        )
      )
    ).toEqual([first]);
  });
});
