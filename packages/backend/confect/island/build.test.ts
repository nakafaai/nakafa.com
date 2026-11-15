import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { buildEdits } from "@repo/backend/confect/island/build";
import { MAX_EDITS, SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Result } from "effect";

const dirt = idOf("dirt");

describe("island/build", () => {
  it("lays a batch over the stored edits, emptied cells included", () => {
    const built = buildEdits(
      [{ block: dirt, x: 30, y: 9, z: 30 }],
      [
        { block: 0, x: 30, y: 9, z: 30 },
        { block: idOf("flowers"), x: 31, y: 9, z: 30 },
      ],
      1,
      16
    );
    expect(built).toEqual(
      Result.succeed([
        { block: 0, x: 30, y: 9, z: 30 },
        { block: idOf("flowers"), x: 31, y: 9, z: 30 },
      ])
    );
  });

  it("refuses the whole batch at the first edit the rules refuse", () => {
    const refusal = (edit: {
      block: number;
      x: number;
      y: number;
      z: number;
    }) =>
      Result.match(
        buildEdits([], [{ block: dirt, x: 30, y: 9, z: 30 }, edit], 1, 16),
        {
          onFailure: (error) => [error.index, error.reason],
          onSuccess: () => [],
        }
      );
    expect(refusal({ block: dirt, x: 23, y: 9, z: 30 })).toEqual([
      1,
      "outside",
    ]);
    expect(refusal({ block: dirt, x: 30, y: 9, z: 40 })).toEqual([
      1,
      "outside",
    ]);
    expect(refusal({ block: 0, x: 30, y: 0, z: 30 })).toEqual([1, "bedrock"]);
    expect(refusal({ block: 200, x: 30, y: 9, z: 31 })).toEqual([1, "unknown"]);
    expect(refusal({ block: idOf("stone"), x: 30, y: 9, z: 31 })).toEqual([
      1,
      "locked",
    ]);
    expect(
      Result.isSuccess(
        buildEdits([], [{ block: idOf("stone"), x: 30, y: 9, z: 31 }], 2, 24)
      )
    ).toBe(true);
  });

  it("refuses a batch that would change more cells than an island keeps", () => {
    const full = Arr.makeBy(MAX_EDITS, (index) => ({
      block: dirt,
      x: index % SPAN,
      y: 1 + Math.floor(index / (SPAN * SPAN)),
      z: Math.floor(index / SPAN) % SPAN,
    }));
    const refused = buildEdits(
      full,
      [{ block: dirt, x: 0, y: 20, z: 0 }],
      7,
      SPAN
    );
    expect(Result.isFailure(refused) && refused.failure.reason).toBe("full");
  });
});
