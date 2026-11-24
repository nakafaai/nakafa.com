import { describe, expect, it } from "@effect/vitest";
import { evaluatePedigreeTree } from "@repo/design-system/components/contents/biology/pedigree/model";
import { Array as Arr } from "effect";

describe("human pedigree inheritance model", () => {
  it("constructs ABO, XX/XY, and X-linked carrier/affected nodes", () => {
    const abo = evaluatePedigreeTree("aboBlood");
    const sex = evaluatePedigreeTree("sexDetermination");
    const xLinked = evaluatePedigreeTree("xLinked");

    expect(abo.length).toBe(6);
    expect(sex.length).toBe(6);
    expect(Arr.filter(xLinked, (n) => n.status === "carrier").length).toBe(2);
    expect(Arr.filter(xLinked, (n) => n.status === "affected").length).toBe(1);
  });
});
