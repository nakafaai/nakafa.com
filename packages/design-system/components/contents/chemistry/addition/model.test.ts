import { describe, expect, it } from "@effect/vitest";
import { evaluateAdditionChain } from "@repo/design-system/components/contents/chemistry/addition/model";

describe("addition polymer chain model", () => {
  it("generates n linked repeat units with the matching side substituent", () => {
    expect(evaluateAdditionChain("ethene", 4).length).toBe(4);
    expect(evaluateAdditionChain("propene", 3)[0]?.sideGroupKind).toBe(
      "methyl"
    );
    expect(evaluateAdditionChain("chloroethene", 5)[0]?.sideGroupKind).toBe(
      "chlorine"
    );
    expect(
      evaluateAdditionChain("tetrafluoroethene", 6)[0]?.sideGroupKind
    ).toBe("fluorine");
  });
});
