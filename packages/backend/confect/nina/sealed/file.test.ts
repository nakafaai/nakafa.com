import { describe, expect, it } from "@effect/vitest";
import { createConvexTestWithAuth } from "@repo/backend/confect/test.helpers";
import {
  learnerWithKeyIn,
  openedNameIn,
  sealedFileNameIn,
} from "@repo/backend/test/nina/sealed";

/** A name that the tests seal, so one search finds any copy of it. */
const PLANT = "PLANT-Soal-Rahasia.pdf";

/** The prefix every sealed name starts with. */
const SEALED = /^nakafa\.sealed\.v1:/u;

describe("sealing the name of a learner's upload", () => {
  it("seals a name that holds no copy of it, and opens it for the learner who sealed it", async () => {
    const t = createConvexTestWithAuth();
    const owner = await learnerWithKeyIn(t, "owner");
    const sealed = await sealedFileNameIn(t, owner, PLANT);
    expect(sealed).toMatch(SEALED);
    expect(sealed).not.toContain(PLANT);
    expect(await openedNameIn(t, owner, sealed)).toEqual({ name: PLANT });
  });

  it("fails with a vault cipher error for a name another learner sealed, a payload that is not Base64, and a name without the prefix", async () => {
    const t = createConvexTestWithAuth();
    const owner = await learnerWithKeyIn(t, "owner");
    const other = await learnerWithKeyIn(t, "other");
    const foreign = await sealedFileNameIn(t, owner, PLANT);
    const refused = { reason: "cipher", tag: "VaultError" };
    expect(await openedNameIn(t, other, foreign)).toEqual(refused);
    expect(
      await openedNameIn(t, owner, "nakafa.sealed.v1:!!not-base64")
    ).toEqual(refused);
    expect(await openedNameIn(t, owner, "Soal-Latihan.pdf")).toEqual(refused);
  });
});
